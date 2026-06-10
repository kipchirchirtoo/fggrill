import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

// ============================================================================
// Per-branch menu pricing (cost + selling) management.
//
// The restaurant_menu_items / bar_drinks tables hold a SHARED menu (branch_id
// mostly NULL). menu_item_branch_pricing layers a per-branch override on top so
// each branch can have its own cost price and selling price. When a branch has
// no override row, the base menu price/cost is used (POS is unaffected).
//
// Effective values:
//   effective_selling = override.selling_price ?? base.price
//   effective_cost    = override.cost_price    ?? base.cost_price ?? 0
//   margin            = effective_selling - effective_cost
// ============================================================================

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const parseBranchId = (raw: any): number | null => {
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

interface MergedPricingRow {
  item_type: 'restaurant' | 'bar';
  item_id: string;
  name: string;
  category: string | null;
  unit: string | null;
  base_price: number;
  base_cost: number;
  override_cost: number | null;
  override_selling: number | null;
  has_override: boolean;
  effective_cost: number;
  effective_selling: number;
  margin: number;
  margin_pct: number;
  is_available: boolean;
}

const buildRow = (
  item_type: 'restaurant' | 'bar',
  item_id: string,
  name: string,
  category: string | null,
  unit: string | null,
  basePrice: number,
  baseCost: number,
  baseAvailable: boolean,
  override: { cost_price: any; selling_price: any; is_available: any } | undefined
): MergedPricingRow => {
  const overrideCost = override && override.cost_price != null ? num(override.cost_price) : null;
  const overrideSelling = override && override.selling_price != null ? num(override.selling_price) : null;
  const effectiveCost = overrideCost ?? baseCost;
  const effectiveSelling = overrideSelling ?? basePrice;
  const margin = effectiveSelling - effectiveCost;
  const marginPct = effectiveSelling > 0 ? (margin / effectiveSelling) * 100 : 0;
  const isAvailable =
    override && override.is_available != null ? Boolean(override.is_available) : baseAvailable;
  return {
    item_type,
    item_id,
    name,
    category,
    unit,
    base_price: basePrice,
    base_cost: baseCost,
    override_cost: overrideCost,
    override_selling: overrideSelling,
    has_override: Boolean(override),
    effective_cost: effectiveCost,
    effective_selling: effectiveSelling,
    margin,
    margin_pct: Math.round(marginPct * 100) / 100,
    is_available: isAvailable,
  };
};

const fetchBranchPricing = async (
  branchId: number,
  typeFilter?: string
): Promise<MergedPricingRow[]> => {
  const wantRestaurant = !typeFilter || typeFilter === 'restaurant';
  const wantBar = !typeFilter || typeFilter === 'bar';

  // Existing per-branch overrides for this branch.
  const { data: overrides, error: overrideErr } = await supabase
    .from('menu_item_branch_pricing')
    .select('item_type, item_id, cost_price, selling_price, is_available')
    .eq('branch_id', branchId);
  if (overrideErr) throw overrideErr;
  const overrideMap = new Map<string, any>();
  for (const o of (overrides || []) as Array<Record<string, any>>) {
    overrideMap.set(`${o.item_type}:${o.item_id}`, o);
  }

  const rows: MergedPricingRow[] = [];

  if (wantRestaurant) {
    const { data, error } = await supabase
      .from('restaurant_menu_items')
      .select('id, name, price, cost_price, is_available, category:restaurant_menu_categories(name)')
      .or(`branch_id.is.null,branch_id.eq.${branchId}`)
      .order('name', { ascending: true });
    if (error) throw error;
    for (const it of (data || []) as Array<Record<string, any>>) {
      const cat = it.category as Record<string, any> | null;
      rows.push(
        buildRow(
          'restaurant',
          String(it.id),
          it.name || 'Item',
          cat?.name ?? null,
          'each',
          num(it.price),
          num(it.cost_price),
          it.is_available !== false,
          overrideMap.get(`restaurant:${it.id}`)
        )
      );
    }
  }

  if (wantBar) {
    const { data, error } = await supabase
      .from('bar_drinks')
      .select('id, name, price, cost_price, unit, is_available, category:bar_drink_categories(name)')
      .or(`branch_id.is.null,branch_id.eq.${branchId}`)
      .order('name', { ascending: true });
    if (error) throw error;
    for (const it of (data || []) as Array<Record<string, any>>) {
      const cat = it.category as Record<string, any> | null;
      rows.push(
        buildRow(
          'bar',
          String(it.id),
          it.name || 'Drink',
          cat?.name ?? null,
          it.unit || 'each',
          num(it.price),
          num(it.cost_price),
          it.is_available !== false,
          overrideMap.get(`bar:${it.id}`)
        )
      );
    }
  }

  return rows;
};

// @desc    List every menu item for a branch with its effective cost/selling/margin
// @route   GET /api/menu-pricing/branch/:branchId?type=restaurant|bar
// @access  SuperAdmin, Director, Branch Manager, Accountant roles
export const getBranchMenuPricing = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = parseBranchId(req.params.branchId);
    if (!branchId) {
      res.status(400).json({ success: false, message: 'Valid branchId is required' });
      return;
    }
    const typeFilter = typeof req.query.type === 'string' ? req.query.type : undefined;
    const rows = await fetchBranchPricing(branchId, typeFilter);

    const priced = rows.filter((r) => r.effective_cost > 0);
    const avgMarginPct =
      priced.length > 0
        ? priced.reduce((s, r) => s + r.margin_pct, 0) / priced.length
        : 0;

    res.status(200).json({
      success: true,
      data: {
        branch_id: branchId,
        items: rows,
        summary: {
          total_items: rows.length,
          with_override: rows.filter((r) => r.has_override).length,
          costed_items: priced.length,
          avg_margin_pct: Math.round(avgMarginPct * 100) / 100,
        },
      },
    });
  } catch (error) {
    logger.error('getBranchMenuPricing failed:', error);
    next(error);
  }
};

