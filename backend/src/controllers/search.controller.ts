import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

/**
 * Global search across multiple modules
 * Searches: staff, guests, orders, bookings, bills, transactions, receipts, payments
 */
export const globalSearch = async (req: Request, res: Response) => {
  try {
    const { q, modules } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const searchQuery = q.trim().toLowerCase();
    
    if (searchQuery.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    // Parse modules filter if provided
    const modulesList = modules 
      ? (typeof modules === 'string' ? modules.split(',') : modules)
      : ['staff', 'guest', 'order', 'booking', 'bill', 'transaction', 'receipt', 'payment'];

    const results: any[] = [];

    // Search Staff
    if (modulesList.includes('staff')) {
      const { data: staff, error } = await supabase
        .from('staff_profiles')
        .select('id, staff_id, first_name, last_name, email, phone, position, branch_id')
        .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,staff_id.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(10);

      if (!error && staff) {
        results.push(...staff.map(s => ({
          ...s,
          type: 'staff',
          display_name: `${s.first_name} ${s.last_name}`,
          subtitle: `${s.staff_id} - ${s.position}`
        })));
      }
    }

    // Search Guests
    if (modulesList.includes('guest')) {
      const { data: guests, error } = await supabase
        .from('guests')
        .select('id, first_name, last_name, email, phone, id_number')
        .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,id_number.ilike.%${searchQuery}%`)
        .limit(10);

      if (!error && guests) {
        results.push(...guests.map(g => ({
          ...g,
          type: 'guest',
          display_name: `${g.first_name} ${g.last_name}`,
          subtitle: g.email || g.phone
        })));
      }
    }

    // Search Bookings
    if (modulesList.includes('booking')) {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id, booking_number, guest_id, check_in, check_out, status, total_amount')
        .or(`booking_number.ilike.%${searchQuery}%`)
        .limit(10);

      if (!error && bookings) {
        results.push(...bookings.map(b => ({
          ...b,
          type: 'booking',
          display_name: `Booking ${b.booking_number}`,
          subtitle: `${b.status} - KES ${b.total_amount}`
        })));
      }
    }

    // Search Orders (Restaurant/Bar)
    if (modulesList.includes('order')) {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, table_number, status, total_amount, created_at')
        .or(`order_number.ilike.%${searchQuery}%`)
        .limit(10);

      if (!error && orders) {
        results.push(...orders.map(o => ({
          ...o,
          type: 'order',
          display_name: `Order ${o.order_number}`,
          subtitle: `Table ${o.table_number} - ${o.status}`
        })));
      }
    }

    // Search Bills
    if (modulesList.includes('bill')) {
      const { data: bills, error } = await supabase
        .from('bills')
        .select('id, bill_number, guest_name, total_amount, status, created_at')
        .or(`bill_number.ilike.%${searchQuery}%,guest_name.ilike.%${searchQuery}%`)
        .limit(10);

      if (!error && bills) {
        results.push(...bills.map(b => ({
          ...b,
          type: 'bill',
          display_name: `Bill ${b.bill_number}`,
          subtitle: `${b.guest_name} - KES ${b.total_amount}`
        })));
      }
    }

    // Search Transactions
    if (modulesList.includes('transaction')) {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('id, transaction_id, type, amount, status, created_at')
        .or(`transaction_id.ilike.%${searchQuery}%`)
        .limit(10);

      if (!error && transactions) {
        results.push(...transactions.map(t => ({
          ...t,
          type: 'transaction',
          display_name: `Transaction ${t.transaction_id}`,
          subtitle: `${t.type} - KES ${t.amount}`
        })));
      }
    }

    // Search Receipts
    if (modulesList.includes('receipt')) {
      const { data: receipts, error } = await supabase
        .from('receipts')
        .select('id, receipt_number, amount, payment_method, created_at')
        .or(`receipt_number.ilike.%${searchQuery}%`)
        .limit(10);

      if (!error && receipts) {
        results.push(...receipts.map(r => ({
          ...r,
          type: 'receipt',
          display_name: `Receipt ${r.receipt_number}`,
          subtitle: `${r.payment_method} - KES ${r.amount}`
        })));
      }
    }

    // Search Payments
    if (modulesList.includes('payment')) {
      const { data: payments, error } = await supabase
        .from('payments')
        .select('id, payment_id, amount, method, status, created_at')
        .or(`payment_id.ilike.%${searchQuery}%`)
        .limit(10);

      if (!error && payments) {
        results.push(...payments.map(p => ({
          ...p,
          type: 'payment',
          display_name: `Payment ${p.payment_id}`,
          subtitle: `${p.method} - KES ${p.amount}`
        })));
      }
    }

    return res.status(200).json({
      success: true,
      data: results,
      count: results.length,
      query: searchQuery
    });

  } catch (error) {
    console.error('Global search error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to perform search',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
