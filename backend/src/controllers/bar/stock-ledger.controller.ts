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

    let query = supabase
      .from('bar_stock')
      .select(`
        *,
        bar_drinks (
          name,
          price,
          selling_price,
          cost_price,
          unit,
          category_id,
          bar_drink_categories (
            name
          )
        )
      `)
      .order('item_name', { ascending: true });

    if (branchId !== null) query = query.eq('branch_id', branchId);

    const { data, error } = await query;
    if (error) throw error;

    let rows = data || [];

    // Server-side search fallback (client also filters, but this reduces payload)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((row) => {
        const itemName = row.item_name || '';
        const drinkName = row.bar_drinks?.name || '';
        const categoryName = row.bar_drinks?.bar_drink_categories?.name || '';
        return itemName.toLowerCase().includes(q) ||
               drinkName.toLowerCase().includes(q) ||
               categoryName.toLowerCase().includes(q);
      });
    }

    const mapped = rows.map((row) => {
      const drink = row.bar_drinks;
      const category = drink?.bar_drink_categories;
      return {
        id: row.id,
        name: drink?.name || row.item_name || '',
        category: category?.name || '',
        unit: row.unit || drink?.unit || '—',
        price: drink?.price ?? drink?.selling_price ?? 0,
        cost_price: drink?.cost_price ?? row.cost_per_unit ?? 0,
        quantity: row.current_stock,
        min_stock: row.par_level,
        last_restocked: row.last_updated
      };
    });

    res.status(200).json({ success: true, data: mapped });
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
