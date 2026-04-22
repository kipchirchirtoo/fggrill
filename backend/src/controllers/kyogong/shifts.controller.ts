import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { FloatHistoryService } from '../../services/kyogong/float-history.service';

// Helper to map shift object to what frontend expects
const mapShiftResponse = (shift: any) => {
  if (!shift) return null;
  
  const mapped = {
    ...shift,
    opening_cash_float: shift.opening_float,
    cash_sales: shift.total_cash_in,
    mpesa_sales: shift.total_mpesa_in,
    card_sales: shift.total_card_in,
    total_sales: shift.total_revenue,
    opened_at: shift.start_time
  };
  
  console.log('🔧 [mapShiftResponse] Original shift:', { id: shift.id, shift_number: shift.shift_number });
  console.log('🔧 [mapShiftResponse] Mapped shift:', { id: mapped.id, shift_number: mapped.shift_number });
  
  return mapped;
};

/**
 * Open a new cashier shift
 * POST /api/kyogong/shifts/open
 */
export const openShift = async (req: Request, res: Response) => {
  try {
    const {
      sales_point_id,
      opening_cash_float,
      opening_petty_cash,
      assigned_staff // Array of { staff_id, staff_role }
    } = req.body;

    const cashier_id = req.user?.id;
    const branch_id = req.user?.branch_id;

    if (!sales_point_id || opening_cash_float === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Sales point and opening cash float are required'
      });
    }

    // Check if cashier already has an open shift
    const { data: existingShift } = await supabase
      .from('cashier_shifts')
      .select('id, shift_number')
      .eq('cashier_id', cashier_id)
      .eq('status', 'open')
      .single();

    if (existingShift) {
      return res.status(400).json({
        success: false,
        error: `You already have an open shift: ${existingShift.shift_number}`
      });
    }

    // Check if sales point already has an open shift
    const { data: pointShift } = await supabase
      .from('cashier_shifts')
      .select('id, shift_number, cashier_id')
      .eq('sales_point_id', sales_point_id)
      .eq('status', 'open')
      .single();

    if (pointShift) {
      return res.status(400).json({
        success: false,
        error: `This sales point already has an open shift: ${pointShift.shift_number}`
      });
    }

    // Generate shift number: SHF-YYYYMMDD-HHMMSS
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const shift_number = `SHF-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    // Create new shift — uses actual DB column names
    const { data: shift, error: shiftError } = await supabase
      .from('cashier_shifts')
      .insert({
        branch_id,
        sales_point_id,
        cashier_id,
        shift_number,
        start_time: now.toISOString(),
        opening_float: opening_cash_float,
        opening_petty_cash: opening_petty_cash || 0,
        status: 'open',
        // Initialize float tracking fields
        current_float: opening_cash_float,
        expected_cash: opening_cash_float,
        total_change_given: 0,
        float_version: 0,
        last_float_update: now.toISOString()
      })
      .select('*')
      .single();

    if (shiftError) throw shiftError;

    // Record opening float in history
    try {
      await FloatHistoryService.recordFloatChange(
        shift.id,
        opening_cash_float,
        opening_cash_float,
        'OPENING',
        undefined,
        'Shift opened',
        cashier_id
      );
    } catch (historyError: any) {
      console.error('Float history error:', historyError);
      // Don't fail shift opening if history recording fails
    }

    // Assign staff if provided
    if (assigned_staff && Array.isArray(assigned_staff) && assigned_staff.length > 0) {
      const staffAssignments = assigned_staff.map((staff: any) => ({
        shift_id: shift.id,
        staff_id: staff.staff_id,
        staff_role: staff.staff_role
      }));

      const { error: assignError } = await supabase
        .from('shift_staff_assignments')
        .insert(staffAssignments);

      if (assignError) {
        console.error('Staff assignment error:', assignError);
      }
    }

    res.json({
      success: true,
      message: 'Shift opened successfully',
      data: mapShiftResponse(shift)
    });
  } catch (error: any) {
    console.error('Open shift error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to open shift'
    });
  }
};

/**
 * Get current open shift for cashier
 * GET /api/kyogong/shifts/current
 */
export const getCurrentShift = async (req: Request, res: Response) => {
  try {
    const cashier_id = req.user?.id;

    const { data: shift, error } = await supabase
      .from('cashier_shifts')
      .select(`
        *,
        sales_point:sales_points(*),
        staff_assignments:shift_staff_assignments(
          id,
          staff_id,
          staff_role,
          staff:users(id, first_name, last_name, role)
        )
      `)
      .eq('cashier_id', cashier_id)
      .eq('status', 'open')
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!shift) {
      console.log('🔧 [getCurrentShift] No open shift found for cashier:', cashier_id);
      return res.json({
        success: true,
        data: null,
        message: 'No open shift found'
      });
    }

    console.log('🔧 [getCurrentShift] Found shift:', { id: shift.id, shift_number: shift.shift_number, cashier_id: shift.cashier_id });
    const mappedShift = mapShiftResponse(shift);
    console.log('🔧 [getCurrentShift] Returning mapped shift:', { id: mappedShift?.id, shift_number: mappedShift?.shift_number });

    res.json({
      success: true,
      data: mappedShift
    });
  } catch (error: any) {
    console.error('Get current shift error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get current shift'
    });
  }
};

/**
 * Close a shift
 * PUT /api/kyogong/shifts/:id/close
 */
export const closeShift = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      closing_cash_counted,
      closing_petty_cash,
      variance_reason,
      pool_tokens_data // For sports bar
    } = req.body;

    const cashier_id = req.user?.id;

    if (closing_cash_counted === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Closing cash count is required'
      });
    }

    // Get shift details — use actual DB column names
    const { data: shift, error: fetchError } = await supabase
      .from('cashier_shifts')
      .select('*, sales_point:sales_points(*)')
      .eq('id', id)
      .eq('cashier_id', cashier_id)
      .eq('status', 'open')
      .single();

    if (fetchError || !shift) {
      return res.status(404).json({
        success: false,
        error: 'Shift not found or already closed'
      });
    }

    // 1. Get detailed reconciliation totals using the new RPC
    const { data: totals, error: totalsError } = await supabase.rpc('get_shift_reconciliation_totals', { 
      p_shift_id: id 
    });

    if (totalsError) {
      console.error('Error fetching reconciliation totals:', totalsError);
      // Fallback if RPC fails or isn't available yet
    }

    const cash_sales = totals?.cash_sales || shift.total_cash_in || 0;
    const mpesa_sales = totals?.mpesa_sales || shift.total_mpesa_in || 0;
    const card_sales = totals?.card_sales || shift.total_card_in || 0;
    const credit_created = totals?.credit_created || 0;
    const credit_paid_cash = totals?.credit_paid_cash || 0;

    // 2. Calculate expected cash using the strict accounting formula:
    // Expected = Opening Float + Cash Sales + Cash from Credit Payments - Expenses - Refunds
    const expenses = shift.total_expenses || 0; // Check if these exist in shift record
    const refunds = shift.total_refunds || 0;
    
    const cash_expected = (shift.opening_float || 0) + cash_sales + credit_paid_cash - expenses - refunds;
    const cash_variance = closing_cash_counted - cash_expected;

    // Check if variance explanation is required (>5% or >1000 KES)
    const varianceThreshold = Math.max(cash_expected * 0.05, 1000);
    if (Math.abs(cash_variance) > varianceThreshold && !variance_reason) {
      return res.status(400).json({
        success: false,
        error: 'Variance explanation required',
        data: {
          cash_expected,
          cash_counted: closing_cash_counted,
          variance: cash_variance,
          breakdown: {
            opening_float: shift.opening_float,
            cash_sales,
            credit_paid_cash,
            expenses,
            refunds
          }
        }
      });
    }

    // Handle pool tokens reconciliation for sports bar
    if (pool_tokens_data && shift.sales_point?.code === 'SPORTS_BAR') {
      const { error: tokensError } = await supabase
        .from('pool_tokens_inventory')
        .insert({
          branch_id: shift.branch_id,
          shift_id: shift.id,
          opening_balance: pool_tokens_data.opening_balance,
          tokens_sold: pool_tokens_data.tokens_sold,
          tokens_issued: pool_tokens_data.tokens_issued || 0,
          closing_balance: pool_tokens_data.closing_balance,
          variance: pool_tokens_data.variance,
          variance_reason: pool_tokens_data.variance_reason,
          date: new Date().toISOString().split('T')[0]
        });

      if (tokensError) {
        console.error('Pool tokens error:', tokensError);
      }
    }

    // Update shift — use actual DB column names
    const { data: closedShift, error: updateError } = await supabase
      .from('cashier_shifts')
      .update({
        status: 'closed',
        end_time: new Date().toISOString(),
        closed_at: new Date().toISOString(),
        closing_float: closing_cash_counted,
        closing_petty_cash: closing_petty_cash || 0,
        expected_cash: cash_expected,
        actual_cash: closing_cash_counted,
        cash_variance,
        variance_reason,
        // Added reconciliation breakdown fields
        total_cash_in: cash_sales,
        total_mpesa_in: mpesa_sales,
        total_card_in: card_sales,
        total_revenue: cash_sales + mpesa_sales + card_sales,
        total_credit_created: credit_created,
        total_credit_paid_cash: credit_paid_cash,
        expected_closing_amount: cash_expected,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Shift closed successfully',
      data: mapShiftResponse(closedShift)
    });
  } catch (error: any) {
    console.error('Close shift error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to close shift'
    });
  }
};

/**
 * Get all shifts (filtered by role)
 * GET /api/kyogong/shifts
 */
export const getShifts = async (req: Request, res: Response) => {
  try {
    const { status, sales_point_id, start_date, end_date } = req.query;
    const user_role = req.user?.role;
    const user_id = req.user?.id;
    const branch_id = req.user?.branch_id;

    let query = supabase
      .from('cashier_shifts')
      .select(`
        *,
        cashier:users!cashier_id(id, first_name, last_name, role),
        sales_point:sales_points(*),
        reviewed_by_user:users!reviewed_by(id, first_name, last_name)
      `)
      .order('start_time', { ascending: false });

    // Role-based filtering — DB stores roles lowercase
    const cashierRoles = ['cashier', 'receptionist', 'kyogong_spa_cashier', 'kyogong_executive_bar_cashier', 'kyogong_sports_bar_cashier', 'kyogong_reception_cashier'];
    const lowerRole = (user_role || '').toLowerCase();
    if (cashierRoles.includes(lowerRole)) {
      query = query.eq('cashier_id', user_id);
    } else if (lowerRole === 'branch_accountant') {
      query = query.eq('branch_id', branch_id);
    }
    // AUDITOR and SUPER_ADMIN see all

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (sales_point_id) {
      query = query.eq('sales_point_id', sales_point_id);
    }
    if (start_date) {
      query = query.gte('start_time', start_date);
    }
    if (end_date) {
      query = query.lte('start_time', end_date);
    }

    const { data: shifts, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: (shifts || []).map(mapShiftResponse)
    });
  } catch (error: any) {
    console.error('Get shifts error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get shifts'
    });
  }
};

/**
 * Get shift details
 * GET /api/kyogong/shifts/:id
 */
export const getShiftDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: shift, error } = await supabase
      .from('cashier_shifts')
      .select(`
        *,
        cashier:users!cashier_id(id, first_name, last_name, role, employee_id),
        sales_point:sales_points(*),
        reviewed_by_user:users!approved_by(id, first_name, last_name),
        staff_assignments:shift_staff_assignments(
          id,
          staff_id,
          staff_role,
          staff:users(id, first_name, last_name, role)
        ),
        transactions:shift_transactions(
          id,
          transaction_number,
          transaction_type,
          service_category,
          total_amount,
          payment_method,
          customer_name,
          is_voided,
          created_at,
          items:shift_transaction_items(*)
        ),
        petty_cash:petty_cash_ledger(*),
        pool_tokens:pool_tokens_inventory(*),
        audit_log:shift_audit_log(
          id,
          action,
          reason,
          performed_by,
          created_at,
          user:users(first_name, last_name)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!shift) {
      return res.status(404).json({
        success: false,
        error: 'Shift not found'
      });
    }

    res.json({
      success: true,
      data: mapShiftResponse(shift)
    });
  } catch (error: any) {
    console.error('Get shift details error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get shift details'
    });
  }
};

