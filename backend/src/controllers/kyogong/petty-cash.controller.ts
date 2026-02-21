import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';

/**
 * Record petty cash entry
 * POST /api/kyogong/petty-cash
 */
export const recordPettyCash = async (req: Request, res: Response) => {
  try {
    const {
      shift_id,
      amount,
      transaction_type,
      purpose_category,
      purpose_description,
      paid_to_name,
      paid_to_id_number,
      authorized_by,
      authorizer_name,
      receipt_number,
      receipt_attachment_url
    } = req.body;

    const recorded_by = req.user?.id;
    const branch_id = req.user?.branch_id;

    if (!amount || !transaction_type || !purpose_category || !purpose_description) {
      return res.status(400).json({
        success: false,
        error: 'Amount, transaction type, purpose category, and description are required'
      });
    }

    // Verify shift is open (if shift_id provided)
    if (shift_id) {
      const { data: shift, error: shiftError } = await supabase
        .from('cashier_shifts')
        .select('id, status, sales_point:sales_points(supports_petty_cash)')
        .eq('id', shift_id)
        .single();

      if (shiftError || !shift) {
        return res.status(404).json({
          success: false,
          error: 'Shift not found'
        });
      }

      if (shift.status !== 'open') {
        return res.status(400).json({
          success: false,
          error: 'Cannot record petty cash for closed shift'
        });
      }

      const salesPoint = shift.sales_point as any;
      if (!salesPoint?.supports_petty_cash) {
        return res.status(400).json({
          success: false,
          error: 'This sales point does not support petty cash management'
        });
      }
    }

    const { data: entry, error } = await supabase
      .from('petty_cash_ledger')
      .insert({
        branch_id,
        shift_id,
        amount,
        transaction_type,
        purpose_category,
        purpose_description,
        paid_to_name,
        paid_to_id_number,
        authorized_by,
        authorizer_name,
        receipt_number,
        receipt_attachment_url,
        recorded_by
      })
      .select('*')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Petty cash entry recorded successfully',
      data: entry
    });
  } catch (error: any) {
    console.error('Record petty cash error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to record petty cash entry'
    });
  }
};

/**
 * Get petty cash entries
 * GET /api/kyogong/petty-cash
 */
export const getPettyCashEntries = async (req: Request, res: Response) => {
  try {
    const { shift_id, start_date, end_date, purpose_category } = req.query;
    const branch_id = req.user?.branch_id;

    let query = supabase
      .from('petty_cash_ledger')
      .select(`
        *,
        recorded_by_user:users!recorded_by(id, first_name, last_name),
        authorized_by_user:users!authorized_by(id, first_name, last_name),
        shift:cashier_shifts(id, shift_number, status)
      `)
      .eq('branch_id', branch_id)
      .order('transaction_date', { ascending: false });

    if (shift_id) {
      query = query.eq('shift_id', shift_id);
    }

    if (start_date) {
      query = query.gte('transaction_date', start_date);
    }

    if (end_date) {
      query = query.lte('transaction_date', end_date);
    }

    if (purpose_category) {
      query = query.eq('purpose_category', purpose_category);
    }

    const { data: entries, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: entries || []
    });
  } catch (error: any) {
    console.error('Get petty cash entries error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get petty cash entries'
    });
  }
};

/**
 * Get petty cash summary
 * GET /api/kyogong/petty-cash/summary
 */
export const getPettyCashSummary = async (req: Request, res: Response) => {
  try {
    const { shift_id, start_date, end_date } = req.query;
    const branch_id = req.user?.branch_id;

    let query = supabase
      .from('petty_cash_ledger')
      .select('amount, transaction_type, purpose_category')
      .eq('branch_id', branch_id);

    if (shift_id) {
      query = query.eq('shift_id', shift_id);
    }

    if (start_date) {
      query = query.gte('transaction_date', start_date);
    }

    if (end_date) {
      query = query.lte('transaction_date', end_date);
    }

    const { data: entries, error } = await query;

    if (error) throw error;

    // Calculate summary
    const summary = {
      total_cash_in: 0,
      total_cash_out: 0,
      net_balance: 0,
      by_category: {} as Record<string, number>
    };

    entries?.forEach((entry: any) => {
      if (entry.transaction_type === 'CASH_IN') {
        summary.total_cash_in += parseFloat(entry.amount);
      } else {
        summary.total_cash_out += parseFloat(entry.amount);

        if (!summary.by_category[entry.purpose_category]) {
          summary.by_category[entry.purpose_category] = 0;
        }
        summary.by_category[entry.purpose_category] += parseFloat(entry.amount);
      }
    });

    summary.net_balance = summary.total_cash_in - summary.total_cash_out;

    res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    console.error('Get petty cash summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get petty cash summary'
    });
  }
};

/**
 * Get petty cash categories
 * GET /api/kyogong/petty-cash/categories
 */
export const getPettyCashCategories = async (req: Request, res: Response) => {
  try {
    const categories = [
      { code: 'REPAIRS', name: 'Repairs' },
      { code: 'MAINTENANCE', name: 'Maintenance' },
      { code: 'FUEL', name: 'Fuel' },
      { code: 'TRANSPORT', name: 'Staff Transport' },
      { code: 'SUPPLIES', name: 'Supplies' },
      { code: 'OTHER', name: 'Other' }
    ];

    res.json({
      success: true,
      data: categories
    });
  } catch (error: any) {
    console.error('Get petty cash categories error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get petty cash categories'
    });
  }
};
