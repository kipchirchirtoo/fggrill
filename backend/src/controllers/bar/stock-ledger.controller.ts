import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { recordBarStockMovement } from '../../services/unified-bar-stock.service';
import { logger } from '../../utils/logger';

// ==========================================
// STOCK LEDGER
// Storekeeper-managed bar stock balances (bar_stock) plus the
// append-only audit trail of every movement (bar_stock_ledger).
// All writes now flow through unified-bar-stock.service.ts so that
// inventory_balances, bar_stock, pos_outlet_items and pos_shift_stock_counts
// stay in sync.
// ==========================================

const branchIdFor = (req: Request): number | null => {
  const raw = req.query.branch_id ?? req.body?.branch_id ?? req.user?.branch_id;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getStockLedger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branchId = branchIdFor(req);
    const search = req.query.search as string | undefined;

    // Source from bar_drinks (full catalog) so every active item appears
    // regardless of whether it has been formally received into bar_stock yet.
    // A separate bar_stock query provides current quantities (left-joined by
    // drink_id, defaulting to 0 for items not yet restocked).
    let drinksQuery = supabase
      .from('bar_drinks')
      .select(`
        id,
        name,
        selling_price,
        cost_price,
        unit,
        bar_drink_categories (
          name
        )
      `)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (branchId !== null) drinksQuery = drinksQuery.eq('branch_id', branchId);

    const [{ data: drinks, error: drinksErr }, { data: stockRows, error: stockErr }] = await Promise.all([
      drinksQuery,
      branchId !== null
        ? supabase.from('bar_stock').select('drink_id, current_stock, par_level, last_updated, cost_per_unit').eq('branch_id', branchId)
        : supabase.from('bar_stock').select('drink_id, current_stock, par_level, last_updated, cost_per_unit'),
    ]);
    if (drinksErr) throw drinksErr;
    if (stockErr) throw stockErr;

    const stockByDrinkId = new Map<string, any>(
      (stockRows || []).map((r: any) => [String(r.drink_id), r])
    );

    let rows: any[] = (drinks || []).map((d: any) => {
      const stock = stockByDrinkId.get(String(d.id));
      const category = Array.isArray(d.bar_drink_categories)
        ? d.bar_drink_categories[0]
        : d.bar_drink_categories;
      return {
        id: d.id,
        name: d.name || '',
        category: category?.name || '',
        unit: d.unit || '—',
        price: d.selling_price ?? 0,
        cost_price: d.cost_price ?? stock?.cost_per_unit ?? 0,
        quantity: stock?.current_stock ?? 0,
        min_stock: stock?.par_level ?? 0,
        last_restocked: stock?.last_updated ?? null,
      };
    });

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) =>
        r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
      );
    }

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

export const addStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { drinkId } = req.params;
    const branchId = branchIdFor(req);
    const quantity = Number(req.body?.quantity);
    const reference = req.body?.reference ?? null;
    const costPerUnit = req.body?.cost_per_unit ?? req.body?.costPrice ?? null;

    if (branchId === null) {
      res.status(400).json({ success: false, message: 'branch_id is required' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      res.status(400).json({ success: false, message: 'quantity must be a positive number' });
      return;
    }

    // Flow through unified service so inventory_balances, bar_stock,
    // pos_outlet_items and pos_shift_stock_counts all stay in sync.
    const result = await recordBarStockMovement({
      branchId,
      drinkId,
      quantityDelta: quantity,
      movementType: 'restock',
      referenceNumber: reference || undefined,
      performedBy: req.user?.id ?? null,
      costPerUnit: costPerUnit ?? undefined,
      notes: reference || 'Bar restock'
    });

    // Fetch the updated bar_stock row for the legacy response contract
    const { data: stockRow } = await supabase
      .from('bar_stock')
      .select('*')
      .eq('branch_id', branchId)
      .eq('drink_id', drinkId)
      .maybeSingle();

    // Fetch the auto-inserted ledger row for the legacy response contract
    const { data: ledgerRows } = await supabase
      .from('bar_stock_ledger')
      .select('*')
      .eq('branch_id', branchId)
      .eq('drink_id', drinkId)
      .eq('transaction_type', 'restock')
      .order('created_at', { ascending: false })
      .limit(1);

    res.status(200).json({
      success: true,
      data: {
        stock: stockRow || { drink_id: drinkId, current_stock: result.newStock },
        ledger: ledgerRows?.[0] || null,
        unified: result
      }
    });
  } catch (error) {
    next(error);
  }
};

export const submitStockTake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branchId = branchIdFor(req);
    const counts = Array.isArray(req.body?.counts) ? req.body.counts : [];

    if (branchId === null) {
      res.status(400).json({ success: false, message: 'branch_id is required' });
      return;
    }
    if (!counts.length) {
      res.status(400).json({ success: false, message: 'counts must be a non-empty array' });
      return;
    }

    const results = [];
    for (const entry of counts) {
      const drinkId = String(entry.drink_id ?? entry.drinkId ?? '');
      const countedStock = Number(entry.counted_stock ?? entry.quantity);
      if (!drinkId || !Number.isFinite(countedStock)) continue;

      // Get current stock before adjustment
      const { data: existing } = await supabase
        .from('bar_stock')
        .select('current_stock')
        .eq('branch_id', branchId)
        .eq('drink_id', drinkId)
        .maybeSingle();

      const openingBalance = Number(existing?.current_stock ?? 0);
      const variance = countedStock - openingBalance;

      // Flow through unified service
      if (variance !== 0) {
        await recordBarStockMovement({
          branchId,
          drinkId,
          quantityDelta: variance,
          movementType: 'stock_take_adjustment',
          referenceNumber: req.body?.reference ?? 'Stock take',
          performedBy: req.user?.id ?? null,
          notes: req.body?.notes ?? 'Bar stock take adjustment'
        });
      }

      // Fetch the updated row for legacy response compatibility
      const { data: stockRow } = await supabase
        .from('bar_stock')
        .select('*')
        .eq('branch_id', branchId)
        .eq('drink_id', drinkId)
        .maybeSingle();

      results.push(stockRow || { drink_id: drinkId, current_stock: countedStock });
    }

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
};

export const getMovements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branchId = branchIdFor(req);
    const { drink_id, limit } = req.query;

    let query = supabase
      .from('bar_stock_ledger')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit ? Number(limit) : 100);

    if (branchId !== null) query = query.eq('branch_id', branchId);
    if (drink_id) query = query.eq('drink_id', drink_id);

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
};
