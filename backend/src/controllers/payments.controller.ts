import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { applyBranchFilter, isGlobalRole } from '../utils/branchIsolation';

const usableBranchId = (value: any): string => {
  const normalized = String(value ?? '').trim();
  return normalized && normalized !== '0' && normalized !== 'undefined' && normalized !== 'null'
    ? normalized
    : '';
};

const resolvePaymentBranchScope = (req: Request, requestedBranchId: any): string => {
  const requested = usableBranchId(requestedBranchId);
  const userBranch = usableBranchId(req.user?.branch_id);
  return isGlobalRole(req.user?.role) ? requested : (userBranch || requested);
};

export class PaymentsController {
  // Get all payments for a branch with filters (includes banking, payments, pos_transactions)
  async getPayments(req: Request, res: Response) {
    try {
      const { branch_id, status, payment_method, start_date, end_date, limit } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const endOfDay = end_date
        ? ((end_date as string).length === 10 ? `${end_date}T23:59:59.999Z` : end_date as string)
        : null;

      const itemsLimit = limit ? parseInt(limit as string) : null;
      const branchScope = resolvePaymentBranchScope(req, branch_id);

      // ── 1. payment_verifications ────────────────────────────────────────
      let pvQuery = supabase.from('payment_verifications').select('*').order('recorded_at', { ascending: false });
      pvQuery = applyBranchFilter(pvQuery, req);
      if (branch_id) pvQuery = pvQuery.eq('branch_id', branch_id);
      // Status filter is applied later for consistency with other sources
      if (payment_method) pvQuery = pvQuery.eq('payment_method', payment_method);
      if (start_date) pvQuery = pvQuery.gte('recorded_at', start_date as string);
      if (endOfDay)   pvQuery = pvQuery.lte('recorded_at', endOfDay);
      if (itemsLimit) pvQuery = pvQuery.limit(itemsLimit);

      const { data: pvData, error: pvError } = await pvQuery;
      if (pvError) {
        console.error('Error fetching payment_verifications:', pvError);
        return res.status(500).json({ success: false, message: 'Failed to fetch payments', error: pvError.message });
      }
      const pvRecords = (pvData || []).map((p: any) => ({ 
        ...p, 
        _source: 'payment_verification',
        status: (p.status || 'pending').toLowerCase() // Normalize status
      }));

      // ── 2. banking_transactions ─────────────────────────────────────────
      let btQuery = supabase.from('banking_transactions').select('*').order('transaction_date', { ascending: false });
      btQuery = applyBranchFilter(btQuery, req);
      if (branch_id) btQuery = btQuery.eq('branch_id', branch_id);
      if (start_date) btQuery = btQuery.gte('transaction_date', start_date as string);
      if (endOfDay)   btQuery = btQuery.lte('transaction_date', endOfDay); // Use endOfDay for consistency
      if (itemsLimit) btQuery = btQuery.limit(itemsLimit);

      const { data: btData } = await btQuery;
      let bankingRecords = (btData || []).map((bt: any) => ({
        id: bt.id,
        branch_id: bt.branch_id,
        amount: bt.amount,
        payment_method: bt.payment_method || bt.transaction_type,
        reference_number: bt.reference_number,
        customer_name: bt.purpose_description || bt.bank_name,
        recorded_by: bt.recorded_by,
        recorded_at: bt.created_at || bt.transaction_date,
        recorder_notes: bt.notes,
        status: bt.status?.toLowerCase() === 'approved' ? 'auditor_verified'
              : bt.status?.toLowerCase() === 'rejected' ? 'flagged' : 'pending',
        _source: 'banking',
        _banking_type: bt.transaction_type,
        _bank_name: bt.bank_name,
        _transaction_date: bt.transaction_date,
        accountant_verified_by: bt.approved_by,
        accountant_verified_at: bt.approved_at,
      }));

      // ── 3. payments table (branch inferred via related orders) ──────────
      let rawPayments: any[] = [];
      let payQuery = supabase.from('payments').select('*').order('created_at', { ascending: false });
      if (start_date) payQuery = payQuery.gte('created_at', `${start_date}T00:00:00`);
      if (endOfDay)   payQuery = payQuery.lte('created_at', endOfDay);
      if (itemsLimit) payQuery = payQuery.limit(itemsLimit);
      const { data: payData } = await payQuery;

      if (payData && payData.length > 0) {
        const bookingIds   = [...new Set(payData.map((p: any) => p.booking_id).filter(Boolean))];
        const restOrderIds = [...new Set(payData.map((p: any) => p.restaurant_order_id).filter(Boolean))];
        const barOrderIds  = [...new Set(payData.map((p: any) => p.bar_order_id).filter(Boolean))];
        const posIds       = [...new Set(payData.map((p: any) => p.pos_transaction_id).filter(Boolean))];

        const [
          { data: bookings },
          { data: restOrders },
          { data: barOrders },
          { data: posTxns }
        ] = await Promise.all([
          bookingIds.length   ? supabase.from('reservations').select('id, branch_id').in('id', bookingIds) : { data: [] },
          restOrderIds.length ? supabase.from('restaurant_orders').select('id, branch_id').in('id', restOrderIds) : { data: [] },
          barOrderIds.length  ? supabase.from('bar_orders').select('id, branch_id').in('id', barOrderIds) : { data: [] },
          posIds.length       ? supabase.from('pos_transactions').select('id, branch_id').in('id', posIds) : { data: [] },
        ]);

        const bookingMap   = Object.fromEntries((bookings || []).map((b: any) => [b.id, b]));
        const restOrderMap = Object.fromEntries((restOrders || []).map((o: any) => [o.id, o]));
        const barOrderMap  = Object.fromEntries((barOrders || []).map((o: any) => [o.id, o]));
        const posMap       = Object.fromEntries((posTxns || []).map((p: any) => [p.id, p]));

        const paymentIds = payData.map((p: any) => p.id);
        const { data: shiftTxns } = await supabase
          .from('cashier_shift_transactions')
          .select('transaction_id, shift_id')
          .in('transaction_id', paymentIds);

        let cashierByPaymentId: Record<string, string> = {};
        if (shiftTxns && shiftTxns.length > 0) {
          const shiftIds = [...new Set(shiftTxns.map((st: any) => st.shift_id))];
          const { data: shifts } = await supabase
            .from('cashier_shift_logs')
            .select('id, cashier_id')
            .in('id', shiftIds);
          const shiftCashierMap = Object.fromEntries((shifts || []).map((s: any) => [s.id, s.cashier_id]));
          shiftTxns.forEach((st: any) => {
            if (shiftCashierMap[st.shift_id]) {
              cashierByPaymentId[st.transaction_id] = shiftCashierMap[st.shift_id];
            }
          });
        }

        rawPayments = payData
          .map((p: any) => {
            let inferredBranchId: any = null;
            if (p.branch_id)                                            inferredBranchId = p.branch_id;
            else if (p.booking_id && bookingMap[p.booking_id])          inferredBranchId = bookingMap[p.booking_id].branch_id;
            else if (p.restaurant_order_id && restOrderMap[p.restaurant_order_id]) inferredBranchId = restOrderMap[p.restaurant_order_id].branch_id;
            else if (p.bar_order_id && barOrderMap[p.bar_order_id])     inferredBranchId = barOrderMap[p.bar_order_id].branch_id;
            else if (p.pos_transaction_id && posMap[p.pos_transaction_id]) inferredBranchId = posMap[p.pos_transaction_id].branch_id;
            return {
              ...p,
              branch_id: inferredBranchId,
              _source: 'payment',
              recorded_at: p.recorded_at || p.created_at,
              status: 'auditor_verified',
              recorded_by: p.recorded_by || p.cashier_id || cashierByPaymentId[p.id] || p.metadata?.cashier_id || null,
              reference_number: p.reference_number || p.reference,
              customer_name: p.customer_name || p.notes,
            };
          })
          .filter((p: any) => {
            if (branchScope) {
              if (String(p.branch_id) !== branchScope) return false;
            }
            return true;
          });
      }

      // ── 4. pos_transactions ─────────────────────────────────────────────
      let posQuery = supabase.from('pos_transactions').select('*').order('created_at', { ascending: false });
      posQuery = applyBranchFilter(posQuery, req);
      if (branch_id) posQuery = posQuery.eq('branch_id', branch_id);
      if (start_date) posQuery = posQuery.gte('created_at', `${start_date}T00:00:00`);
      if (endOfDay)   posQuery = posQuery.lte('created_at', endOfDay);
      if (itemsLimit) posQuery = posQuery.limit(itemsLimit);
      const { data: posData } = await posQuery;
      let posRecords = (posData || []).map((pos: any) => ({
        id: pos.id,
        branch_id: pos.branch_id,
        amount: pos.total_amount || pos.amount || 0,
        payment_method: pos.payment_method,
        reference_number: pos.transaction_ref,
        customer_name: pos.customer_name,
        recorded_by: pos.cashier_id,
        recorded_at: pos.created_at || pos.transaction_date,
        status: 'auditor_verified', // Unified complete state
        _source: 'pos',
        _transaction_date: pos.transaction_date || pos.created_at,
      }));

      // ── 5. pos_shift_payments (current outlet POS source of truth) ──────
      let posShiftPaymentRecords: any[] = [];
      let outletQuery = supabase
        .from('pos_outlets')
        .select('id, branch_id, name, outlet_type');
      if (branchScope) outletQuery = outletQuery.eq('branch_id', branchScope);

      const { data: outlets, error: outletsError } = await outletQuery;
      if (outletsError) {
        console.error('Error fetching POS outlets for payments:', outletsError);
        return res.status(500).json({ success: false, message: 'Failed to fetch outlet payments', error: outletsError.message });
      }

      const outletMap = Object.fromEntries((outlets || []).map((outlet: any) => [String(outlet.id), outlet]));
      const outletIds = Object.keys(outletMap);

      if (outletIds.length > 0) {
        let pspQuery = supabase
          .from('pos_shift_payments')
          .select('id, shift_id, outlet_id, order_id, payment_method, amount, reference, credit_bill_id, received_by, created_at, short_code')
          .in('outlet_id', outletIds)
          .order('created_at', { ascending: false });
        if (payment_method) pspQuery = pspQuery.eq('payment_method', payment_method);
        if (start_date) pspQuery = pspQuery.gte('created_at', `${start_date}T00:00:00`);
        if (endOfDay) pspQuery = pspQuery.lte('created_at', endOfDay);
        if (itemsLimit) pspQuery = pspQuery.limit(itemsLimit);

        const { data: pspData, error: pspError } = await pspQuery;
        if (pspError) {
          console.error('Error fetching pos_shift_payments:', pspError);
          return res.status(500).json({ success: false, message: 'Failed to fetch outlet payments', error: pspError.message });
        }

        const orderIds = [...new Set((pspData || []).map((p: any) => p.order_id).filter(Boolean))];
        const { data: outletOrders } = orderIds.length
          ? await supabase
              .from('pos_shift_orders')
              .select('id, order_number, short_code, customer_name, status, payment_status, total_amount, amount_paid, created_by, created_at')
              .in('id', orderIds)
          : { data: [] as any[] };
        const orderMap = Object.fromEntries((outletOrders || []).map((order: any) => [String(order.id), order]));

        posShiftPaymentRecords = (pspData || []).map((payment: any) => {
          const outlet = outletMap[String(payment.outlet_id)] || {};
          const order = orderMap[String(payment.order_id)] || {};
          const reference = payment.reference || payment.short_code || order.short_code || order.order_number || payment.id;
          return {
            id: payment.id,
            branch_id: outlet.branch_id,
            amount: Number(payment.amount || 0),
            payment_method: payment.payment_method,
            reference_number: reference,
            customer_name: order.customer_name || `${outlet.name || 'POS Outlet'}${order.order_number ? ` - ${order.order_number}` : ''}`,
            bill_reference: order.order_number || order.short_code || null,
            recorded_by: payment.received_by || order.created_by,
            recorded_at: payment.created_at,
            recorder_notes: outlet.name ? `${outlet.name} outlet payment` : 'Outlet POS payment',
            status: 'auditor_verified',
            _source: 'pos',
            _sub_source: 'pos_shift_payment',
            _transaction_date: payment.created_at,
            _outlet_name: outlet.name,
            _outlet_type: outlet.outlet_type,
            _order_status: order.status,
            _payment_status: order.payment_status,
          };
        });
      }

      // ── 6. cashier_shift_transactions not already represented above ────
      let cashierShiftRecords: any[] = [];
      let cstQuery = supabase
        .from('cashier_shift_transactions')
        .select('id, shift_id, transaction_id, transaction_ref, payment_method, amount, transaction_time, created_at')
        .order('transaction_time', { ascending: false });
      if (payment_method) cstQuery = cstQuery.eq('payment_method', payment_method);
      if (start_date) cstQuery = cstQuery.gte('transaction_time', `${start_date}T00:00:00`);
      if (endOfDay) cstQuery = cstQuery.lte('transaction_time', endOfDay);
      if (itemsLimit) cstQuery = cstQuery.limit(itemsLimit);
      const { data: cstData } = await cstQuery;
      if (cstData && cstData.length > 0) {
        const shiftIds = [...new Set(cstData.map((t: any) => t.shift_id).filter(Boolean))];
        const { data: shifts } = shiftIds.length
          ? await supabase
              .from('cashier_shift_logs')
              .select('id, branch_id, cashier_id, cashier_name, shift_number')
              .in('id', shiftIds)
          : { data: [] as any[] };
        const shiftMap = Object.fromEntries((shifts || []).map((shift: any) => [String(shift.id), shift]));
        const duplicateTransactionIds = new Set([
          ...(payData || []).map((p: any) => String(p.id)),
          ...(posData || []).map((p: any) => String(p.id)),
        ]);
        cashierShiftRecords = cstData
          .filter((transaction: any) => !transaction.transaction_id || !duplicateTransactionIds.has(String(transaction.transaction_id)))
          .map((transaction: any) => {
            const shift = shiftMap[String(transaction.shift_id)] || {};
            return {
              id: transaction.id,
              branch_id: shift.branch_id,
              amount: Number(transaction.amount || 0),
              payment_method: transaction.payment_method,
              reference_number: transaction.transaction_ref || transaction.transaction_id,
              customer_name: shift.shift_number ? `Cashier shift ${shift.shift_number}` : 'Cashier shift payment',
              recorded_by: shift.cashier_id,
              recorded_at: transaction.transaction_time || transaction.created_at,
              recorder_notes: shift.cashier_name ? `Recorded by ${shift.cashier_name}` : 'Cashier shift transaction',
              status: 'auditor_verified',
              _source: 'payment',
              _sub_source: 'cashier_shift_transaction',
              _transaction_date: transaction.transaction_time || transaction.created_at,
            };
          })
          .filter((transaction: any) => !branchScope || String(transaction.branch_id) === branchScope);
      }

      // ── 7. Merge all sources and filter by status locally ────────────────
      let allPayments = [
        ...pvRecords,
        ...bankingRecords,
        ...rawPayments,
        ...posRecords,
        ...posShiftPaymentRecords,
        ...cashierShiftRecords,
      ];

      if (status) {
        allPayments = allPayments.filter(p => p.status === (status as string).toLowerCase());
      }

      // Sort combined results by date descending
      allPayments.sort((a: any, b: any) =>
        new Date(b.recorded_at || b._transaction_date || 0).getTime() -
        new Date(a.recorded_at || a._transaction_date || 0).getTime()
      );

      // Apply limit if provided to final result
      if (itemsLimit) {
        allPayments = allPayments.slice(0, itemsLimit);
      }

      // ── 8. Enrich with user + branch info ───────────────────────────────
      const userIds = new Set<string>();
      const branchIds = new Set<any>();
      allPayments.forEach((p: any) => {
        if (p.recorded_by) userIds.add(p.recorded_by);
        if (p.accountant_verified_by) userIds.add(p.accountant_verified_by);
        if (p.auditor_verified_by) userIds.add(p.auditor_verified_by);
        if (p.branch_id) branchIds.add(p.branch_id);
      });

      const usersMap = new Map();
      if (userIds.size > 0) {
        const { data: users , error } = await supabase.from('users').select('id, first_name, last_name, role, email').in('id', Array.from(userIds));
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
        users?.forEach((u: any) => usersMap.set(u.id, { id: u.id, full_name: `${u.first_name} ${u.last_name}`.trim(), role: u.role, email: u.email }));
      }

      const branchesMap = new Map();
      if (branchIds.size > 0) {
        const { data: branches , error } = await supabase.from('branches').select('id, name, location').in('id', Array.from(branchIds));
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
        branches?.forEach((b: any) => branchesMap.set(b.id, b));
      }

      const enriched = allPayments.map((p: any) => ({
        ...p,
        recorded_by_user: p.recorded_by ? usersMap.get(p.recorded_by) : null,
        accountant_verified_by_user: p.accountant_verified_by ? usersMap.get(p.accountant_verified_by) : null,
        auditor_verified_by_user: p.auditor_verified_by ? usersMap.get(p.auditor_verified_by) : null,
        branch: p.branch_id ? branchesMap.get(p.branch_id) : null,
      }));

      return res.json({ success: true, data: enriched });
    } catch (error: any) {
      console.error('Error in getPayments:', error);
      return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }

  // Get single payment by ID
  async getPaymentById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      // Try payment_verifications first
      const { data: pvPayment } = await supabase
        .from('payment_verifications')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (pvPayment) {
        return res.json({ success: true, data: await this._enrichPayment(pvPayment, 'payment_verification') });
      }

      // Try banking_transactions
      const { data: bt } = await supabase
        .from('banking_transactions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (bt) {
        const mapped = {
          id: bt.id,
          branch_id: bt.branch_id,
          amount: bt.amount,
          payment_method: bt.payment_method || bt.transaction_type,
          reference_number: bt.reference_number,
          customer_name: bt.purpose_description || bt.bank_name,
          recorded_by: bt.recorded_by,
          recorded_at: bt.created_at || bt.transaction_date,
          recorder_notes: bt.notes,
          status: bt.status?.toLowerCase() === 'approved' ? 'auditor_verified'
                : bt.status?.toLowerCase() === 'rejected' ? 'flagged' : 'pending',
          accountant_verified_by: bt.approved_by,
          accountant_verified_at: bt.approved_at,
          _source: 'banking',
          _banking_type: bt.transaction_type,
          _bank_name: bt.bank_name,
          _transaction_date: bt.transaction_date,
        };
        return res.json({ success: true, data: await this._enrichPayment(mapped, 'banking') });
      }

      // Try payments table
      const { data: pay } = await supabase
        .from('payments')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (pay) {
        // payments table has no cashier_id — try shift lookup then metadata fallback
        let cashierId = pay.recorded_by || pay.cashier_id || pay.metadata?.cashier_id || null;
        if (!cashierId) {
          const { data: st } = await supabase
            .from('cashier_shift_transactions')
            .select('shift_id')
            .eq('transaction_id', pay.id)
            .maybeSingle();
          if (st?.shift_id) {
            const { data: shift } = await supabase
              .from('cashier_shift_logs')
              .select('cashier_id')
              .eq('id', st.shift_id)
              .maybeSingle();
            cashierId = shift?.cashier_id || null;
          }
        }
        const normalized = {
          ...pay,
          _source: 'payment',
          recorded_at: pay.recorded_at || pay.created_at,
          recorded_by: cashierId,
          reference_number: pay.reference_number || pay.reference,
          customer_name: pay.customer_name || pay.notes,
        };
        return res.json({ success: true, data: await this._enrichPayment(normalized, 'payment') });
      }

      // Try pos_transactions
      const { data: pos } = await supabase
        .from('pos_transactions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (pos) {
        const mapped = {
          id: pos.id,
          branch_id: pos.branch_id,
          amount: pos.amount,
          payment_method: pos.payment_method,
          reference_number: pos.transaction_ref,
          customer_name: pos.customer_name,
          recorded_by: pos.cashier_id,
          recorded_at: pos.created_at || pos.transaction_date,
          status: pos.status || 'completed',
          _source: 'pos',
        };
        return res.json({ success: true, data: await this._enrichPayment(mapped, 'pos') });
      }

      return res.status(404).json({ success: false, message: 'Payment not found' });
    } catch (error: any) {
      console.error('Error in getPaymentById:', error);
      return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }

