import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export class PaymentsController {
  // Get all payments for a branch with filters
  async getPayments(req: Request, res: Response) {
    try {
      const { branch_id, status, payment_method, start_date, end_date } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      let query = supabase
        .from('payment_verifications')
        .select('*')
        .order('recorded_at', { ascending: false });

      // Apply filters
      if (branch_id) {
        query = query.eq('branch_id', branch_id);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (payment_method) {
        query = query.eq('payment_method', payment_method);
      }

      if (start_date) {
        query = query.gte('recorded_at', start_date);
      }

      if (end_date) {
        query = query.lte('recorded_at', end_date);
      }

      const { data: payments, error } = await query;

      if (error) {
        console.error('Error fetching payments:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch payments', error: error.message });
      }

      // Manually fetch related user and branch data
      const userIds = new Set<string>();
      const branchIds = new Set<number>();

      payments.forEach((payment: any) => {
        if (payment.recorded_by) userIds.add(payment.recorded_by);
        if (payment.accountant_verified_by) userIds.add(payment.accountant_verified_by);
        if (payment.auditor_verified_by) userIds.add(payment.auditor_verified_by);
        if (payment.branch_id) branchIds.add(payment.branch_id);
      });

      // Fetch users
      const usersMap = new Map();
      if (userIds.size > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, first_name, last_name, role, email')
          .in('id', Array.from(userIds));
        
        users?.forEach((user: any) => {
          usersMap.set(user.id, {
            id: user.id,
            full_name: `${user.first_name} ${user.last_name}`.trim(),
            role: user.role,
            email: user.email
          });
        });
      }

      // Fetch branches
      const branchesMap = new Map();
      if (branchIds.size > 0) {
        const { data: branches } = await supabase
          .from('branches')
          .select('id, name, location')
          .in('id', Array.from(branchIds));
        
        branches?.forEach((branch: any) => {
          branchesMap.set(branch.id, branch);
        });
      }

      // Enrich payments with related data
      const enrichedPayments = payments.map((payment: any) => ({
        ...payment,
        recorded_by_user: payment.recorded_by ? usersMap.get(payment.recorded_by) : null,
        accountant_verified_by_user: payment.accountant_verified_by ? usersMap.get(payment.accountant_verified_by) : null,
        auditor_verified_by_user: payment.auditor_verified_by ? usersMap.get(payment.auditor_verified_by) : null,
        branch: payment.branch_id ? branchesMap.get(payment.branch_id) : null
      }));

      return res.json({ success: true, data: enrichedPayments });
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

      const { data: payment, error } = await supabase
        .from('payment_verifications')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching payment:', error);
        return res.status(404).json({ success: false, message: 'Payment not found', error: error.message });
      }

      // Fetch related data
      const userIds = [payment.recorded_by, payment.accountant_verified_by, payment.auditor_verified_by].filter(Boolean);
      
      const usersMap = new Map();
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, first_name, last_name, role, email')
          .in('id', userIds);
        
        users?.forEach((user: any) => {
          usersMap.set(user.id, {
            id: user.id,
            full_name: `${user.first_name} ${user.last_name}`.trim(),
            role: user.role,
            email: user.email
          });
        });
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

      const enrichedPayment = {
        ...payment,
        recorded_by_user: payment.recorded_by ? usersMap.get(payment.recorded_by) : null,
        accountant_verified_by_user: payment.accountant_verified_by ? usersMap.get(payment.accountant_verified_by) : null,
        auditor_verified_by_user: payment.auditor_verified_by ? usersMap.get(payment.auditor_verified_by) : null,
        branch
      };

      return res.json({ success: true, data: enrichedPayment });
    } catch (error: any) {
      console.error('Error in getPaymentById:', error);
      return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
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

  // Get payment statistics
  async getPaymentStats(req: Request, res: Response) {
    try {
      const { branch_id, start_date, end_date } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      let query = supabase.from('payment_verifications').select('*');

      if (branch_id) {
        query = query.eq('branch_id', branch_id);
      }

      if (start_date) {
        query = query.gte('recorded_at', start_date);
      }

      if (end_date) {
        query = query.lte('recorded_at', end_date);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching payment stats:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
      }

      // Calculate statistics
      const stats = {
        total_payments: data.length,
        total_amount: data.reduce((sum, p) => sum + parseFloat(p.amount), 0),
        pending: data.filter(p => p.status === 'pending').length,
        accountant_verified: data.filter(p => p.status === 'accountant_verified').length,
        auditor_verified: data.filter(p => p.status === 'auditor_verified').length,
        flagged: data.filter(p => p.status === 'flagged').length,
        by_payment_method: data.reduce((acc: any, p) => {
          acc[p.payment_method] = (acc[p.payment_method] || 0) + 1;
          return acc;
        }, {})
      };

      return res.json({ success: true, data: stats });
    } catch (error: any) {
      console.error('Error in getPaymentStats:', error);
      return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }
}