/**
 * Approve shift (Branch Accountant)
 * PUT /api/kyogong/shifts/:id/approve
 */
export const approveShift = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { review_notes } = req.body;
    const reviewer_id = req.user?.id;

    const { data: shift, error } = await supabase
      .from('cashier_shifts')
      .update({
        status: 'approved',
        supervisor_approved: true,
        approved_by: reviewer_id,
        approved_at: new Date().toISOString(),
        remarks: review_notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('status', 'closed')
      .select('*')
      .single();

    if (error) throw error;

    if (!shift) {
      return res.status(404).json({
        success: false,
        error: 'Shift not found or not in closed status'
      });
    }

    res.json({
      success: true,
      message: 'Shift approved successfully',
      data: mapShiftResponse(shift)
    });
  } catch (error: any) {
    console.error('Approve shift error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to approve shift'
    });
  }
};

/**
 * Flag shift for investigation (Branch Accountant)
 * PUT /api/kyogong/shifts/:id/flag
 */
export const flagShift = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { review_notes } = req.body;
    const reviewer_id = req.user?.id;

    if (!review_notes) {
      return res.status(400).json({
        success: false,
        error: 'Review notes required when flagging a shift'
      });
    }

    const { data: shift, error } = await supabase
      .from('cashier_shifts')
      .update({
        status: 'flagged',
        approved_by: reviewer_id,
        approved_at: new Date().toISOString(),
        remarks: review_notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('status', 'closed')
      .select('*')
      .single();

    if (error) throw error;

    if (!shift) {
      return res.status(404).json({
        success: false,
        error: 'Shift not found or not in closed status'
      });
    }

    res.json({
      success: true,
      message: 'Shift flagged for investigation',
      data: mapShiftResponse(shift)
    });
  } catch (error: any) {
    console.error('Flag shift error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to flag shift'
    });
  }
};