  private async _enrichPayment(payment: any, _source: string) {
    const userIds = [payment.recorded_by, payment.accountant_verified_by, payment.auditor_verified_by].filter(Boolean);
    const usersMap = new Map();
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, first_name, last_name, role, email')
        .in('id', userIds);
      users?.forEach((u: any) => usersMap.set(u.id, {
        id: u.id,
        full_name: `${u.first_name} ${u.last_name}`.trim(),
        role: u.role,
        email: u.email
      }));
    }

    let branch = null;
    if (payment.branch_id) {
      const { data: branchData } = await supabase
        .from('branches')
        .select('id, name, location')
        .eq('id', payment.branch_id)
        .single();
      branch = branchData;
    }

    return {
      ...payment,
      recorded_by_user: payment.recorded_by ? usersMap.get(payment.recorded_by) : null,
      accountant_verified_by_user: payment.accountant_verified_by ? usersMap.get(payment.accountant_verified_by) : null,
      auditor_verified_by_user: payment.auditor_verified_by ? usersMap.get(payment.auditor_verified_by) : null,
      branch,
    };
  }

  // Create new payment
  async createPayment(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userBranchId = req.user?.branch_id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const {
        branch_id,
        amount,
        payment_method,
        reference_number,
        customer_name,
        bill_reference,
        bill_id,
        recorder_notes
      } = req.body;

      // Validate required fields
      if (!amount || !payment_method) {
        return res.status(400).json({ success: false, message: 'Amount and payment method are required' });
      }

      // Use user's branch if not specified
      const isGlobal = isGlobalRole(req.user?.role);
      const finalBranchId = isGlobal && branch_id ? branch_id : userBranchId;

      if (!finalBranchId) {
        return res.status(400).json({ success: false, message: 'Branch ID is required' });
      }

      const { data, error } = await supabase
        .from('payment_verifications')
        .insert({
          branch_id: finalBranchId,
          amount,
          payment_method,
          reference_number,
          customer_name,
          bill_reference,
          bill_id,
          recorder_notes,
          recorded_by: userId,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating payment:', error);
        return res.status(500).json({ success: false, message: 'Failed to create payment', error: error.message });
      }

      return res.status(201).json({ success: true, data, message: 'Payment recorded successfully' });
    } catch (error: any) {
      console.error('Error in createPayment:', error);
      return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }

  // Branch Accountant verifies payment
  async verifyByAccountant(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { accountant_notes } = req.body;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      // Check if payment exists and is pending
      const { data: payment, error: fetchError } = await supabase
        .from('payment_verifications')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !payment) {
        return res.status(404).json({ success: false, message: 'Payment not found' });
      }

      if (payment.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Payment has already been processed' });
      }

      // Update payment with accountant verification
      const { data, error } = await supabase
        .from('payment_verifications')
        .update({
          accountant_verified_by: userId,
          accountant_verified_at: new Date().toISOString(),
          accountant_notes,
          status: 'accountant_verified',
          auditor_status: 'pending'
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error verifying payment:', error);
        return res.status(500).json({ success: false, message: 'Failed to verify payment', error: error.message });
      }

      return res.json({ success: true, data, message: 'Payment verified and sent to auditor' });
    } catch (error: any) {
      console.error('Error in verifyByAccountant:', error);
      return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }

  // Auditor verifies payment
  async verifyByAuditor(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { auditor_notes, auditor_status } = req.body;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      if (!auditor_status || !['approved', 'flagged'].includes(auditor_status)) {
        return res.status(400).json({ success: false, message: 'Valid auditor status is required (approved or flagged)' });
      }

      // Check if payment exists and is accountant verified
      const { data: payment, error: fetchError } = await supabase
        .from('payment_verifications')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !payment) {
        return res.status(404).json({ success: false, message: 'Payment not found' });
      }

      if (payment.status !== 'accountant_verified') {
        return res.status(400).json({ success: false, message: 'Payment must be verified by accountant first' });
      }

      // Update payment with auditor verification
      const { data, error } = await supabase
        .from('payment_verifications')
        .update({
          auditor_verified_by: userId,
          auditor_verified_at: new Date().toISOString(),
          auditor_notes,
          auditor_status,
          status: auditor_status === 'approved' ? 'auditor_verified' : 'flagged'
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error auditor verification:', error);
        return res.status(500).json({ success: false, message: 'Failed to verify payment', error: error.message });
      }

      return res.json({ 
        success: true, 
        data, 
        message: auditor_status === 'approved' ? 'Payment approved by auditor' : 'Payment flagged for review' 
      });
    } catch (error: any) {
      console.error('Error in verifyByAuditor:', error);
      return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }

  // Get payment statistics (includes all sources)
  async getPaymentStats(req: Request, res: Response) {
    try {
      const { branch_id, start_date, end_date } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      const branchScope = resolvePaymentBranchScope(req, branch_id);

      // payment_verifications
      let pvQuery = supabase.from('payment_verifications').select('amount, status, payment_method');
      pvQuery = applyBranchFilter(pvQuery, req);
      if (branch_id) pvQuery = pvQuery.eq('branch_id', branch_id);
      if (start_date) pvQuery = pvQuery.gte('recorded_at', start_date as string);
      if (end_date)   pvQuery = pvQuery.lte('recorded_at', `${end_date}T23:59:59.999Z`);
      const { data: pvData, error: pvError } = await pvQuery;
      if (pvError) return res.status(500).json({ success: false, message: 'Failed to fetch stats', error: pvError.message });

      // banking_transactions
      let btQuery = supabase.from('banking_transactions').select('amount, status');
      btQuery = applyBranchFilter(btQuery, req);
      if (branch_id) btQuery = btQuery.eq('branch_id', branch_id);
      if (start_date) btQuery = btQuery.gte('transaction_date', start_date as string);
      if (end_date)   btQuery = btQuery.lte('transaction_date', end_date as string);
      const { data: btData } = await btQuery;

      // pos_transactions
      let posQuery = supabase.from('pos_transactions').select('id, total_amount, status');
      posQuery = applyBranchFilter(posQuery, req);
      if (branch_id) posQuery = posQuery.eq('branch_id', branch_id);
      if (start_date) posQuery = posQuery.gte('created_at', `${start_date}T00:00:00`);
      if (end_date)   posQuery = posQuery.lte('created_at', `${end_date}T23:59:59`);
      const { data: posData } = await posQuery;

      // Current outlet POS payments
      let posShiftPayments: any[] = [];
      let outletQuery = supabase
        .from('pos_outlets')
        .select('id, branch_id');
      if (branchScope) outletQuery = outletQuery.eq('branch_id', branchScope);
      const { data: outlets } = await outletQuery;
      const outletIds = (outlets || []).map((outlet: any) => outlet.id).filter(Boolean);
      if (outletIds.length > 0) {
        let pspQuery = supabase
          .from('pos_shift_payments')
          .select('amount, payment_method, created_at, outlet_id')
          .in('outlet_id', outletIds);
        if (start_date) pspQuery = pspQuery.gte('created_at', `${start_date}T00:00:00`);
        if (end_date)   pspQuery = pspQuery.lte('created_at', `${end_date}T23:59:59`);
        const { data } = await pspQuery;
        posShiftPayments = data || [];
      }

      // Cashier shift transactions not represented in payments/pos_transactions.
      let cashierShiftPayments: any[] = [];
      {
        let cstQuery = supabase
          .from('cashier_shift_transactions')
          .select('id, shift_id, transaction_id, amount, payment_method, transaction_time');
        if (start_date) cstQuery = cstQuery.gte('transaction_time', `${start_date}T00:00:00`);
        if (end_date)   cstQuery = cstQuery.lte('transaction_time', `${end_date}T23:59:59`);
        const { data: cstData } = await cstQuery;
        if (cstData && cstData.length > 0) {
          const shiftIds = [...new Set(cstData.map((t: any) => t.shift_id).filter(Boolean))];
          const { data: shifts } = shiftIds.length
            ? await supabase
                .from('cashier_shift_logs')
                .select('id, branch_id')
                .in('id', shiftIds)
            : { data: [] as any[] };
          const shiftMap = Object.fromEntries((shifts || []).map((shift: any) => [String(shift.id), shift]));
          const duplicateIds = new Set([
            ...(posData || []).map((p: any) => String(p.id)),
          ]);
          cashierShiftPayments = cstData
            .filter((transaction: any) => !transaction.transaction_id || !duplicateIds.has(String(transaction.transaction_id)))
            .filter((transaction: any) => {
              const shift = shiftMap[String(transaction.shift_id)] || {};
              return !branchScope || String(shift.branch_id) === branchScope;
            });
        }
      }

      // payments table — fetch and infer branch
      let payCount = 0;
      let payTotal = 0;
      {
        let payQuery = supabase.from('payments').select('id, amount, branch_id, booking_id, restaurant_order_id, bar_order_id, pos_transaction_id');
        if (start_date) payQuery = payQuery.gte('created_at', `${start_date}T00:00:00`);
        if (end_date)   payQuery = payQuery.lte('created_at', `${end_date}T23:59:59`);
        const { data: payData } = await payQuery;

        if (payData && payData.length > 0) {
          const targetBranch = branchScope;
          const hasTargetBranch = !!targetBranch;

          const bookingIds   = [...new Set(payData.map((p: any) => p.booking_id).filter(Boolean))];
          const restOrderIds = [...new Set(payData.map((p: any) => p.restaurant_order_id).filter(Boolean))];
          const barOrderIds  = [...new Set(payData.map((p: any) => p.bar_order_id).filter(Boolean))];
          const posIds       = [...new Set(payData.map((p: any) => p.pos_transaction_id).filter(Boolean))];

          const [{ data: bookings }, { data: restOrders }, { data: barOrders }, { data: posTxns }] = await Promise.all([
            bookingIds.length   ? supabase.from('reservations').select('id, branch_id').in('id', bookingIds) : { data: [] },
            restOrderIds.length ? supabase.from('restaurant_orders').select('id, branch_id').in('id', restOrderIds) : { data: [] },
            barOrderIds.length  ? supabase.from('bar_orders').select('id, branch_id').in('id', barOrderIds) : { data: [] },
            posIds.length       ? supabase.from('pos_transactions').select('id, branch_id').in('id', posIds) : { data: [] },
          ]);

          const bMap = Object.fromEntries((bookings || []).map((b: any) => [b.id, b.branch_id]));
          const rMap = Object.fromEntries((restOrders || []).map((o: any) => [o.id, o.branch_id]));
          const aMap = Object.fromEntries((barOrders || []).map((o: any) => [o.id, o.branch_id]));
          const pMap = Object.fromEntries((posTxns || []).map((p: any) => [p.id, p.branch_id]));

          const filtered = payData.filter((p: any) => {
            const bid = p.branch_id || (p.booking_id ? bMap[p.booking_id] : (p.restaurant_order_id ? rMap[p.restaurant_order_id] : (p.bar_order_id ? aMap[p.bar_order_id] : (p.pos_transaction_id ? pMap[p.pos_transaction_id] : null))));
            if (!hasTargetBranch) return true;
            return String(bid) === targetBranch;
          });
          payCount = filtered.length;
          payTotal = filtered.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0);
        } else if (payData) {
          payCount = payData.length;
          payTotal = payData.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0);
        }
      }

      const pv = pvData || [];
      const bt = (btData || []).map((b: any) => ({
        amount: b.amount,
        status: b.status?.toLowerCase() === 'approved' ? 'auditor_verified' : b.status?.toLowerCase() === 'rejected' ? 'flagged' : 'pending'
      }));
      const legacyPosRows = posData || [];
      const pos = legacyPosRows.map((p: any) => ({ amount: p.total_amount || p.amount || 0, status: 'auditor_verified' }));
      const outletPos = posShiftPayments.map((p: any) => ({ amount: p.amount, status: 'auditor_verified' }));
      const cashierShift = cashierShiftPayments.map((p: any) => ({ amount: p.amount, status: 'auditor_verified' }));

      const all = [...pv, ...bt, ...pos, ...outletPos, ...cashierShift];
      const posTotal = pos.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0)
        + outletPos.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0);
      const cashierShiftTotal = cashierShift.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0);

      const stats = {
        total_payments: all.length + payCount,
        total_amount: all.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) + payTotal,
        pending: all.filter(p => p.status === 'pending').length,
        accountant_verified: pv.filter(p => p.status === 'accountant_verified').length,
        auditor_verified: all.filter(p => p.status === 'auditor_verified').length + payCount,
        flagged: all.filter(p => p.status === 'flagged').length,
        banking_total: (btData || []).reduce((sum: number, b: any) => sum + parseFloat(b.amount || 0), 0),
        pos_total: posTotal,
        payments_total: payTotal + cashierShiftTotal,
        outlet_pos_total: outletPos.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0),
        cashier_shift_total: cashierShiftTotal,
      };

      return res.json({ success: true, data: stats });
    } catch (error: any) {
      console.error('Error in getPaymentStats:', error);
      return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }
}
