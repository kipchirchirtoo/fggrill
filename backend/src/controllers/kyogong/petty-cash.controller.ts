import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import db from '../../db';
import { logger } from '../../utils/logger';
import {
  isCashierStationRole,
  resolveCashierStationRole,
} from '../../utils/posStationAccess';

const BRANCH_WIDE_EXPENSE_ROLES = new Set([
  'super_admin',
  'general_manager',
  'branch_manager',
  'branch_accountant',
  'accountant',
  'auditor',
]);

const normalizeRole = (req: Request): string =>
  resolveCashierStationRole(req.user?.role, req.user?.branch_id);

const canViewBranchWideExpenses = (req: Request): boolean =>
  BRANCH_WIDE_EXPENSE_ROLES.has(normalizeRole(req));

const shouldRestrictExpenseHistoryToOwner = (req: Request): boolean => {
  if (canViewBranchWideExpenses(req)) return false;
  const role = normalizeRole(req);
  if (isCashierStationRole(role, req.user?.branch_id)) return true;
  return role === 'receptionist' || role === 'branch_receptionist' || role === 'front_desk_supervisor';
};

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
        .select('id, status, branch_id, cashier_id')
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

      if (
        shouldRestrictExpenseHistoryToOwner(req)
        && String(shift.cashier_id || '') !== String(recorded_by || '')
      ) {
        return res.status(403).json({
          success: false,
          error: 'You can only record expenses against your own open shift'
        });
      }
    }

    // Cashier expenses live in the canonical, shift-linked
    // `shift_reconciliation_expenses` table (NOT petty_cash_ledger, which is a
    // double-entry accounting ledger). This is the same table the branch
    // accountant reads at reconciliation, so figures always agree.
    let { data: entry, error } = await supabase
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

    if (error) {
      // If DB has legacy CHECK constraint shift_reconciliation_expenses_category_check
      // (code 23514), fallback to 'other' or 'petty_cash' while preserving category in description.
      if (error.code === '23514') {
        const allowedCategories = ['petty_cash', 'transaction_cost', 'other'];
        const fallbackCat = allowedCategories.includes(String(finalCategory).toLowerCase())
          ? String(finalCategory).toLowerCase()
          : 'other';

        const fallbackDesc = finalDescription.toLowerCase().includes(String(finalCategory).toLowerCase())
          ? finalDescription
          : `[${finalCategory}] ${finalDescription}`;

        const fallbackRes = await supabase
          .from('shift_reconciliation_expenses')
          .insert({
            branch_id,
            shift_id,
            amount,
            category: fallbackCat,
            description: fallbackDesc,
            paid_to_name: paid_to_name || null,
            receipt_number: receipt_number || null,
            po_reference: po_reference || null,
            recorded_by
          })
          .select('*')
          .single();

        if (fallbackRes.error) throw fallbackRes.error;
        entry = fallbackRes.data;
      } else {
        throw error;
      }
    }

    // Deduct cash_at_hand and update total_expenses in cashier_shift_logs
    if (shift_id) {
      try {
        await db.query(
          `UPDATE cashier_shift_logs 
           SET expense_total = COALESCE(expense_total, 0) + $1,
               cash_at_hand = GREATEST(0, COALESCE(cash_at_hand, opening_float, 0) - $1),
               updated_at = NOW()
           WHERE id = $2`,
          [amount, shift_id]
        );

        const { data: currentShift } = await supabase
          .from('cashier_shift_logs')
          .select('id, cash_at_hand, expense_total')
          .eq('id', shift_id)
          .single();

        if (currentShift) {
          const currentExp = Number(currentShift.expense_total || 0);
          const currentCash = Number(currentShift.cash_at_hand || 0);
          await supabase
            .from('cashier_shift_logs')
            .update({
              expense_total: currentExp + Number(amount),
              cash_at_hand: Math.max(0, currentCash - Number(amount)),
              updated_at: new Date().toISOString(),
            })
            .eq('id', shift_id);
        }
      } catch (err) {
        logger.warn(`Failed to update cashier_shift_logs cash_at_hand for expense:`, err);
      }

      // Record PAYOUT transaction in cashier_transactions
      try {
        await supabase
          .from('cashier_transactions')
          .insert({
            branch_id: branch_id || req.user?.branch_id,
            cashier_shift_log_id: shift_id,
            amount: Number(amount),
            payment_method: 'CASH',
            revenue_type: 'EXPENSE',
            transaction_type: 'PAYOUT',
            status: 'completed',
            notes: `${finalCategory}: ${finalDescription}`,
            source_document_type: po_reference ? 'PO' : 'PETTY_CASH',
            recorded_by,
            created_at: new Date().toISOString(),
          });
      } catch (txErr) {
        logger.warn(`Failed to insert cashier_transaction for expense:`, txErr);
      }

      // If PO reference is supplied, update PO finance_status
      if (po_reference) {
        try {
          await supabase
            .from('purchase_orders')
            .update({
              finance_status: 'paid',
              updated_at: new Date().toISOString(),
            })
            .or(`po_number.eq.${po_reference},id.eq.${po_reference}`);
        } catch (_) {}
      }
    }

    res.json({
      success: true,
      message: 'Petty cash entry recorded successfully — cash drawer updated',
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
 * Get pending approved purchase orders for cashier petty cash recording
 * GET /api/kyogong/petty-cash/pending-pos
 */
export const getPendingPOsForCashier = async (req: Request, res: Response) => {
  try {
    const branch_id = Number(req.query.branch_id || req.user?.branch_id);

    let query = supabase
      .from('purchase_orders')
      .select('*')
      .in('status', ['approved', 'APPROVED', 'received', 'RECEIVED', 'fully_received'])
      .order('created_at', { ascending: false });

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }

    const { data: pos, error } = await query;

    if (error) {
      const pgRes = await db.query(
        `SELECT po.*, s.name as supplier_name 
         FROM purchase_orders po 
         LEFT JOIN suppliers s ON po.supplier_id = s.id 
         WHERE LOWER(po.status) IN ('approved', 'received', 'fully_received')
         ${branch_id ? 'AND po.branch_id = $1' : ''}
         ORDER BY po.created_at DESC LIMIT 100`,
        branch_id ? [branch_id] : []
      );
      return res.json({ success: true, data: pgRes.rows || [] });
    }

    const supplierIds = (pos || [])
      .map((p: any) => p.supplier_id || p.vendor_id)
      .filter(Boolean);

    let supplierMap = new Map();
    if (supplierIds.length > 0) {
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, name')
        .in('id', supplierIds);
      if (suppliers) {
        supplierMap = new Map(suppliers.map((s: any) => [s.id, s.name]));
      }
    }

    const enriched = (pos || []).map((p: any) => ({
      ...p,
      supplier_name:
        p.supplier_name ||
        supplierMap.get(p.supplier_id || p.vendor_id) ||
        'Supplier',
    }));

    res.json({ success: true, data: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    const recorded_by = req.user?.id;
    const restrictToOwner = shouldRestrictExpenseHistoryToOwner(req);

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

    if (restrictToOwner && recorded_by) {
      query = query.eq('recorded_by', recorded_by);
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
    const recorded_by = req.user?.id;
    const restrictToOwner = shouldRestrictExpenseHistoryToOwner(req);

    let query = supabase
      .from('shift_reconciliation_expenses')
      .select('amount, category')
      .eq('branch_id', branch_id);

    if (shift_id) {
      query = query.eq('shift_id', shift_id);
    }

    if (restrictToOwner && recorded_by) {
      query = query.eq('recorded_by', recorded_by);
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
