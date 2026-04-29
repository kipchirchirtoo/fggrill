import { Request, Response } from 'express';
import { supabase } from '../config/database';

export class DiscrepancyController {
  
  /**
   * Get all flags with optional filters
   */
  static async getFlags(req: Request, res: Response) {
    try {
      const { status, branch_id, severity } = req.query;

      let query = supabase
        .from('discrepancy_flags')
        .select('*, branches(name), auditor:auditor_id(first_name, last_name), accountant:accountant_id(first_name, last_name)')
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (branch_id) query = query.eq('branch_id', branch_id);
      if (severity) query = query.eq('severity', severity);

      const { data, error } = await query;
      
      if (error && error.code === 'PGRST116') {
        return res.status(200).json({ 
          success: true, 
          data: [],
          message: 'Discrepancy flags table not found. Please run migrations.'
        });
      }
      
      if (error) throw error;

      return res.status(200).json({ success: true, data: data || [] });
    } catch (error: any) {
      console.error('Get Flags Error:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message,
        data: []
      });
    }
  }

  /**
   * Create a manual flag (Auditors or Directors)
   */
  static async createFlag(req: Request, res: Response) {
    try {
      const { branch_id, record_date, flag_type, severity, description, metadata } = req.body;
      const userId = (req as any).user.id;

      const { data, error } = await supabase
        .from('discrepancy_flags')
        .insert([{
          branch_id,
          record_date,
          flag_type,
          severity,
          description,
          metadata,
          auditor_id: userId, // Assuming auditor creates it
          status: 'PENDING'
        }])
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ success: true, data });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Respond to a flag (Accountants)
   */
  static async respondToFlag(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { response } = req.body;
      const userId = (req as any).user.id;

      const { data, error } = await supabase
        .from('discrepancy_flags')
        .update({
          accountant_response: response,
          accountant_id: userId,
          status: 'UNDER_REVIEW',
          updated_at: new Date()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Final decision on a flag (Directors)
   */
  static async finalizeFlag(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { decision, status } = req.body; // status: 'RESOLVED' or 'ESCALATED'
      const userId = (req as any).user.id;

      const { data, error } = await supabase
        .from('discrepancy_flags')
        .update({
          director_final_decision: decision,
          director_id: userId,
          status,
          updated_at: new Date()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Automatic Discrepancy Detection (Helper called by jobs or hooks)
   */
  static async runAutoDetection(recordId: string) {
    const { data: record, error } = await supabase
      .from('daily_financial_records')
      .select('*')
      .eq('id', recordId)
      .single();

    if (error || !record) return;

    const flags = [];

    // 1. Payment Mismatch
    if (Math.abs(Number(record.total_payments) - Number(record.total_revenue)) > 1) {
        flags.push({
            branch_id: record.branch_id,
            record_date: record.record_date,
            flag_type: 'PAYMENT_MISMATCH',
            severity: 'HIGH',
            description: `Total revenue (${record.total_revenue}) does not match total payments (${record.total_payments}).`,
            metadata: { revenue: record.total_revenue, payments: record.total_payments }
        });
    }

    // 2. Cash Variance
    if (Math.abs(Number(record.unbanked_cash)) > 100) {
        flags.push({
            branch_id: record.branch_id,
            record_date: record.record_date,
            flag_type: 'CASH_VARIANCE',
            severity: Number(record.unbanked_cash) > 5000 ? 'CRITICAL' : 'MEDIUM',
            description: `Unbanked cash variance detected: ${record.unbanked_cash}.`,
            metadata: { unbanked: record.unbanked_cash }
        });
    }

    if (flags.length > 0) {
        await supabase.from('discrepancy_flags').insert(flags);
    }
  }
}
