/**
 * Items Controller
 * Handles item receiving and barcode management
 */

import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';

/**
 * Get central store dashboard stats
 * GET /api/dispatch/dashboard/central
 */
export const getCentralDashboard = async (req: Request, res: Response) => {
  try {
    // Get total items count
    const { count: totalItems } = await supabase
      .from('inventory_items')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Get low stock count
    const { data: lowStockItems } = await supabase
      .from('inventory_items')
      .select('id, current_stock, minimum_stock')
      .eq('is_active', true);

    const lowStockCount = lowStockItems?.filter(item => 
      (item.current_stock || 0) <= (item.minimum_stock || 0)
    ).length || 0;

    // Get pending dispatches count
    const { count: pendingDispatches } = await supabase
      .from('dispatches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Get today's dispatches count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayDispatches } = await supabase
      .from('dispatches')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    return res.status(200).json({
      data: {
        total_items: totalItems || 0,
        low_stock_count: lowStockCount,
        pending_dispatches: pendingDispatches || 0,
        today_dispatches: todayDispatches || 0,
      },
    });
  } catch (error: any) {
    console.error('Error in getCentralDashboard:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * Receive item (create new or update existing) with barcode
 * POST /api/store/items/receive
 */
export const receiveItem = async (req: Request, res: Response) => {
  try {
    const { item_id, name, description, category, unit, quantity, barcode } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // If item_id provided, update existing item
    if (item_id) {
      const { data: item, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', item_id)
        .single();

      if (error || !item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      // Associate barcode if provided
      if (barcode) {
        const { error: barcodeError } = await supabase
          .from('item_barcodes')
          .insert({
            item_id: item_id,
            barcode_value: barcode,
            barcode_type: 'item',
            created_by: userId,
          });

        if (barcodeError) {
          return res.status(400).json({ error: 'Failed to associate barcode', details: barcodeError.message });
        }
      }

      return res.status(200).json({ data: item, message: 'Item received successfully' });
    }

    // Create new item
    if (!name || !category || !unit) {
      return res.status(400).json({ error: 'Missing required fields: name, category, unit' });
    }

    const { data: newItem, error: itemError } = await supabase
      .from('inventory_items')
      .insert({
        name,
        description,
        category,
        unit,
        minimum_stock: 0,
        maximum_stock: quantity || 100,
        reorder_point: 10,
        unit_cost: 0,
      })
      .select()
      .single();

    if (itemError || !newItem) {
      return res.status(400).json({ error: 'Failed to create item', details: itemError?.message });
    }

    // Associate barcode
    if (barcode) {
      const { error: barcodeError } = await supabase
        .from('item_barcodes')
        .insert({
          item_id: newItem.id,
          barcode_value: barcode,
          barcode_type: 'item',
          created_by: userId,
        });

      if (barcodeError) {
        return res.status(400).json({ error: 'Item created but barcode association failed', details: barcodeError.message });
      }
    }

    return res.status(201).json({ data: newItem, message: 'Item created and received successfully' });
  } catch (error: any) {
    console.error('Error in receiveItem:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * Get all items
 * GET /api/store/items
 */
export const getItems = async (req: Request, res: Response) => {
  try {
    const { search, category } = req.query;

    let query = supabase
      .from('inventory_items')
      .select('*, item_barcodes(barcode_value)')
      .eq('is_active', true);

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query.order('name');

    if (error) {
      return res.status(400).json({ error: 'Failed to fetch items', details: error.message });
    }

    return res.status(200).json({ data });
  } catch (error: any) {
    console.error('Error in getItems:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * Search item by barcode
 * GET /api/store/barcodes/:barcode
 */
export const searchByBarcode = async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params;

    const { data, error } = await supabase
      .from('item_barcodes')
      .select('*, inventory_items(*)')
      .eq('barcode_value', barcode)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Barcode not found' });
    }

    return res.status(200).json({ data: data.inventory_items });
  } catch (error: any) {
    console.error('Error in searchByBarcode:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * Generate unique barcode
 * POST /api/store/barcodes/generate
 */
export const generateBarcode = async (req: Request, res: Response) => {
  try {
    // Call database function to generate unique barcode
    const { data, error } = await supabase.rpc('generate_barcode', { prefix: 'ITEM' });

    if (error) {
      return res.status(400).json({ error: 'Failed to generate barcode', details: error.message });
    }

    return res.status(200).json({ barcode: data, barcode_value: data });
  } catch (error: any) {
    console.error('Error in generateBarcode:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * Print barcode label (placeholder for printer integration)
 * POST /api/store/barcodes/:barcode/print
 */
export const printBarcodeLabel = async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params;

    // TODO: Integrate with label printer
    // For now, just return success
    return res.status(200).json({ message: 'Barcode label prepared for printing', barcode });
  } catch (error: any) {
    console.error('Error in printBarcodeLabel:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
