import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { FloatHistoryService } from '../../services/kyogong/float-history.service';

/**
 * Get current float information for an active shift
 * GET /api/kyogong/shifts/:shift_id/float
 */
export const getCurrentFloat = async (req: Request, res: Response) => {
  try {
    const { shift_id } = req.params;

    // Fetch shift data
    const { data: shift, error } = await supabase
      .from('cashier_shifts')
      .select('current_float, opening_cash_float, expected_cash, last_float_update, status')
      .eq('id', shift_id)
      .single();

    if (error || !shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    // Check if shift is closed
    if (shift.status === 'CLOSED' || shift.status === 'RECONCILED' || shift.status === 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot get float for closed shift'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        currentFloat: shift.current_float,
        openingFloat: shift.opening_cash_float,
        expectedClosingCash: shift.expected_cash,
        lastUpdated: shift.last_float_update
      }
    });
  } catch (error: any) {
    console.error('Error getting current float:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get current float',
      error: error.message
    });
  }
};

/**
 * Update float based on a transaction (internal use)
 * This is called by the transaction controller after a cash transaction
 */
export const updateFloatOnTransaction = async (
  shiftId: string,
  cashReceived: number,
  changeGiven: number,
  transactionId: string,
  maxRetries: number = 3
): Promise<void> => {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      // Get current shift data with version
      const { data: shift, error: fetchError } = await supabase
        .from('cashier_shifts')
        .select('current_float, expected_cash, float_version, total_change_given')
        .eq('id', shiftId)
        .single();

      if (fetchError || !shift) {
        throw new Error('Shift not found');
      }

      // Calculate net cash change (cash received - change given)
      const netCashChange = cashReceived - changeGiven;
      
      // Calculate new float values
      const newCurrentFloat = (shift.current_float || 0) + netCashChange;
      const newExpectedCash = (shift.expected_cash || 0) + netCashChange;
      const newTotalChangeGiven = (shift.total_change_given || 0) + changeGiven;

      // Validate float remains non-negative
      if (newCurrentFloat < 0) {
        throw new Error('Insufficient float: operation would result in negative balance');
      }

      // Update shift with optimistic locking
      const { error: updateError } = await supabase
        .from('cashier_shifts')
        .update({
          current_float: newCurrentFloat,
          expected_cash: newExpectedCash,
          total_change_given: newTotalChangeGiven,
          float_version: shift.float_version + 1,
          last_float_update: new Date().toISOString()
        })
        .eq('id', shiftId)
        .eq('float_version', shift.float_version); // Optimistic locking

      if (updateError) {
        // Check if it's a version conflict
        if (attempt < maxRetries - 1) {
          // Retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
          attempt++;
          continue;
        }
        throw new Error(`Failed to update float: ${updateError.message}`);
      }

      // Record in float history
      await FloatHistoryService.recordFloatChange(
        shiftId,
        netCashChange,
        newCurrentFloat,
        'TRANSACTION',
        transactionId
      );

      return; // Success
    } catch (error: any) {
      if (attempt >= maxRetries - 1) {
        console.error('Float update failed after retries:', error);
        throw error;
      }
      attempt++;
    }
  }
};

/**
 * Manual float adjustment (supervisor only)
 * POST /api/kyogong/shifts/:shift_id/float/adjust
 */
export const adjustFloat = async (req: Request, res: Response) => {
  try {
    const { shift_id } = req.params;
    const { adjustmentAmount, reason } = req.body;
    const userId = (req as any).user?.id;

    // Check if user has supervisor role
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: User not found'
      });
    }

    const supervisorRoles = ['SUPER_ADMIN', 'BRANCH_ACCOUNTANT', 'ACCOUNTANT', 'GENERAL_MANAGER'];
    if (!supervisorRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Supervisor privileges required'
      });
    }

    // Validate reason is provided
    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Adjustment reason is required'
      });
    }

    // Get current shift data
    const { data: shift, error: fetchError } = await supabase
      .from('cashier_shifts')
      .select('current_float, expected_cash, float_version')
      .eq('id', shift_id)
      .single();

    if (fetchError || !shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    // Calculate new float values
    const newCurrentFloat = (shift.current_float || 0) + adjustmentAmount;
    const newExpectedCash = (shift.expected_cash || 0) + adjustmentAmount;

    // Update shift
    const { error: updateError } = await supabase
      .from('cashier_shifts')
      .update({
        current_float: newCurrentFloat,
        expected_cash: newExpectedCash,
        float_version: shift.float_version + 1,
        last_float_update: new Date().toISOString()
      })
      .eq('id', shift_id)
      .eq('float_version', shift.float_version);

    if (updateError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update float',
        error: updateError.message
      });
    }

    // Record in float history
    await FloatHistoryService.recordFloatChange(
      shift_id,
      adjustmentAmount,
      newCurrentFloat,
      'ADJUSTMENT',
      undefined,
      reason,
      userId
    );

    return res.status(200).json({
      success: true,
      data: {
        updatedFloat: newCurrentFloat,
        adjustmentAmount,
        reason
      }
    });
  } catch (error: any) {
    console.error('Error adjusting float:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to adjust float',
      error: error.message
    });
  }
};

/**
 * Get float history for a shift
 * GET /api/kyogong/shifts/:shift_id/float/history
 */
export const getFloatHistory = async (req: Request, res: Response) => {
  try {
    const { shift_id } = req.params;
    const { startTime, endTime, changeType } = req.query;

    // Build filters
    const filters: any = {};
    if (startTime) filters.startTime = new Date(startTime as string);
    if (endTime) filters.endTime = new Date(endTime as string);
    if (changeType) filters.changeType = changeType as string;

    // Get history
    const history = await FloatHistoryService.getHistory(shift_id, filters);

    return res.status(200).json({
      success: true,
      data: { history }
    });
  } catch (error: any) {
    console.error('Error getting float history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get float history',
      error: error.message
    });
  }
};

/**
 * Export float history to CSV
 * GET /api/kyogong/shifts/:shift_id/float/history/export
 */
export const exportFloatHistory = async (req: Request, res: Response) => {
  try {
    const { shift_id } = req.params;

    // Get all history for the shift
    const history = await FloatHistoryService.getHistory(shift_id);

    if (!history || history.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No float history found for this shift'
      });
    }

    // Generate CSV
    const headers = [
      'Timestamp',
      'Change Type',
      'Amount Change',
      'Resulting Float',
      'Transaction Ref',
      'Reason',
      'Performed By'
    ];

    const rows = history.map(entry => [
      new Date(entry.timestamp).toISOString(),
      entry.change_type,
      entry.amount_change.toFixed(2),
      entry.resulting_float.toFixed(2),
      entry.transaction_id || '',
      entry.adjustment_reason || '',
      entry.performed_by || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="float-history-${shift_id}.csv"`);
    
    return res.status(200).send(csv);
  } catch (error: any) {
    console.error('Error exporting float history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export float history',
      error: error.message
    });
  }
};