// @desc    Set the cost + selling price for one item in one branch (upsert)
// @route   PUT /api/menu-pricing/branch/:branchId/item
// @access  SuperAdmin
export const upsertBranchItemPricing = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = parseBranchId(req.params.branchId);
    if (!branchId) {
      res.status(400).json({ success: false, message: 'Valid branchId is required' });
      return;
    }
    const { item_type, item_id, cost_price, selling_price, is_available } = req.body || {};
    if ((item_type !== 'restaurant' && item_type !== 'bar') || !item_id) {
      res.status(400).json({ success: false, message: 'item_type (restaurant|bar) and item_id are required' });
      return;
    }

    const row = {
      item_type,
      item_id,
      branch_id: branchId,
      cost_price: cost_price != null ? num(cost_price) : 0,
      selling_price: selling_price != null && selling_price !== '' ? num(selling_price) : null,
      is_available: is_available == null ? null : Boolean(is_available),
      updated_by: req.user?.id || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('menu_item_branch_pricing')
      .upsert([row], { onConflict: 'item_type,item_id,branch_id' })
      .select()
      .single();
    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('upsertBranchItemPricing failed:', error);
    next(error);
  }
};

// @desc    Bulk save many per-branch item prices in one request
// @route   PUT /api/menu-pricing/branch/:branchId/bulk
// @access  SuperAdmin
export const bulkUpsertBranchPricing = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = parseBranchId(req.params.branchId);
    if (!branchId) {
      res.status(400).json({ success: false, message: 'Valid branchId is required' });
      return;
    }
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      res.status(400).json({ success: false, message: 'items[] is required' });
      return;
    }

    const now = new Date().toISOString();
    const rows = items
      .filter((it: any) => (it.item_type === 'restaurant' || it.item_type === 'bar') && it.item_id)
      .map((it: any) => ({
        item_type: it.item_type,
        item_id: it.item_id,
        branch_id: branchId,
        cost_price: it.cost_price != null ? num(it.cost_price) : 0,
        selling_price: it.selling_price != null && it.selling_price !== '' ? num(it.selling_price) : null,
        is_available: it.is_available == null ? null : Boolean(it.is_available),
        updated_by: req.user?.id || null,
        updated_at: now,
      }));

    if (rows.length === 0) {
      res.status(400).json({ success: false, message: 'No valid items to save' });
      return;
    }

    const { data, error } = await supabase
      .from('menu_item_branch_pricing')
      .upsert(rows, { onConflict: 'item_type,item_id,branch_id' })
      .select();
    if (error) throw error;

    res.status(200).json({ success: true, data: { saved: (data || []).length } });
  } catch (error) {
    logger.error('bulkUpsertBranchPricing failed:', error);
    next(error);
  }
};

