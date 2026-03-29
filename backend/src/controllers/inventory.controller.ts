import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { applyBranchFilter } from '../utils/branchIsolation';

// @desc    Get all inventory items
// @route   GET /api/inventory/items
// @access  Private
export const getItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let query = supabase
      .from('inventory_items')
      .select('*');

    query = applyBranchFilter(query, req);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single inventory item
// @route   GET /api/inventory/items/:id
// @access  Private
export const getItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({
        success: false,
        message: 'Item not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create inventory item
// @route   POST /api/inventory/items
// @access  Private
export const createItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      item_code, code,
      name,
      description,
      category,
      unit,
      min_stock_level, minStock,
      max_stock_level, maxStock,
      reorder_level, reorderPoint,
      unit_cost, unitCost,
      supplier,
      branch_id, branchId, branch,
      is_active
    } = req.body;

    // Robust mapping from possible frontend names to DB names
    const item = {
      item_code: item_code || code,
      name,
      description,
      category: category || 'other',
      unit: unit || 'pcs',
      min_stock_level: min_stock_level || minStock || 0,
      max_stock_level: max_stock_level || maxStock || 0,
      reorder_level: reorder_level || reorderPoint || min_stock_level || minStock || 0,
      unit_cost: unit_cost || unitCost || 0,
      supplier,
      branch_id: branch_id || branchId || (branch === 'Bomet' ? 1 : branch === 'Kericho' ? 2 : branch === 'Kapsoit' ? 3 : branch === 'Litein' ? 4 : null),
      is_active: is_active !== undefined ? is_active : true,
      created_by_id: req.user?.id,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('inventory_items') // Standardize on inventory_items for general module
      .insert([item])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update inventory item
// @route   PUT /api/inventory/items/:id
// @access  Private
export const updateItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .update({
        ...req.body,
        updated_at: new Date().toISOString(),
        updated_by_id: req.user.id
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete inventory item
// @route   DELETE /api/inventory/items/:id
// @access  Private
export const deleteItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add stock movement
// @route   POST /api/inventory/items/:id/movements
// @access  Private
export const addStockMovement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const movement = {
      item_id: req.params.id,
      ...req.body,
      performed_by_id: req.user.id,
      performed_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('stock_movements')
      .insert([movement])
      .select()
      .single();

    if (error) throw error;

    // Update item's current stock
    const { error: updateError } = await supabase.rpc('update_stock_level', {
      item_id: req.params.id,
      quantity: movement.type === 'in' ? movement.quantity : -movement.quantity
    });

    if (updateError) throw updateError;

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get stock movements
// @route   GET /api/inventory/movements
// @access  Private
export const getStockMovements = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let query = supabase
      .from('stock_movements')
      .select(`
        *,
        item:inventory_items (*),
        performed_by:users (*)
      `);

    // Using item's branch_id since movements might rely on inventory_items
    // Actually, stock_movements should have branch_id. If not, join and filter. 
    // We'll assume stock_movements has branch_id, or we filter the joined item.branch_id
    query = applyBranchFilter(query, req);

    const { data, error } = await query.order('performed_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get low stock items
// @route   GET /api/inventory/low-stock
// @access  Private
export const getLowStockItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Use simple_items table and compare quantity with reorder_level
    let query = supabase
      .from('simple_items')
      .select('*')
      .eq('is_active', true)
      .lte('quantity', 10); // Items at or below reorder level

    query = applyBranchFilter(query, req);

    const { data, error } = await query.order('quantity', { ascending: true });

    if (error) throw error;

    // Filter items where quantity <= reorder_level
    const lowStockItems = (data || []).filter(item =>
      (item.quantity || 0) <= (item.reorder_level || 10)
    );

    res.status(200).json({
      success: true,
      count: lowStockItems.length,
      data: lowStockItems
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get inventory stats
// @route   GET /api/inventory/stats
// @access  Private
export const getInventoryStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get total items count
    let countQuery = supabase
      .from('simple_items')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    countQuery = applyBranchFilter(countQuery, req);
    const { count: totalItems, error: countError } = await countQuery;

    if (countError) throw countError;

    // Get items for calculations
    let dataQuery = supabase
      .from('simple_items')
      .select('quantity, cost_price, reorder_level')
      .eq('is_active', true);

    dataQuery = applyBranchFilter(dataQuery, req);
    const { data: items, error: itemsError } = await dataQuery;

    if (itemsError) throw itemsError;

    // Calculate low stock and total value
    const lowStockCount = (items || []).filter(item =>
      (item.quantity || 0) <= (item.reorder_level || 10)
    ).length;

    const totalValue = (items || []).reduce(
      (sum, item) => sum + ((item.quantity || 0) * (item.cost_price || 0)),
      0
    );

    res.status(200).json({
      success: true,
      data: {
        totalItems: totalItems || 0,
        lowStockCount,
        totalValue
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create purchase order
// @route   POST /api/inventory/purchase-orders
// @access  Private
export const createPurchaseOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const order = {
      ...req.body,
      status: 'draft',
      created_by_id: req.user.id,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('purchase_orders')
      .insert([order])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update purchase order
// @route   PUT /api/inventory/purchase-orders/:id
// @access  Private
export const updatePurchaseOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        ...req.body,
        updated_at: new Date().toISOString(),
        updated_by_id: req.user.id
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete purchase order
// @route   DELETE /api/inventory/purchase-orders/:id
// @access  Private
export const deletePurchaseOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all purchase orders
// @route   GET /api/inventory/purchase-orders
// @access  Private
export const getPurchaseOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers (*),
        created_by:users!created_by_id (*),
        approved_by:users!approved_by_id (*)
      `);

    query = applyBranchFilter(query, req);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single purchase order
// @route   GET /api/inventory/purchase-orders/:id
// @access  Private
export const getPurchaseOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers (*),
        created_by:users!created_by_id (*),
        approved_by:users!approved_by_id (*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve purchase order
// @route   PUT /api/inventory/purchase-orders/:id/approve
// @access  Private
export const approvePurchaseOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'approved',
        approved_by_id: req.user.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Receive purchase order
// @route   PUT /api/inventory/purchase-orders/:id/receive
// @access  Private
export const receivePurchaseOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .update({
        status: 'received',
        received_by_id: req.user.id,
        received_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (orderError) throw orderError;

    // Update inventory levels
    const { error: itemsError } = await supabase.rpc('receive_purchase_order', {
      order_id: req.params.id
    });

    if (itemsError) throw itemsError;

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create supplier
// @route   POST /api/inventory/suppliers
// @access  Private
export const createSupplier = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const supplier = {
      ...req.body,
      created_by_id: req.user.id,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('suppliers')
      .insert([supplier])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update supplier
// @route   PUT /api/inventory/suppliers/:id
// @access  Private
export const updateSupplier = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .update({
        ...req.body,
        updated_at: new Date().toISOString(),
        updated_by_id: req.user.id
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete supplier
// @route   DELETE /api/inventory/suppliers/:id
// @access  Private
export const deleteSupplier = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all suppliers
// @route   GET /api/inventory/suppliers
// @access  Private
export const getSuppliers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single supplier
// @route   GET /api/inventory/suppliers/:id
// @access  Private
export const getSupplier = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload item photos
// @route   POST /api/inventory/items/:id/photos
// @access  Private
export const uploadItemPhotos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    const uploadPromises = files.map(async (file) => {
      const { data, error } = await supabase.storage
        .from('inventory-photos')
        .upload(
          `items/${req.params.id}/${Date.now()}-${file.originalname}`,
          file.buffer,
          {
            contentType: file.mimetype
          }
        );

      if (error) throw error;
      return data;
    });

    const uploadedFiles = await Promise.all(uploadPromises);

    // Get existing photos
    const { data: item, error: itemError } = await supabase
      .from('inventory_items')
      .select('photos')
      .eq('id', req.params.id)
      .single();

    if (itemError) throw itemError;

    // Update item with new photos
    const photos = [...(item.photos || []), ...uploadedFiles.map(f => f.path)];
    const { data, error } = await supabase
      .from('inventory_items')
      .update({ photos })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};
