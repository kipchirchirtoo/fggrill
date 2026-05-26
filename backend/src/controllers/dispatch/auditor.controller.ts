/**
 * Auditor Controller
 * Handles auditor review of deliveries
 */

import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';

/**
 * Get all deliveries for auditor review
 * GET /api/auditor/deliveries
 */
export const getAuditorDeliveries = async (req: Request, res: Response) => {
  try {
    const { status, branch_id, date_from, date_to } = req.query;

    let query = supabase
      .from('dispatches')
      .select(`
        *,
        dispatch_items(count),
        dispatch_documents(count)
      `)
      .in('status', ['completed', 'audited', 'flagged'])
      .order('completed_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (branch_id) {
      query = query.eq('destination_branch', branch_id);
    }

    if (date_from) {
      query = query.gte('completed_at', date_from);
    }

    if (date_to) {
      query = query.lte('completed_at', date_to);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ error: 'Failed to fetch deliveries', details: error.message });
    }

    return res.status(200).json({ data });
  } catch (error: any) {
    console.error('Error in getAuditorDeliveries:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * Get detailed delivery information for auditor
 * GET /api/auditor/deliveries/:id
 */
export const getAuditorDeliveryDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('dispatches')
      .select(`
        *,
        dispatch_items(*, inventory_items(*)),
        dispatch_documents(*),
        dispatch_audit_log(*),
        auditor_reviews(*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    return res.status(200).json({ data });
  } catch (error: any) {
    console.error('Error in getAuditorDeliveryDetail:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * Review delivery (approve or flag)
 * POST /api/auditor/deliveries/:id/review
 */
export const reviewDelivery = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rawAction = req.body.action || req.body.status;
    const action = rawAction === 'approved'
      ? 'approve'
      : rawAction === 'flagged'
        ? 'flag'
        : rawAction;
    const { notes } = req.body;
    const userId = (req as any).user?.id;

    if (!action || !['approve', 'flag'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "approve" or "flag"' });
    }

    if (action === 'flag' && !notes) {
      return res.status(400).json({ error: 'Notes are required when flagging a delivery' });
    }

    // Get dispatch
    const { data: dispatch } = await supabase
      .from('dispatches')
      .select('status')
      .eq('id', id)
      .single();

    if (!dispatch) {
      return res.status(404).json({ error: 'Dispatch not found' });
    }

    if (dispatch.status !== 'completed') {
      return res.status(400).json({ error: 'Only completed deliveries can be reviewed' });
    }

    // Update dispatch status
    const newStatus = action === 'approve' ? 'audited' : 'flagged';
    await supabase
      .from('dispatches')
      .update({
        status: newStatus,
        audited_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Create auditor review record
    await supabase.from('auditor_reviews').insert({
      dispatch_id: id,
      auditor_id: userId,
      review_status: action === 'approve' ? 'approved' : 'flagged',
      notes: notes || '',
      flagged_reason: action === 'flag' ? notes : null,
    });

    // Log action
    await supabase.from('dispatch_audit_log').insert({
      dispatch_id: id,
      action: action === 'approve' ? 'approved' : 'flagged',
      performed_by: userId,
      notes: notes || `Delivery ${action}ed by auditor`,
    });

    return res.status(200).json({
      message: `Delivery ${action}ed successfully`,
      status: newStatus,
    });
  } catch (error: any) {
    console.error('Error in reviewDelivery:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
