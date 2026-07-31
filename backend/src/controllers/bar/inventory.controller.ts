import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

export const getStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawBranchId = req.query.branch_id as string | undefined;
    let targetBranchId: number = (req as any).user?.branch_id || 1;
    if (rawBranchId && rawBranchId !== 'all' && rawBranchId !== '0') {
      const parsed = parseInt(rawBranchId, 10);
      if (!isNaN(parsed) && parsed > 0) targetBranchId = parsed;
    }

    const { low_stock, category } = req.query;

    let query = supabase
      .from('bar_stock')
      .select(`
        id,
        branch_id,
        drink_id,
        item_name,
        item_sku,
        current_stock,
        par_level,
        unit,
        last_updated,
        created_at,
        updated_at,
        drink:bar_drinks(id, name, category, price, selling_price, is_available, image_url, sku)
      `)
      .eq('branch_id', targetBranchId)
      .order('item_name');

    const { data, error } = await query;
    if (error) throw error;

    let result = (data || []).map((item: any) => ({
      id: item.id,
      drink_id: item.drink_id,
      name: item.drink?.name || item.item_name,
      category: item.drink?.category || category || 'bar',
      price: item.drink?.selling_price || item.drink?.price || 0,
      current_stock: item.current_stock ?? 0,
      current_bottles: item.current_stock ?? 0,
      par_level: item.par_level ?? 5,
      is_available: (item.current_stock ?? 0) > 0,
      sku: item.item_sku || item.drink?.sku,
      unit: item.unit || 'bottle',
      last_updated: item.last_updated,
      branch_id: item.branch_id
    }));

    if (category) {
      result = result.filter((item: any) =>
        item.category.toLowerCase().trim() === (category as string).toLowerCase().trim()
      );
    }

    if (low_stock === 'true') {
      result = result.filter((item: any) => item.current_stock <= item.par_level);
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const updateStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { quantity, reason, notes } = req.body;
    // quantity here implies the NEW total quantity of bottles

    // 1. Get current stock
    const { data: currentStock, error: fetchError } = await supabase
      .from('restaurant_bar_inventory')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentStock) throw new Error('Stock item not found');

    const oldQuantity = currentStock.current_bottles || 0;
    const changeQuantity = quantity - oldQuantity;

    if (changeQuantity === 0) {
      res.status(200).json({ success: true, data: currentStock, message: 'No change in quantity' });
      return;
    }

    // 2. Update stock
    const { data, error } = await supabase
      .from('restaurant_bar_inventory')
      .update({
        current_bottles: quantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // 3. Log the transaction (using restaurant_inventory_transactions possibly, or a specific bar log if it exists?)
    // Migration 12 has restaurant_inventory_transactions but it links to restaurant_inventory_items.
    // restaurant_bar_inventory seems standalone.
    // Migration 20260113 has bar_stock_records. simpler to use that if available.
    // But bar_stock_records wants inventory_item_id OR drink_id.
    // Let's use bar_stock_records linking to drink_id (which is this table's id).

    // Check if bar_stock_records exists (it was in the advanced migration).
    // It links to restaurant_inventory_items OR bar_stock(id).
    // We are treating restaurant_bar_inventory AS the "bar_stock" table.

    const userId = (req as any).user?.id;
    const branchId = (req as any).user?.branch_id; // We need branch_id for logs even if item doesn't have it

    if (branchId) {
      const { error } = await supabase.from('bar_stock_records').insert({
        branch_id: branchId,
        drink_id: id,
        record_type: changeQuantity > 0 ? 'received' : 'stock_taking', // Simplification
        quantity: Math.abs(changeQuantity),
        unit: 'bottles',
        recorded_by: userId,
        notes: `${reason || 'Manual Update'} - ${notes || ''}`
      });

      if (error) {

        console.error('Database error:', error);

        throw error;

      }
    }

    logger.info(`Bar Stock updated for ${id}: ${oldQuantity} -> ${quantity}`);

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getStockLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, start_date, end_date } = req.query;

    let query = supabase
      .from('bar_stock_records')
      .select(`
        *,
        recorder:users(first_name, last_name),
        drink:restaurant_bar_inventory(name, category)
      `)
      .order('recorded_at', { ascending: false });

    if (branch_id) query = query.eq('branch_id', branch_id);
    if (start_date) query = query.gte('recorded_at', start_date);
    if (end_date) query = query.lte('recorded_at', end_date);

    const { data, error } = await query.limit(100);

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const submitStockTake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, items, notes, count_type } = req.body;
    const userId = (req as any).user?.id;

    if (!items || !Array.isArray(items)) {
      throw new Error('Items array is required');
    }

    // 1. Create the stock count session
    const { data: session, error: sessionError } = await supabase
      .from('stock_counts')
      .insert([{
        branch_id: branch_id || (req as any).user?.branch_id,
        count_date: new Date().toISOString().split('T')[0],
        count_type: count_type || 'daily',
        status: 'submitted',
        counted_by: userId,
        notes: notes || 'Bar Daily Stock Take'
      }])
      .select()
      .single();

    if (sessionError) throw sessionError;

    // 2. Prepare items with variance logic
    const countItems = await Promise.all(items.map(async (item: any) => {
      // Get current system stock
      const { data: currentItem } = await supabase
        .from('restaurant_bar_inventory')
        .select('current_bottles, cost_per_bottle')
        .eq('id', item.drink_id)
        .single();

      const systemQty = currentItem?.current_bottles || 0;
      const physicalQty = Number(item.physical_quantity);
      const unitCost = currentItem?.cost_per_bottle || 0;

      return {
        stock_count_id: session.id,
        item_id: item.drink_id, // Note: stock_count_items expects store_items(id), we might need to cast or ensure compatibility if schemas differ
        system_quantity: systemQty,
        physical_quantity: physicalQty,
        unit_cost: unitCost,
        reason: item.reason
      };
    }));

    // Insert count items
    const { error: itemsError } = await supabase
      .from('stock_count_items')
      .insert(countItems);

    if (itemsError) throw itemsError;

    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
};

export const getConsumptionReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // 1. Fetch all bar inventory items
    const { data: inventory } = await supabase
      .from('restaurant_bar_inventory')
      .select('*');

    // 2. Fetch sales for the day from bar_order_items
    const { data: sales } = await supabase
      .from('bar_order_items')
      .select(`
        drink_id,
        quantity,
        order:bar_orders(branch_id, created_at)
      `)
      .gte('created_at', `${targetDate}T00:00:00`)
      .lte('created_at', `${targetDate}T23:59:59`);

    // 3. Filter sales by branch if needed
    const filteredSales = (sales || []).filter((s: any) =>
      !branch_id || String(s.order?.branch_id) === String(branch_id)
    );

    // 4. Aggregate sales by drink_id
    const salesMap: Record<string, number> = {};
    filteredSales.forEach((s: any) => {
      salesMap[s.drink_id] = (salesMap[s.drink_id] || 0) + Number(s.quantity);
    });

    // 5. Build report
    const report = (inventory || []).map(item => ({
      ...item,
      sold_qty: salesMap[item.id] || 0,
      expected_remaining: (item.current_bottles || 0) // This is simplified; assumes current_bottles is opening
    }));

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};
