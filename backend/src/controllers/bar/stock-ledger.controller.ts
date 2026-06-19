import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';

// ==========================================
// STOCK LEDGER
// Storekeeper-managed bar stock balances (bar_stock) plus the
// append-only audit trail of every movement (bar_stock_ledger).
// ==========================================

const branchIdFor = (req: Request): number | null => {
  const raw = req.query.branch_id ?? req.body?.branch_id ?? req.user?.branch_id;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getStockLedger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branchId = branchIdFor(req);

    let query = supabase
      .from('bar_stock')
      .select('*')
      .order('item_name', { ascending: true });

    if (branchId !== null) query = query.eq('branch_id', branchId);

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, data: data || [] });
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

    if (branchId === null) {
      res.status(400).json({ success: false, message: 'branch_id is required' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      res.status(400).json({ success: false, message: 'quantity must be a positive number' });
      return;
    }

    const { data: existing, error: existingError } = await supabase
      .from('bar_stock')
      .select('*')
      .eq('branch_id', branchId)
      .eq('drink_id', drinkId)
      .maybeSingle();
    if (existingError) throw existingError;

    const openingBalance = Number(existing?.current_stock ?? 0);
    const closingBalance = openingBalance + quantity;

    let stockRow = existing;
    if (existing) {
      const { data, error } = await supabase
        .from('bar_stock')
        .update({ current_stock: closingBalance, last_updated: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      stockRow = data;
    } else {
      const { data: drink, error: drinkError } = await supabase
        .from('bar_drinks')
        .select('id, name, unit, branch_id')
        .eq('id', drinkId)
        .single();
      if (drinkError || !drink) throw drinkError || new Error('Drink not found');

      const { data, error } = await supabase
        .from('bar_stock')
        .insert([{
          branch_id: branchId,
          drink_id: drinkId,
          item_sku: drinkId,
          item_name: drink.name,
          current_stock: closingBalance,
          unit: drink.unit || 'bottle'
        }])
        .select('*')
        .single();
      if (error) throw error;
      stockRow = data;
    }

    const { data: ledgerRow, error: ledgerError } = await supabase
      .from('bar_stock_ledger')
      .insert([{
        branch_id: branchId,
        drink_id: drinkId,
        transaction_type: 'restock',
        quantity,
        opening_balance: openingBalance,
        closing_balance: closingBalance,
        reference,
        performed_by: req.user?.id ?? null
      }])
      .select('*')
      .single();
    if (ledgerError) throw ledgerError;

    res.status(200).json({ success: true, data: { stock: stockRow, ledger: ledgerRow } });
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

      const { data: existing, error: existingError } = await supabase
        .from('bar_stock')
        .select('*')
        .eq('branch_id', branchId)
        .eq('drink_id', drinkId)
        .maybeSingle();
      if (existingError) throw existingError;

      const openingBalance = Number(existing?.current_stock ?? 0);
      const variance = countedStock - openingBalance;

      let stockRow = existing;
      if (existing) {
        const { data, error } = await supabase
          .from('bar_stock')
          .update({ current_stock: countedStock, last_updated: new Date().toISOString() })
          .eq('id', existing.id)
          .select('*')
          .single();
        if (error) throw error;
        stockRow = data;
      } else {
        const { data: drink, error: drinkError } = await supabase
          .from('bar_drinks')
          .select('id, name, unit')
          .eq('id', drinkId)
          .single();
        if (drinkError || !drink) continue;

        const { data, error } = await supabase
          .from('bar_stock')
          .insert([{
            branch_id: branchId,
            drink_id: drinkId,
            item_sku: drinkId,
            item_name: drink.name,
            current_stock: countedStock,
            unit: drink.unit || 'bottle'
          }])
          .select('*')
          .single();
        if (error) throw error;
        stockRow = data;
      }

      if (variance !== 0) {
        const { error: ledgerError } = await supabase
          .from('bar_stock_ledger')
          .insert([{
            branch_id: branchId,
            drink_id: drinkId,
            transaction_type: 'stock_take',
            quantity: variance,
            opening_balance: openingBalance,
            closing_balance: countedStock,
            reference: req.body?.reference ?? 'Stock take',
            performed_by: req.user?.id ?? null
          }]);
        if (ledgerError) throw ledgerError;
      }

      results.push(stockRow);
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
