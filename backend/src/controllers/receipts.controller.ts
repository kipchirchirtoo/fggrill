import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

// Get all receipts with filters
export const getReceipts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branch_id, receipt_type, payment_status, start_date, end_date, limit = 100 } = req.query;

    let query = supabase
      .from('receipts')
      .select(`
        *,
        branch:branches(id, name),
        items:receipt_items(*)
      `)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (branch_id) query = query.eq('branch_id', branch_id);
    if (receipt_type) query = query.eq('receipt_type', receipt_type);
    if (payment_status) query = query.eq('payment_status', payment_status);
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// Get receipt by ID
export const getReceiptById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('receipts')
      .select(`
        *,
        branch:branches(id, name),
        items:receipt_items(*),
        created_by_user:users!receipts_created_by_fkey(id, first_name, last_name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ success: false, message: 'Receipt not found' });
      return;
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// Create a new receipt
export const createReceipt = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const {
      receipt_type,
      order_id,
      invoice_id,
      booking_id,
      customer_name,
      customer_email,
      customer_phone,
      table_number,
      room_number,
      subtotal,
      tax_rate = 16,
      tax_amount,
      discount_amount = 0,
      discount_reason,
      total_amount,
      payment_method,
      payment_reference,
      amount_paid,
      change_amount = 0,
      payment_status = 'paid',
      branch_id,
      cashier_name,
      notes,
      items = []
    } = req.body;

    // Create receipt
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        receipt_type,
        order_id,
        invoice_id,
        booking_id,
        customer_name,
        customer_email,
        customer_phone,
        table_number,
        room_number,
        subtotal,
        tax_rate,
        tax_amount,
        discount_amount,
        discount_reason,
        total_amount,
        payment_method,
        payment_reference,
        amount_paid: amount_paid || total_amount,
        change_amount,
        payment_status,
        branch_id,
        created_by: userId,
        cashier_name,
        notes
      })
      .select()
      .single();

    if (receiptError) throw receiptError;

    // Create receipt items
    if (items.length > 0) {
      const receiptItems = items.map((item: any) => ({
        receipt_id: receipt.id,
        item_name: item.item_name || item.name,
        item_sku: item.item_sku || item.sku,
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit || 'piece',
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
        discount_amount: item.discount_amount || 0,
        tax_amount: item.tax_amount || 0,
        total_amount: item.total_amount || (item.quantity * item.unit_price),
        menu_item_id: item.menu_item_id,
        inventory_item_id: item.inventory_item_id
      }));

      const { error: itemsError } = await supabase
        .from('receipt_items')
        .insert(receiptItems);

      if (itemsError) throw itemsError;
    }

    // Fetch complete receipt with items
    const { data: completeReceipt, error: fetchError } = await supabase
      .from('receipts')
      .select(`
        *,
        branch:branches(id, name),
        items:receipt_items(*)
      `)
      .eq('id', receipt.id)
      .single();

    if (fetchError) throw fetchError;

    res.status(201).json({ success: true, data: completeReceipt });
  } catch (error) {
    next(error);
  }
};

// Update receipt (mark as printed, emailed, etc.)
export const updateReceipt = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('receipts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// Get daily revenue summary
export const getDailyRevenue = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branch_id, start_date, end_date } = req.query;

    let query = supabase
      .from('receipts')
      .select('created_at, receipt_type, payment_method, total_amount, branch_id')
      .eq('payment_status', 'paid');

    if (branch_id) query = query.eq('branch_id', branch_id);
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);

    const { data, error } = await query;
    if (error) throw error;

    // Aggregate by date
    const summary: Record<string, any> = {};
    (data || []).forEach((receipt: any) => {
      const date = receipt.created_at.split('T')[0];
      if (!summary[date]) {
        summary[date] = {
          date,
          total_revenue: 0,
          transaction_count: 0,
          by_type: {},
          by_payment: {}
        };
      }
      summary[date].total_revenue += receipt.total_amount;
      summary[date].transaction_count += 1;
      summary[date].by_type[receipt.receipt_type] = (summary[date].by_type[receipt.receipt_type] || 0) + receipt.total_amount;
      summary[date].by_payment[receipt.payment_method] = (summary[date].by_payment[receipt.payment_method] || 0) + receipt.total_amount;
    });

    res.json({ success: true, data: Object.values(summary) });
  } catch (error) {
    next(error);
  }
};

// Get receipt statistics
export const getReceiptStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branch_id, period = 'today' } = req.query;

    let startDate: string;
    const now = new Date();
    
    switch (period) {
      case 'today':
        startDate = now.toISOString().split('T')[0];
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      default:
        startDate = now.toISOString().split('T')[0];
    }

    let query = supabase
      .from('receipts')
      .select('total_amount, receipt_type, payment_method, payment_status')
      .gte('created_at', startDate);

    if (branch_id) query = query.eq('branch_id', branch_id);

    const { data, error } = await query;
    if (error) throw error;

    const stats = {
      total_receipts: data?.length || 0,
      total_revenue: (data || []).filter(r => r.payment_status === 'paid').reduce((sum, r) => sum + r.total_amount, 0),
      by_type: {} as Record<string, number>,
      by_payment_method: {} as Record<string, number>,
      by_status: {} as Record<string, number>
    };

    (data || []).forEach((receipt: any) => {
      stats.by_type[receipt.receipt_type] = (stats.by_type[receipt.receipt_type] || 0) + 1;
      stats.by_payment_method[receipt.payment_method] = (stats.by_payment_method[receipt.payment_method] || 0) + 1;
      stats.by_status[receipt.payment_status] = (stats.by_status[receipt.payment_status] || 0) + 1;
    });

    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};
