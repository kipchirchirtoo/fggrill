import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

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

      // ── 1. payment_verifications ────────────────────────────────────────
      let pvQuery = supabase.from('payment_verifications').select('*').order('recorded_at', { ascending: false });
      if (branch_id) pvQuery = pvQuery.eq('branch_id', branch_id);
      if (status)    pvQuery = pvQuery.eq('status', status);
      if (payment_method) pvQuery = pvQuery.eq('payment_method', payment_method);
      if (start_date) pvQuery = pvQuery.gte('recorded_at', start_date as string);
      if (endOfDay)   pvQuery = pvQuery.lte('recorded_at', endOfDay);
      if (itemsLimit) pvQuery = pvQuery.limit(itemsLimit);

      const { data: pvData, error: pvError } = await pvQuery;
      if (pvError) {
        console.error('Error fetching payment_verifications:', pvError);
        return res.status(500).json({ success: false, message: 'Failed to fetch payments', error: pvError.message });
      }
      const pvRecords = (pvData || []).map((p: any) => ({ ...p, _source: 'payment_verification' }));

      // ── 2. banking_transactions ─────────────────────────────────────────
      let bankingRecords: any[] = [];
      if (!status) { // banking has no status filter equivalent
        let btQuery = supabase.from('banking_transactions').select('*').order('transaction_date', { ascending: false });
        if (branch_id) btQuery = btQuery.eq('branch_id', branch_id);
        if (start_date) btQuery = btQuery.gte('transaction_date', start_date as string);
        if (end_date)   btQuery = btQuery.lte('transaction_date', end_date as string);
        if (itemsLimit) btQuery = btQuery.limit(itemsLimit);
        const { data: btData } = await btQuery;
        bankingRecords = (btData || []).map((bt: any) => ({
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
      }

      // ── 3. payments table (branch inferred via related orders) ──────────
      let rawPayments: any[] = [];
      if (!status) {
        let payQuery = supabase.from('payments').select('*').order('created_at', { ascending: false });
        if (start_date) payQuery = payQuery.gte('created_at', `${start_date}T00:00:00`);
        if (end_date)   payQuery = payQuery.lte('created_at', `${end_date}T23:59:59`);
        if (itemsLimit) payQuery = payQuery.limit(itemsLimit);
        const { data: payData } = await payQuery;

        if (payData && payData.length > 0) {
          // Collect related IDs for branch inference
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

          // payments table has no cashier_id — look it up via cashier_shift_transactions → cashier_shift_logs
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
              if (p.booking_id && bookingMap[p.booking_id])               inferredBranchId = bookingMap[p.booking_id].branch_id;
              else if (p.restaurant_order_id && restOrderMap[p.restaurant_order_id]) inferredBranchId = restOrderMap[p.restaurant_order_id].branch_id;
              else if (p.bar_order_id && barOrderMap[p.bar_order_id])     inferredBranchId = barOrderMap[p.bar_order_id].branch_id;
              else if (p.pos_transaction_id && posMap[p.pos_transaction_id]) inferredBranchId = posMap[p.pos_transaction_id].branch_id;
              return {
                ...p,
                branch_id: inferredBranchId,
                _source: 'payment',
                recorded_at: p.recorded_at || p.created_at,
                // Try: recorded_by → cashier_id column → shift lookup result → metadata.cashier_id
                recorded_by: p.recorded_by || p.cashier_id || cashierByPaymentId[p.id] || p.metadata?.cashier_id || null,
                reference_number: p.reference_number || p.reference,
                customer_name: p.customer_name || p.notes,
              };
            })
            .filter((p: any) => !branch_id || String(p.branch_id) === String(branch_id));
        }
      }

      // ── 4. pos_transactions ─────────────────────────────────────────────
      let posRecords: any[] = [];
      if (!status) {
        let posQuery = supabase.from('pos_transactions').select('*').order('created_at', { ascending: false });
        if (branch_id) posQuery = posQuery.eq('branch_id', branch_id);
        if (start_date) posQuery = posQuery.gte('created_at', `${start_date}T00:00:00`);
        if (end_date)   posQuery = posQuery.lte('created_at', `${end_date}T23:59:59`);
        if (itemsLimit) posQuery = posQuery.limit(itemsLimit);
        const { data: posData } = await posQuery;
        posRecords = (posData || []).map((pos: any) => ({
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
          _transaction_date: pos.transaction_date || pos.created_at,
        }));
      }

      // ── 5. Merge all sources ────────────────────────────────────────────
      let allPayments = [...pvRecords, ...bankingRecords, ...rawPayments, ...posRecords];

      // Sort combined results by date descending
      allPayments.sort((a: any, b: any) =>
        new Date(b.recorded_at || b._transaction_date || 0).getTime() -
        new Date(a.recorded_at || a._transaction_date || 0).getTime()
      );

      // Apply limit if provided to final result
      if (itemsLimit) {
        allPayments = allPayments.slice(0, itemsLimit);
      }

      // ── 6. Enrich with user + branch info ───────────────────────────────
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
        const { data: users } = await supabase.from('users').select('id, first_name, last_name, role, email').in('id', Array.from(userIds));
        users?.forEach((u: any) => usersMap.set(u.id, { id: u.id, full_name: `${u.first_name} ${u.last_name}`.trim(), role: u.role, email: u.email }));
      }

      const branchesMap = new Map();
      if (branchIds.size > 0) {
        const { data: branches } = await supabase.from('branches').select('id, name, location').in('id', Array.from(branchIds));
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
      const finalBranchId = branch_id || userBranchId;

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

      // payment_verifications
      let pvQuery = supabase.from('payment_verifications').select('amount, status, payment_method');
      if (branch_id) pvQuery = pvQuery.eq('branch_id', branch_id);
      if (start_date) pvQuery = pvQuery.gte('recorded_at', start_date as string);
      if (end_date)   pvQuery = pvQuery.lte('recorded_at', `${end_date}T23:59:59.999Z`);
      const { data: pvData, error: pvError } = await pvQuery;
      if (pvError) return res.status(500).json({ success: false, message: 'Failed to fetch stats', error: pvError.message });

      // banking_transactions
      let btQuery = supabase.from('banking_transactions').select('amount, status');
      if (branch_id) btQuery = btQuery.eq('branch_id', branch_id);
      if (start_date) btQuery = btQuery.gte('transaction_date', start_date as string);
      if (end_date)   btQuery = btQuery.lte('transaction_date', end_date as string);
      const { data: btData } = await btQuery;

      // pos_transactions
      let posQuery = supabase.from('pos_transactions').select('amount, status');
      if (branch_id) posQuery = posQuery.eq('branch_id', branch_id);
      if (start_date) posQuery = posQuery.gte('created_at', `${start_date}T00:00:00`);
      if (end_date)   posQuery = posQuery.lte('created_at', `${end_date}T23:59:59`);
      const { data: posData } = await posQuery;

      // payments table — fetch and infer branch
      let payCount = 0;
      let payTotal = 0;
      {
        let payQuery = supabase.from('payments').select('id, amount, booking_id, restaurant_order_id, bar_order_id, pos_transaction_id');
        if (start_date) payQuery = payQuery.gte('created_at', `${start_date}T00:00:00`);
        if (end_date)   payQuery = payQuery.lte('created_at', `${end_date}T23:59:59`);
        const { data: payData } = await payQuery;

        if (payData && payData.length > 0 && branch_id) {
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
            const bid = p.booking_id ? bMap[p.booking_id] : (p.restaurant_order_id ? rMap[p.restaurant_order_id] : (p.bar_order_id ? aMap[p.bar_order_id] : (p.pos_transaction_id ? pMap[p.pos_transaction_id] : null)));
            return String(bid) === String(branch_id);
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
      const pos = (posData || []).map((p: any) => ({ amount: p.amount, status: p.status || 'completed' }));

      const all = [...pv, ...bt, ...pos];

      const stats = {
        total_payments: all.length + payCount,
        total_amount: all.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) + payTotal,
        pending: all.filter(p => p.status === 'pending').length,
        accountant_verified: pv.filter(p => p.status === 'accountant_verified').length,
        auditor_verified: all.filter(p => p.status === 'auditor_verified').length,
        flagged: all.filter(p => p.status === 'flagged').length,
        banking_total: (btData || []).reduce((sum: number, b: any) => sum + parseFloat(b.amount || 0), 0),
        pos_total: (posData || []).reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0),
        payments_total: payTotal,
      };

      return res.json({ success: true, data: stats });
    } catch (error: any) {
      console.error('Error in getPaymentStats:', error);
      return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }
}
