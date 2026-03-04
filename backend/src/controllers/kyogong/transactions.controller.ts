import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { updateFloatOnTransaction } from './float-tracking.controller';

/**
 * Create a new transaction within a shift
 * POST /api/kyogong/shifts/:shift_id/transactions
 */
export const createTransaction = async (req: Request, res: Response) => {
  try {
    const { shift_id } = req.params;
    const {
      service_category,
      items, // Array of { item_type, item_id, item_name, quantity, unit_price, service_staff_id }
      customer_name,
      customer_phone,
      customer_room_number,
      payment_method,
      cash_amount,
      mpesa_amount,
      card_amount,
      mpesa_reference,
      discount_amount,
      notes
    } = req.body;

    const user_id = req.user?.id;

    // Validate shift is open
    const { data: shift, error: shiftError } = await supabase
      .from('cashier_shifts')
      .select('*, sales_point:sales_points(*)')
      .eq('id', shift_id)
      .eq('status', 'open')
      .single();

    if (shiftError || !shift) {
      return res.status(404).json({
        success: false,
        error: 'Shift not found or not open'
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one item is required'
      });
    }

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: any) =>
      sum + (item.quantity * item.unit_price), 0
    );
    const tax_amount = subtotal * 0.16; // 16% VAT
    const total_amount = subtotal + tax_amount - (discount_amount || 0);

    // Validate payment amounts
    const total_paid = (cash_amount || 0) + (mpesa_amount || 0) + (card_amount || 0);

    // For 'BILL' method, we allow zero payment as it will be settled at the main cashier
    if (payment_method === 'BILL') {
      // No strict check for BILL method at this stage
    } else if (payment_method === 'CASH') {
      // Allow over-payment for cash (change handling)
      if (total_paid < total_amount - 0.01) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient payment amount',
          data: { total_amount, total_paid }
        });
      }
    } else {
      // Strict check for MPESA, CARD, or Split (where non-cash is involved)
      if (Math.abs(total_paid - total_amount) > 0.01) {
        return res.status(400).json({
          success: false,
          error: 'Payment amounts do not match total',
          data: {
            total_amount,
            total_paid,
            difference: total_paid - total_amount
          }
        });
      }
    }

    // Generate transaction number
    const date_str = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random_suffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const transaction_number = `${shift.sales_point.code}-${date_str}-${random_suffix}`;

    // Create transaction
    const { data: transaction, error: txError } = await supabase
      .from('shift_transactions')
      .insert({
        shift_id,
        branch_id: shift.branch_id,
        sales_point_id: shift.sales_point_id,
        transaction_number,
        transaction_type: 'SALE',
        service_category,
        subtotal,
        discount_amount: discount_amount || 0,
        tax_amount,
        total_amount,
        payment_method,
        cash_amount: cash_amount || 0,
        mpesa_amount: mpesa_amount || 0,
        card_amount: card_amount || 0,
        mpesa_reference,
        customer_name,
        customer_phone,
        customer_room_number,
        served_by: user_id
      })
      .select('*')
      .single();

    if (txError) throw txError;

    // Insert transaction items
    const transactionItems = items.map((item: any) => ({
      transaction_id: transaction.id,
      item_type: item.item_type,
      item_id: item.item_id,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
      service_staff_id: item.service_staff_id,
      service_staff_name: item.service_staff_name,
      notes: item.notes
    }));

    const { error: itemsError } = await supabase
      .from('shift_transaction_items')
      .insert(transactionItems);

    if (itemsError) throw itemsError;

    // Update shift totals - relying on DB trigger 'trigger_update_shift_totals'
    // for standard transaction recording. Manual RPC call removed to prevent double-counting.

    // Update cash float if payment method is CASH
    if (payment_method === 'CASH' && cash_amount > 0) {
      try {
        const changeGiven = Math.max(0, cash_amount - total_amount);
        await updateFloatOnTransaction(shift_id, cash_amount, changeGiven, transaction.id);
      } catch (floatError: any) {
        console.error('Float update error:', floatError);
        // Log error but don't fail the transaction
        // The transaction is already saved, float can be adjusted manually if needed
      }
    }

    // Fetch complete transaction with items
    const { data: completeTransaction } = await supabase
      .from('shift_transactions')
      .select(`
        *,
        items:shift_transaction_items(*),
        served_by_user:users!served_by(id, first_name, last_name)
      `)
      .eq('id', transaction.id)
      .single();

    res.json({
      success: true,
      message: 'Transaction created successfully',
      data: completeTransaction
    });
  } catch (error: any) {
    console.error('Create transaction error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create transaction'
    });
  }
};

