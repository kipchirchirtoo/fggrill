import { Request, Response } from 'express';
import { supabase } from '../config/database';

// Get all suppliers
export const getSuppliers = async (req: Request, res: Response) => {
  try {
    const { status, category, search } = req.query;

    let query = supabase
      .from('suppliers')
      .select('*, supplier_products(count)')
      .order('name', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,supplier_code.ilike.%${search}%,contact_person.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch suppliers'
    });
  }
};

// Get supplier by ID
export const getSupplierById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('suppliers')
      .select('*, supplier_products(*)')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch supplier'
    });
  }
};

// Create supplier
export const createSupplier = async (req: Request, res: Response) => {
  try {
    const supplierData = req.body;

    // Generate supplier code if not provided
    if (!supplierData.supplier_code) {
      const prefix = 'SUP';
      const timestamp = Date.now().toString().slice(-6);
      supplierData.supplier_code = `${prefix}${timestamp}`;
    }

    const { data, error } = await supabase
      .from('suppliers')
      .insert([supplierData])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Supplier created successfully'
    });
  } catch (error: any) {
    console.error('Error creating supplier:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create supplier'
    });
  }
};

// Update supplier
export const updateSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supplierData = req.body;

    const { data, error } = await supabase
      .from('suppliers')
      .update(supplierData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data,
      message: 'Supplier updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating supplier:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update supplier'
    });
  }
};

// Delete supplier
export const deleteSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete supplier'
    });
  }
};

// Get supplier products
export const getSupplierProducts = async (req: Request, res: Response) => {
  try {
    const { supplierId } = req.params;

    const { data, error } = await supabase
      .from('supplier_products')
      .select('*')
      .eq('supplier_id', supplierId)
      .eq('is_active', true)
      .order('product_name', { ascending: true });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error fetching supplier products:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch supplier products'
    });
  }
};

// Add supplier product
export const addSupplierProduct = async (req: Request, res: Response) => {
  try {
    const { supplierId } = req.params;
    const productData = {
      ...req.body,
      supplier_id: supplierId
    };

    const { data, error } = await supabase
      .from('supplier_products')
      .insert([productData])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Product added successfully'
    });
  } catch (error: any) {
    console.error('Error adding supplier product:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add product'
    });
  }
};

// Update supplier product
export const updateSupplierProduct = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const productData = req.body;

    const { data, error } = await supabase
      .from('supplier_products')
      .update(productData)
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data,
      message: 'Product updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating supplier product:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update product'
    });
  }
};

// Delete supplier product
export const deleteSupplierProduct = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    const { error } = await supabase
      .from('supplier_products')
      .delete()
      .eq('id', productId);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting supplier product:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete product'
    });
  }
};

// Get supplier performance metrics
export const getSupplierPerformance = async (req: Request, res: Response) => {
  try {
    const { supplierId } = req.params;
    const { startDate, endDate } = req.query;

    // Get purchase orders for this supplier
    let query = supabase
      .from('purchase_orders')
      .select('*')
      .eq('supplier_id', supplierId);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    // Calculate metrics
    const totalOrders = orders?.length || 0;
    const totalAmount = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
    const completedOrders = orders?.filter(o => o.status === 'completed').length || 0;
    const onTimeDeliveries = orders?.filter(o => o.status === 'completed' && o.delivered_on_time).length || 0;

    const metrics = {
      totalOrders,
      totalAmount,
      completedOrders,
      onTimeDeliveries,
      onTimeRate: totalOrders > 0 ? (onTimeDeliveries / totalOrders) * 100 : 0,
      completionRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0
    };

    res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    console.error('Error fetching supplier performance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch supplier performance'
    });
  }
};
