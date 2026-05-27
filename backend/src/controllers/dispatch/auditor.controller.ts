/**
 * Auditor Controller
 * Handles auditor review of deliveries
 */

import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';

const keyBy = (rows: any[] = [], key: string) =>
  rows.reduce((acc: Record<string, any>, row: any) => {
    if (row?.[key] !== undefined && row?.[key] !== null) acc[String(row[key])] = row;
    return acc;
  }, {});

const groupBy = (rows: any[] = [], key: string) =>
  rows.reduce((acc: Record<string, any[]>, row: any) => {
    const value = row?.[key];
    if (value === undefined || value === null) return acc;
    const groupKey = String(value);
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(row);
    return acc;
  }, {});

const branchIdForDispatch = (dispatch: any) =>
  dispatch.destination_branch ?? dispatch.to_branch_id ?? dispatch.branch_id ?? dispatch.destination_branch_id;

const createdByForDispatch = (dispatch: any) =>
  dispatch.created_by ?? dispatch.created_by_user_id ?? dispatch.user_id;

const dispatchDateColumn = (dispatch: any) =>
  dispatch.completed_at ?? dispatch.updated_at ?? dispatch.created_at;

async function enrichDispatches(dispatches: any[] = []) {
  if (!dispatches.length) return [];

  const dispatchIds = dispatches.map((dispatch) => dispatch.id).filter(Boolean);
  const branchIds = [...new Set(dispatches.map(branchIdForDispatch).filter(Boolean).map(String))];
  const userIds = [...new Set(dispatches.map(createdByForDispatch).filter(Boolean).map(String))];

  const [itemsRes, documentsRes, branchesRes, usersRes] = await Promise.all([
    dispatchIds.length
      ? supabase.from('dispatch_items').select('*').in('dispatch_id', dispatchIds)
      : Promise.resolve({ data: [], error: null } as any),
    dispatchIds.length
      ? supabase.from('dispatch_documents').select('*').in('dispatch_id', dispatchIds)
      : Promise.resolve({ data: [], error: null } as any),
    branchIds.length
      ? supabase.from('branches').select('id, name, code').in('id', branchIds)
      : Promise.resolve({ data: [], error: null } as any),
    userIds.length
      ? supabase.from('users').select('id, first_name, last_name, email').in('id', userIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (itemsRes.error) throw itemsRes.error;
  if (documentsRes.error) throw documentsRes.error;
  if (branchesRes.error) throw branchesRes.error;
  if (usersRes.error) throw usersRes.error;

  const itemsByDispatch = groupBy(itemsRes.data || [], 'dispatch_id');
  const documentsByDispatch = groupBy(documentsRes.data || [], 'dispatch_id');
  const branchMap = keyBy(branchesRes.data || [], 'id');
  const userMap = keyBy(usersRes.data || [], 'id');

  return dispatches.map((dispatch) => {
    const branchId = branchIdForDispatch(dispatch);
    const userId = createdByForDispatch(dispatch);
    const branch = branchId ? branchMap[String(branchId)] : null;
    const user = userId ? userMap[String(userId)] : null;
    const items = itemsByDispatch[String(dispatch.id)] || [];
    const documents = documentsByDispatch[String(dispatch.id)] || [];
    const driverName = dispatch.driver_name || dispatch.driver || [user?.first_name, user?.last_name].filter(Boolean).join(' ');

    return {
      ...dispatch,
      branch,
      branch_name: branch?.name || dispatch.branch_name || dispatch.destination_branch_name || (branchId ? `Branch ${branchId}` : null),
      driver_name: driverName || null,
      dispatch_items: items,
      dispatch_documents: documents,
      items,
      documents,
      total_items: items.length,
      documents_count: documents.length,
      created_at: dispatch.created_at || dispatchDateColumn(dispatch),
    };
  });
}

/**
 * Get all deliveries for auditor review
 * GET /api/auditor/deliveries
 */
export const getAuditorDeliveries = async (req: Request, res: Response) => {
  try {
    const { status, branch_id, date_from, date_to } = req.query;

    let query = supabase
      .from('dispatches')
      .select('*')
      .in('status', ['completed', 'audited', 'flagged'])
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (branch_id) {
      query = query.eq('destination_branch', branch_id);
    }

    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to);

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ success: false, error: 'Failed to fetch deliveries', details: error.message });
    }

    const enriched = await enrichDispatches(data || []);

    return res.status(200).json({ success: true, count: enriched.length, data: enriched });
  } catch (error: any) {
    console.error('Error in getAuditorDeliveries:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
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
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Delivery not found' });
    }

    const [enriched] = await enrichDispatches([data]);
    const [auditLogRes, reviewsRes] = await Promise.all([
      supabase.from('dispatch_audit_log').select('*').eq('dispatch_id', id).order('created_at', { ascending: false }),
      supabase.from('auditor_reviews').select('*').eq('dispatch_id', id).order('created_at', { ascending: false }),
    ]);

    if (auditLogRes.error) throw auditLogRes.error;
    if (reviewsRes.error) throw reviewsRes.error;

    return res.status(200).json({
      success: true,
      data: {
        ...enriched,
        dispatch_audit_log: auditLogRes.data || [],
        auditor_reviews: reviewsRes.data || [],
      },
    });
  } catch (error: any) {
    console.error('Error in getAuditorDeliveryDetail:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
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
