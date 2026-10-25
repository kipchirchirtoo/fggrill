import { supabase } from '../config/database';

/**
 * An item may only be deactivated when nothing live depends on it. Returns the reasons it may not (empty = safe).
 * Checked: stock at any location (location balances and branch stock), a bar-drink link, an active POS item, and an
 * open requisition, purchase order or dispatch line.
 */
const CLOSED = /complet|cancel|reject|fulfil|closed|deliver|receiv|paid|superseded/i;

const count = async (query: PromiseLike<{ count: number | null; error: any }>): Promise<number> => {
  const { count: n, error } = await query;
  if (error) throw error;
  return n || 0;
};

const openLines = async (
  lines: PromiseLike<{ data: any[] | null; error: any }>,
  parentTable: string,
  parentKey: string,
  statusOf: (line: any, parent: any) => string,
): Promise<number> => {
  const { data, error } = await lines;
  if (error) throw error;
  if (!data?.length) return 0;
  const ids = [...new Set(data.map((l) => l[parentKey]).filter(Boolean))];
  const { data: parents, error: pErr } = await supabase.from(parentTable).select('id, status').in('id', ids);
  if (pErr) throw pErr;
  const byId = new Map((parents || []).map((p: any) => [p.id, p]));
  return data.filter((l) => !CLOSED.test(statusOf(l, byId.get(l[parentKey])) || '')).length;
};

export async function findItemDeactivationBlockers(sku: string): Promise<string[]> {
  const { data: item, error } = await supabase.from('inventory_items').select('id, sku').eq('sku', sku).maybeSingle();
  if (error) throw error;
  if (!item) return [];
  const reasons: string[] = [];

  const { data: balances, error: bErr } = await supabase
    .from('inventory_balances').select('current_quantity').eq('item_id', item.id).neq('current_quantity', 0);
  if (bErr) throw bErr;
  if (balances?.length) reasons.push(`it still has stock at ${balances.length} location(s)`);

  const { data: stock, error: sErr } = await supabase
    .from('branch_stock').select('branch_id').eq('item_sku', sku).neq('quantity', 0);
  if (sErr) throw sErr;
  if (stock?.length) reasons.push(`it still has stock at ${new Set(stock.map((s: any) => s.branch_id)).size} branch(es)`);

  const bar =
    (await count(supabase.from('bar_drinks').select('id', { count: 'exact', head: true }).eq('linked_inventory_sku', sku))) +
    (await count(supabase.from('bar_drinks').select('id', { count: 'exact', head: true }).eq('inventory_item_id', item.id)));
  if (bar) reasons.push('it is linked to a bar drink');

  const pos = await count(supabase.from('pos_outlet_items').select('id', { count: 'exact', head: true }).eq('sku', sku).eq('is_active', true));
  if (pos) reasons.push('it is on a live POS menu');

  const reqs = await openLines(
    supabase.from('branch_requisition_lines').select('branch_requisition_id, line_status').eq('item_sku', sku),
    'branch_requisitions', 'branch_requisition_id', (l, p) => l.line_status || p?.status);
  if (reqs) reasons.push(`it is on ${reqs} open requisition line(s)`);

  const pos2 = await openLines(
    supabase.from('purchase_order_lines').select('purchase_order_id').eq('sku', sku),
    'purchase_orders', 'purchase_order_id', (_l, p) => p?.status);
  if (pos2) reasons.push(`it is on ${pos2} open purchase order line(s)`);

  const disp = await openLines(
    supabase.from('dispatch_items').select('dispatch_id').eq('item_sku', sku),
    'dispatch_notes', 'dispatch_id', (_l, p) => p?.status);
  if (disp) reasons.push(`it is on ${disp} open dispatch note line(s)`);

  return reasons;
}
