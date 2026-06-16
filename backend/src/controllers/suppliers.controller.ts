import { Request, Response } from 'express';
import { supabase } from '../config/database';

// Get all suppliers
export const getSuppliers = async (req: Request, res: Response) => {
  try {
    const { status, category, search, scope } = req.query;
    const rawBranchContext = req.user?.branch_id || req.user?.branchId || req.headers['x-branch-id'] || req.query.branchId || req.query.branch_id;
    const userBranchId = rawBranchContext ? Number(rawBranchContext) : null;
    const isCentral = !userBranchId || req.user?.role === 'super_admin' || req.user?.role === 'central_storekeeper';
    const scopeParam = typeof scope === 'string' ? scope.toLowerCase() : undefined;

    let query = supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });

    const branchId = userBranchId && !Number.isNaN(userBranchId) ? Number(userBranchId) : null;

    const applyBranchScope = (targetBranchId: number | null) => {
      if (!targetBranchId || Number.isNaN(targetBranchId)) {
        console.error('Invalid branch_id encountered while scoping suppliers:', targetBranchId);
        throw new Error('Invalid branch context');
      }
      query = query.eq('branch_id', targetBranchId);
    };

    try {
      if (scopeParam === 'global' || scopeParam === 'central') {
        query = query.is('branch_id', null);
      } else if (scopeParam === 'branch') {
        if (isCentral) {
          const requestedBranch = req.query.branchId || req.query.branch_id;
          const branchScope = requestedBranch ? Number(requestedBranch) : branchId;
          if (!branchScope || Number.isNaN(branchScope)) {
            return res.status(400).json({ success: false, message: 'Branch scope requires a valid branch_id' });
          }
          query = query.eq('branch_id', branchScope);
        } else {
          if (!branchId) {
            return res.status(400).json({ success: false, message: 'Branch scope requires a valid branch context' });
          }
          applyBranchScope(branchId);
        }
      } else if (scopeParam === 'all') {
        if (branchId) {
          query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
        }
        // Central users already see all suppliers by default.
      } else {
        // Default behaviour: strictly separate branch vs central (global)
        if (isCentral) {
          query = query.is('branch_id', null);
        } else if (branchId) {
          applyBranchScope(branchId);
        } else {
          return res.status(400).json({ success: false, message: 'Unable to determine branch context for suppliers' });
        }
      }
    } catch (scopeError: any) {
      console.error('Supplier scope error:', scopeError);
      return res.status(400).json({ success: false, message: scopeError.message || 'Invalid supplier scope' });
    }

    // 2. Apply Status Filter
    if (status) {
      query = query.eq('status', String(status).toLowerCase());
    }

    // 3. Apply Category Filter
    if (category) {
      query = query.eq('category', category);
    }

    // 4. Apply Search Filter
    if (search) {
      const searchStr = String(search);
      query = query.or(`name.ilike.%${searchStr}%,supplier_code.ilike.%${searchStr}%,contact_person.ilike.%${searchStr}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    res.status(200).json({
      success: true,
      data: data || []
    });
  } catch (error: any) {
    console.error('Error in getSuppliers:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error occurred while fetching suppliers'
    });
  }
};

// Get supplier by ID
export const getSupplierById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rawBranchId = req.user?.branch_id || req.user?.branchId || req.headers['x-branch-id'] || req.query.branchId;
    const userBranchId = rawBranchId ? Number(rawBranchId) : null;
    const isCentral = !userBranchId || req.user?.role === 'super_admin' || req.user?.role === 'central_storekeeper';

    let query = supabase
      .from('suppliers')
      .select('*')
      .eq('id', id);

    // Branch scoping for single fetch
    if (!isCentral) {
      query = query.or(`branch_id.eq.${userBranchId},branch_id.is.null`);
    }

    const { data, error } = await query.maybeSingle();

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
    const rawBranchId = req.user?.branch_id || req.user?.branchId || req.headers['x-branch-id'] || req.query.branchId;
    const userBranchId = rawBranchId ? Number(rawBranchId) : null;

    // Auto-inject branch_id for branch users
    if (userBranchId && !req.user?.is_central) {
      supplierData.branch_id = userBranchId;
    }

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
