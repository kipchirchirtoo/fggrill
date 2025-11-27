import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';

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
// STOCK TAKES
// =====================================================

export const getStockTakes = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('stock_takes')
      .select(`
        *,
        branch:branches(id, name, code)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createStockTake = async (req: Request, res: Response) => {
  try {
    const { branch_id, take_type, notes } = req.body;
    const userId = (req as any).user?.id;

    if (!branch_id) {
      return res.status(400).json({ success: false, message: 'Branch is required' });
    }

    // Generate take number
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const { count } = await supabase
      .from('stock_takes')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date().toISOString().split('T')[0]);
    
    const takeNumber = `FGH-ST-${dateStr}-${String((count || 0) + 1).padStart(4, '0')}`;

    // Create stock take
    const { data: take, error: takeError } = await supabase
      .from('stock_takes')
      .insert([{
        take_number: takeNumber,
        branch_id,
        take_type: take_type || 'FULL',
        status: 'IN_PROGRESS',
        started_by: userId,
        started_at: new Date().toISOString(),
        notes
      }])
      .select()
      .single();

    if (takeError) throw takeError;

    // Get branch stock items and create stock take items
    const { data: stockItems } = await supabase
      .from('branch_stock')
      .select('item_sku, quantity')
      .eq('branch_id', branch_id);

    if (stockItems && stockItems.length > 0) {
      const takeItems = stockItems.map(item => ({
        stock_take_id: take.id,
        item_sku: item.item_sku,
        system_quantity: item.quantity,
        status: 'PENDING'
      }));

      await supabase.from('stock_take_items').insert(takeItems);
    }

    res.status(201).json({ success: true, data: take });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStockTakeItems = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('stock_take_items')
      .select(`
        *,
        item:simple_items(item_name, description)
      `)
      .eq('stock_take_id', id)
      .order('item_sku');

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStockTakeItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { counted_quantity, variance_reason } = req.body;

    const { data, error } = await supabase
      .from('stock_take_items')
      .update({
        counted_quantity,
        variance_reason,
        status: 'COUNTED',
        counted_at: new Date().toISOString()
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

    // Get counts
    const { data: items } = await supabase
      .from('stock_take_items')
      .select('*')
      .eq('stock_take_id', id);

    const totalCounted = items?.filter(i => i.status === 'COUNTED').length || 0;
    const withVariance = items?.filter(i => i.counted_quantity !== null && i.counted_quantity !== i.system_quantity).length || 0;

    const { data, error } = await supabase
      .from('stock_takes')
      .update({
        status: 'COMPLETED',
        total_items_counted: totalCounted,
        items_with_variance: withVariance,
        completed_by: userId,
        completed_at: new Date().toISOString()
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
