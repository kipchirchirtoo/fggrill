import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import * as BranchInventoryService from '../../services/branch-inventory.service';
import { logger } from '../../utils/logger';

// =====================================================
// VEHICLES
// =====================================================

export const getVehicles = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createVehicle = async (req: Request, res: Response) => {
  try {
    const { registration_number, make, model, type, capacity_kg, status, insurance_expiry, notes } = req.body;

    if (!registration_number) {
      return res.status(400).json({ success: false, message: 'Registration number is required' });
    }

    const { data, error } = await supabase
      .from('vehicles')
      .insert([{ registration_number, make, model, type, capacity_kg, status, insurance_expiry, notes }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateVehicle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { registration_number, make, model, type, capacity_kg, status, insurance_expiry, notes } = req.body;

    const { data, error } = await supabase
      .from('vehicles')
      .update({ registration_number, make, model, type, capacity_kg, status, insurance_expiry, notes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteVehicle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Vehicle deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// DRIVERS
// =====================================================

export const getDrivers = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createDriver = async (req: Request, res: Response) => {
  try {
    const { name, phone, license_number, license_expiry, status } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }

    const { data, error } = await supabase
      .from('drivers')
      .insert([{ name, phone, license_number, license_expiry, status }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateDriver = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phone, license_number, license_expiry, status } = req.body;

    const { data, error } = await supabase
      .from('drivers')
      .update({ name, phone, license_number, license_expiry, status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDriver = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('drivers').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Driver deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// SUPPLIERS
// =====================================================

export const getSuppliers = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSupplier = async (req: Request, res: Response) => {
  try {
    const { name, code, contact_person, email, phone, address, city, payment_terms, status } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Supplier name is required' });
    }

    const { data, error } = await supabase
      .from('suppliers')
      .insert([{ name, code, contact_person, email, phone, address, city, payment_terms, status }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, contact_person, email, phone, address, city, payment_terms, status } = req.body;

    const { data, error } = await supabase
      .from('suppliers')
      .update({ name, code, contact_person, email, phone, address, city, payment_terms, status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Supplier deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// STOCK TAKES (Aligned with stock_counts schema)
// =====================================================

export const getStockTakes = async (req: Request, res: Response) => {
  try {
    const { branch_id, status } = req.query;

    let query = supabase
      .from('stock_counts')
      .select(`
        *,
        branch:branches(id, name, code),
        counted_by_profile:staff_profiles!counted_by(first_name, last_name)
      `)
      .order('count_date', { ascending: false });

    if (branch_id) query = query.eq('branch_id', branch_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createStockTake = async (req: Request, res: Response) => {
  try {
    const { branch_id, count_type, notes } = req.body;
    const userId = (req as any).user?.id;

    if (!branch_id) {
      return res.status(400).json({ success: false, message: 'Branch is required' });
    }

    // Create stock count session
    const { data: count, error: countError } = await supabase
      .from('stock_counts')
      .insert([{
        branch_id,
        count_date: new Date().toISOString().split('T')[0],
        count_type: count_type || 'daily',
        status: 'draft',
        notes
      }])
      .select()
      .single();

    if (countError) throw countError;

    // Get branch stock items and map them to inventory_items
    const { data: stockItems } = await supabase
      .from('branch_stock')
      .select('item_sku, quantity')
      .eq('branch_id', branch_id);

    if (stockItems && stockItems.length > 0) {
      const skus = stockItems.map(i => i.item_sku);

      // Resolve inventory_item IDs and unit costs
      const { data: inventoryItems } = await supabase
        .from('inventory_items')
        .select('id, code, unit_cost')
        .in('code', skus);

      const countItems = stockItems.map(stockItem => {
        const invItem = inventoryItems?.find(i => i.code === stockItem.item_sku);
        return {
          stock_count_id: count.id,
          item_id: invItem?.id,
          system_quantity: stockItem.quantity,
          physical_quantity: stockItem.quantity, // Default to system quantity for initialization
          unit_cost: invItem?.unit_cost || 0
        };
      }).filter(item => item.item_id); // Only include items found in inventory_items

      if (countItems.length > 0) {
        await supabase.from('stock_count_items').insert(countItems);
      }
    }

    res.status(201).json({ success: true, data: count });
    logger.info(`Stock count session created: ${count.id} for branch ${branch_id}`);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStockTakeItems = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('stock_count_items')
      .select(`
        *,
        item:inventory_items(name, code, category, unit)
      `)
      .eq('stock_count_id', id);

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStockTakeItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { physical_quantity, reason } = req.body;

    const { data, error } = await supabase
      .from('stock_count_items')
      .update({
        physical_quantity,
        reason,
        created_at: new Date().toISOString() // Using created_at as an 'updated_at' for the item if no updated_at exists
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const completeStockTake = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    // Get the stock count and its items
    const { data: count, error: countError } = await supabase
      .from('stock_counts')
      .select('*, items:stock_count_items(*, item:inventory_items(code))')
      .eq('id', id)
      .single();

    if (countError) throw countError;
    if (!count) return res.status(404).json({ success: false, message: 'Stock count not found' });

    // Transition to 'submitted' for auditor review
    const { data: updatedCount, error: updateError } = await supabase
      .from('stock_counts')
      .update({
        status: 'submitted',
        counted_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create approval request for auditor
    await supabase.from('approval_requests').insert({
      request_type: 'stock_take',
      status: 'pending',
      branch_id: count.branch_id,
      requested_by: userId,
      description: `Stock count submission review: ${count.count_number || id}`,
      metadata: { stock_count_id: id }
    });

    res.json({
      success: true,
      message: 'Stock take submitted for auditor review',
      data: updatedCount
    });

    logger.info(`Stock count ${id} submitted for audit by ${userId}`);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// APP CONFIG
// =====================================================

export const getAppConfig = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('simple_app_config')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAppConfig = async (req: Request, res: Response) => {
  try {
    const updates = req.body;

    const { data, error } = await supabase
      .from('simple_app_config')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
