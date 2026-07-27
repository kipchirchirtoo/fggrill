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
      // Accept both the new (category/description) and legacy
      // (purpose_category/purpose_description) field names so the client can
      // send either.
      category,
      description,
      purpose_category,
      purpose_description,
      paid_to_name,
      receipt_number,
      po_reference
    } = req.body;

    const finalCategory = category || purpose_category;
    const finalDescription = description || purpose_description;
    const recorded_by = req.user?.id;
    const branch_id = req.user?.branch_id;

    if (!amount || !finalCategory || !finalDescription) {
      return res.status(400).json({
        success: false,
        error: 'Amount, category, and description are required'
      });
    }

    // Verify the shift is open. The general multi-branch cashier logbook lives
    // in `cashier_shift_logs`. Validate against the logbook so any branch's
    // cashier can record an expense against their own open shift.
    if (shift_id) {
      const { data: shift, error: shiftError } = await supabase
        .from('cashier_shift_logs')
        .select('id, status, branch_id')
        .eq('id', shift_id)
        .single();

      if (shiftError || !shift) {
        return res.status(404).json({
          success: false,
          error: 'Shift not found'
        });
      }

      const status = String(shift.status || '').toLowerCase();
      if (status !== 'open') {
        return res.status(400).json({
          success: false,
          error: 'Cannot record an expense for a shift that is not open'
        });
      }
    }

    // Cashier expenses live in the canonical, shift-linked
    // `shift_reconciliation_expenses` table (NOT petty_cash_ledger, which is a
    // double-entry accounting ledger). This is the same table the branch
    // accountant reads at reconciliation, so figures always agree.
    const { data: entry, error } = await supabase
      .from('shift_reconciliation_expenses')
      .insert({
        branch_id,
        shift_id,
        amount,
        category: finalCategory,
        description: finalDescription,
        paid_to_name: paid_to_name || null,
        receipt_number: receipt_number || null,
        po_reference: po_reference || null,
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
    const { shift_id, start_date, end_date, category } = req.query;
    const branch_id = req.user?.branch_id;

    let query = supabase
      .from('shift_reconciliation_expenses')
      .select(`
        *,
        recorded_by_user:users!recorded_by(id, first_name, last_name)
      `)
      .eq('branch_id', branch_id)
      .order('created_at', { ascending: false });

    if (shift_id) {
      query = query.eq('shift_id', shift_id);
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    if (category) {
      query = query.eq('category', category);
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
      .from('shift_reconciliation_expenses')
      .select('amount, category')
      .eq('branch_id', branch_id);

    if (shift_id) {
      query = query.eq('shift_id', shift_id);
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    const { data: entries, error } = await query;

    if (error) throw error;

    // Every row in shift_reconciliation_expenses is cash paid out of the
    // drawer, so it all counts as cash-out, grouped by category.
    const summary = {
      total_cash_in: 0,
      total_cash_out: 0,
      net_balance: 0,
      by_category: {} as Record<string, number>
    };

    entries?.forEach((entry: any) => {
      const amt = parseFloat(entry.amount) || 0;
      summary.total_cash_out += amt;
      const cat = entry.category || 'OTHER';
      summary.by_category[cat] = (summary.by_category[cat] || 0) + amt;
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