// @desc    Remove a per-branch override so the item reverts to the base price
// @route   DELETE /api/menu-pricing/branch/:branchId/item/:itemType/:itemId
// @access  SuperAdmin
export const deleteBranchItemPricing = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = parseBranchId(req.params.branchId);
    const itemType = req.params.itemType;
    const itemId = req.params.itemId;
    if (!branchId || (itemType !== 'restaurant' && itemType !== 'bar') || !itemId) {
      res.status(400).json({ success: false, message: 'branchId, itemType (restaurant|bar) and itemId are required' });
      return;
    }

    const { error } = await supabase
      .from('menu_item_branch_pricing')
      .delete()
      .eq('branch_id', branchId)
      .eq('item_type', itemType)
      .eq('item_id', itemId);
    if (error) throw error;

    res.status(200).json({ success: true, message: 'Override removed; item reverted to base price' });
  } catch (error) {
    logger.error('deleteBranchItemPricing failed:', error);
    next(error);
  }
};

// @desc    Menu profitability report for a branch (cost vs selling + units sold)
// @route   GET /api/menu-pricing/branch/:branchId/profitability?from=&to=
// @access  SuperAdmin, Director, Accountant roles — feeds branch analysis
export const getBranchMenuProfitability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = parseBranchId(req.params.branchId);
    if (!branchId) {
      res.status(400).json({ success: false, message: 'Valid branchId is required' });
      return;
    }

    const rows = await fetchBranchPricing(branchId);
    const restaurantById = new Map<string, MergedPricingRow>();
    for (const r of rows) {
      if (r.item_type === 'restaurant') restaurantById.set(r.item_id, r);
    }

    // Restaurant units sold in the period (item-level data lives in
    // restaurant_order_items). Bar/POS per-item sales are not reliably stored
    // per item in this schema, so the report covers margins for all items and
    // actual sold quantities where the data exists.
    const from = typeof req.query.from === 'string' ? req.query.from : null;
    const to = typeof req.query.to === 'string' ? req.query.to : null;

    let soldQuery = supabase
      .from('restaurant_order_items')
      .select('menu_item_id, quantity, total_price, created_at, branch_id')
      .eq('branch_id', branchId);
    if (from) soldQuery = soldQuery.gte('created_at', from);
    if (to) soldQuery = soldQuery.lte('created_at', to);
    const { data: sold, error: soldErr } = await soldQuery;
    if (soldErr) logger.warn(`Profitability: could not load order items: ${soldErr.message}`);

    const soldById = new Map<string, { units: number; revenue: number }>();
    for (const s of (sold || []) as Array<Record<string, any>>) {
      const id = String(s.menu_item_id);
      const agg = soldById.get(id) || { units: 0, revenue: 0 };
      agg.units += num(s.quantity);
      agg.revenue += num(s.total_price);
      soldById.set(id, agg);
    }

    const items = rows.map((r) => {
      const soldAgg = r.item_type === 'restaurant' ? soldById.get(r.item_id) : undefined;
      const units = soldAgg?.units || 0;
      const revenue = soldAgg?.revenue || units * r.effective_selling;
      const cogs = units * r.effective_cost;
      const grossProfit = revenue - cogs;
      return {
        item_type: r.item_type,
        item_id: r.item_id,
        name: r.name,
        category: r.category,
        effective_cost: r.effective_cost,
        effective_selling: r.effective_selling,
        unit_margin: r.margin,
        margin_pct: r.margin_pct,
        units_sold: units,
        revenue,
        cogs,
        gross_profit: grossProfit,
      };
    });

    const totals = items.reduce(
      (acc, it) => {
        acc.units_sold += it.units_sold;
        acc.revenue += it.revenue;
        acc.cogs += it.cogs;
        acc.gross_profit += it.gross_profit;
        return acc;
      },
      { units_sold: 0, revenue: 0, cogs: 0, gross_profit: 0 }
    );
    const grossMarginPct = totals.revenue > 0 ? (totals.gross_profit / totals.revenue) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        branch_id: branchId,
        from,
        to,
        items,
        totals: {
          ...totals,
          gross_margin_pct: Math.round(grossMarginPct * 100) / 100,
        },
      },
    });
  } catch (error) {
    logger.error('getBranchMenuProfitability failed:', error);
    next(error);
  }
};