/**
 * Get transactions for a shift
 * GET /api/kyogong/shifts/:shift_id/transactions
 */
export const getShiftTransactions = async (req: Request, res: Response) => {
  try {
    const { shift_id } = req.params;

    const { data: transactions, error } = await supabase
      .from('shift_transactions')
      .select(`
        *,
        items:shift_transaction_items(*),
        served_by_user:users!served_by(id, first_name, last_name),
        voided_by_user:users!voided_by(id, first_name, last_name)
      `)
      .eq('shift_id', shift_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: transactions || []
    });
  } catch (error: any) {
    console.error('Get shift transactions error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get transactions'
    });
  }
};

/**
 * Void a transaction
 * PUT /api/kyogong/transactions/:id/void
 */
export const voidTransaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { void_reason, authorization_code } = req.body;
    const user_id = req.user?.id;

    if (!void_reason) {
      return res.status(400).json({
        success: false,
        error: 'Void reason is required'
      });
    }

    // Get transaction and verify shift is still open
    const { data: transaction, error: txError } = await supabase
      .from('shift_transactions')
      .select('*, shift:cashier_shifts(*)')
      .eq('id', id)
      .single();

    if (txError || !transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    if (transaction.shift.status !== 'open') {
      return res.status(400).json({
        success: false,
        error: 'Cannot void transaction after shift is closed'
      });
    }

    if (transaction.is_voided) {
      return res.status(400).json({
        success: false,
        error: 'Transaction is already voided'
      });
    }

    // Void the transaction
    const { data: voidedTx, error: voidError } = await supabase
      .from('shift_transactions')
      .update({
        is_voided: true,
        void_reason,
        voided_by: user_id,
        voided_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (voidError) throw voidError;

    // Update shift totals (subtract voided amounts)
    await supabase
      .from('cashier_shifts')
      .update({
        total_revenue: (transaction.shift.total_revenue || 0) - transaction.total_amount,
        total_cash_in: (transaction.shift.total_cash_in || 0) - (transaction.cash_amount || 0),
        total_mpesa_in: (transaction.shift.total_mpesa_in || 0) - (transaction.mpesa_amount || 0),
        total_card_in: (transaction.shift.total_card_in || 0) - (transaction.card_amount || 0),
        total_transactions: (transaction.shift.total_transactions || 0) - 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', transaction.shift_id);

    // Log the void action
    await supabase
      .from('shift_audit_log')
      .insert({
        shift_id: transaction.shift_id,
        action: 'VOID',
        performed_by: user_id,
        reason: void_reason,
        old_value: { transaction_id: id, total_amount: transaction.total_amount },
        new_value: { is_voided: true }
      });

    res.json({
      success: true,
      message: 'Transaction voided successfully',
      data: voidedTx
    });
  } catch (error: any) {
    console.error('Void transaction error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to void transaction'
    });
  }
};

/**
 * Get transaction details
 * GET /api/kyogong/transactions/:id
 */
export const getTransactionDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: transaction, error } = await supabase
      .from('shift_transactions')
      .select(`
        *,
        items:shift_transaction_items(*),
        served_by_user:users!served_by(id, first_name, last_name, employee_id),
        voided_by_user:users!voided_by(id, first_name, last_name),
        shift:cashier_shifts(
          id,
          shift_number,
          status,
          cashier:users!cashier_id(id, first_name, last_name)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error: any) {
    console.error('Get transaction details error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get transaction details'
    });
  }
};
