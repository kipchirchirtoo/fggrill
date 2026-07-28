import { Request, Response } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';
import { getCentralWarehouseRecord } from '../../services/inventory-warehouse.service';

export const getWarehouseDashboard = async (req: Request, res: Response) => {
  try {
    const centralWarehouse = await getCentralWarehouseRecord();
    const centralId = centralWarehouse?.operating_branch_id ?? null;

    if (!centralId) {
      logger.error('Central warehouse not found');
      return res.status(500).json({ success: false, message: 'Central warehouse configuration missing' });
    }

    // 1. Get Inventory Summary (from branch_stock for central warehouse)
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('branch_stock')
      .select('quantity, reorder_level')
      .eq('branch_id', centralId);

    if (inventoryError) throw inventoryError;

    const total_items = inventoryData?.length || 0;
    const low_stock_items = inventoryData?.filter((item: any) => item.quantity <= (item.reorder_level || 10)).length || 0;
    const total_quantity = inventoryData?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;

    // 2. Get Stock Request Summary
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString();

    const { data: requests, error: requestError } = await supabase
      .from('stock_requests')
      .select('status')
      .gte('created_at', dateStr);

    if (requestError) throw requestError;

    const total_requests = requests?.length || 0;
    const pending_requests = requests?.filter((r: any) => ['PENDING', 'PENDING_BRANCH_ACCOUNTANT_APPROVAL', 'UNDER_REVIEW', 'PENDING_AUDIT'].includes(r.status)).length || 0;
    const approved_requests = requests?.filter((r: any) => ['APPROVED', 'PARTIALLY_APPROVED'].includes(r.status)).length || 0;

    // 3. Get Dispatch Summary
    const { data: dispatches, error: dispatchError } = await supabase
      .from('dispatch_notes')
      .select('status')
      .gte('created_at', dateStr);

    if (dispatchError) throw dispatchError;

    const total_dispatches = dispatches?.length || 0;
    const pending_dispatches = dispatches?.filter((d: any) => d.status === 'PENDING').length || 0;
    const in_transit_dispatches = dispatches?.filter((d: any) => d.status === 'IN_TRANSIT').length || 0;

    // 4. Recent Activity (Requests & Dispatches)
    const { data: recentRequests } = await supabase
      .from('stock_requests')
      .select('request_number, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: recentDispatches } = await supabase
      .from('dispatch_notes')
      .select('dispatch_number, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    const activity = [
      ...(recentRequests?.map((r: any) => ({ type: 'REQUEST', reference: r.request_number, status: r.status, created_at: r.created_at })) || []),
      ...(recentDispatches?.map((d: any) => ({ type: 'DISPATCH', reference: d.dispatch_number, status: d.status, created_at: d.created_at })) || [])
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);

    // 5. Top Requested Items
    const { data: requestItems } = await supabase
      .from('stock_request_items')
      .select('item_sku, requested_quantity')
      .order('created_at', { ascending: false })
      .limit(100);

    const requestedSkus = [...new Set((requestItems || []).map((item: any) => item.item_sku).filter(Boolean))];
    const { data: simpleItems } = requestedSkus.length > 0
      ? await supabase
        .from('simple_items')
        .select('sku, item_name, description')
        .in('sku', requestedSkus)
      : { data: [] };

    const itemNames = new Map<string, string>(
      (simpleItems || []).map((item: any) => [
        item.sku,
        item.item_name || item.description || item.sku
      ])
    );

    const itemMap = new Map<string, { item_name: string, total_requested: number }>();

    requestItems?.forEach((item: any) => {
      const current = itemMap.get(item.item_sku) || { item_name: itemNames.get(item.item_sku) || item.item_sku, total_requested: 0 };
      current.total_requested += item.requested_quantity;
      itemMap.set(item.item_sku, current);
    });

    const topItems = Array.from(itemMap.entries())
      .map(([sku, data]) => ({ item_sku: sku, ...data }))
      .sort((a, b) => b.total_requested - a.total_requested)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        inventory: {
          total_items,
          low_stock_items,
          total_quantity,
          total_reserved: 0
        },
        requests: {
          total_requests,
          pending_requests,
          approved_requests
        },
        dispatches: {
          total_dispatches,
          pending_dispatches,
          in_transit_dispatches
        },
        recentActivity: activity,
        topItems
      }
    });
  } catch (error) {
    logger.error('Error getting warehouse dashboard:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
