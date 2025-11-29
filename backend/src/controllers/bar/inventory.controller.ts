import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

export const getStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, low_stock } = req.query;

    let query = supabase
      .from('bar_stock')
      .select(`
        *,
        drink:bar_drinks(name, unit, category_id)
      `)
      .order('quantity');

    if (branch_id) query = query.eq('branch_id', branch_id);

    const { data, error } = await query;

    if (error) throw error;

    let result = data;
    if (low_stock === 'true' && data) {
      result = data.filter((item: any) => item.quantity <= item.min_stock);
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const updateStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params; // stock ID
    const { quantity, reason, notes } = req.body; // quantity is the NEW absolute quantity

    // 1. Get current stock
    const { data: currentStock, error: fetchError } = await supabase
      .from('bar_stock')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentStock) throw new Error('Stock item not found');

    const oldQuantity = currentStock.quantity || 0;
    const changeQuantity = quantity - oldQuantity;

    if (changeQuantity === 0) {
      res.status(200).json({ success: true, data: currentStock, message: 'No change in quantity' });
      return;
    }

    // 2. Update stock
    const { data, error } = await supabase
      .from('bar_stock')
      .update({ 
        quantity, 
        last_restocked: changeQuantity > 0 ? new Date().toISOString() : currentStock.last_restocked 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // 3. Log the adjustment
    await supabase.from('bar_stock_logs').insert({
      stock_id: id,
      drink_id: currentStock.drink_id,
      branch_id: currentStock.branch_id,
      change_quantity: changeQuantity,
      reason: reason || 'Manual Adjustment',
      notes: notes,
      created_by: (req as any).user?.id
    });

    logger.info(`Stock adjusted for ${id}: ${oldQuantity} -> ${quantity} (${reason})`);

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getStockLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, start_date, end_date, reason } = req.query;

    let query = supabase
      .from('bar_stock_logs')
      .select(`
        *,
        drink:bar_drinks(name)
      `)
      .order('created_at', { ascending: false });

    if (branch_id) query = query.eq('branch_id', branch_id);
    if (reason) query = query.eq('reason', reason);
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);

    const { data, error } = await query.limit(100);

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
