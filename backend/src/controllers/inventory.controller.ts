import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { applyBranchFilter } from '../utils/branchIsolation';

const branchNameToId = (branch: unknown): number | null => {
  if (branch === null || branch === undefined || branch === '') return null;
  const parsed = Number(branch);
  if (Number.isFinite(parsed)) return parsed;

  const normalized = String(branch).trim().toLowerCase();
  const map: Record<string, number> = {
    bomet: 1,
    kericho: 2,
    kapsoit: 3,
    litein: 4
  };
  return map[normalized] ?? null;
};

const numberValue = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const generateSimpleSku = (name: string, category = 'general'): string => {
  const categoryCode = category.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'GEN';
  const nameCode = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'ITEM';
  return `INV-${categoryCode}-${nameCode}-${Date.now().toString().slice(-6)}`;
};

const mapSimpleInventoryItem = (item: any) => {
  const quantity = numberValue(item.quantity);
  const unitCost = numberValue(item.cost_price ?? item.unit_cost);
  const reorderLevel = numberValue(item.reorder_level);
  const name = item.item_name || item.name || item.description || item.sku || '';
  const status = quantity <= 0
    ? 'out'
    : quantity <= reorderLevel
      ? 'critical'
      : quantity <= reorderLevel * 1.5
        ? 'low'
        : 'in_stock';

  return {
    ...item,
    id: item.sku,
    item_code: item.sku,
    code: item.sku,
    name,
    sku: item.sku,
    unit: item.unit_of_measure || item.unit || 'units',
    unit_cost: unitCost,
    unitCost,
    reorderLevel,
    min_stock_level: reorderLevel,
    max_stock_level: item.max_order_quantity ?? 0,
    status,
    supplierName: item.supplier || '',
    branchId: item.branch_id != null ? String(item.branch_id) : '',
    totalValue: quantity * unitCost
  };
};

const toSimpleItemPayload = (body: any, req: Request, isUpdate = false) => {
  const itemName = body.item_name || body.name || body.description || '';
  const category = body.category || 'other';
  const costPrice = numberValue(body.cost_price ?? body.unit_cost ?? body.unitCost, 0);
  const branchId = branchNameToId(body.branch_id ?? body.branchId ?? body.branch);
  const payload: any = {
    item_name: itemName,
    description: body.description || itemName,
    category,
    unit_of_measure: body.unit_of_measure || body.unit || 'units',
    quantity: numberValue(body.quantity ?? body.current_stock ?? body.stock_quantity, 0),
    cost_price: costPrice,
    retail_price: numberValue(body.retail_price ?? body.selling_price, costPrice),
    reorder_level: numberValue(
      body.reorder_level ?? body.reorderLevel ?? body.min_stock_level ?? body.minStock,
      10
    ),
    supplier: body.supplier || body.supplierName || null,
    barcode: body.barcode || null,
    image_url: body.image_url || body.imageUrl || null,
    store_type: body.store_type || body.storeType || null,
    branch_id: branchId,
    is_active: body.is_active !== undefined ? body.is_active : true,
    is_master_item: body.is_master_item !== undefined ? body.is_master_item : true,
    min_order_quantity: numberValue(body.min_order_quantity, 1),
    max_order_quantity: numberValue(body.max_order_quantity ?? body.max_stock_level ?? body.maxStock, 1000),
    lead_time_days: numberValue(body.lead_time_days, 0),
    is_perishable: body.is_perishable ?? false,
    shelf_life_days: body.shelf_life_days ?? null,
    last_updated: new Date().toISOString()
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });

  if (!isUpdate) {
    payload.sku = body.sku || body.item_code || body.code || generateSimpleSku(itemName, category);
  } else {
    delete payload.sku;
    if (body.item_name === undefined && body.name === undefined && body.description === undefined) {
      delete payload.item_name;
      delete payload.description;
    }
    if (body.quantity === undefined && body.current_stock === undefined && body.stock_quantity === undefined) {
      delete payload.quantity;
    }
    if (body.branch_id === undefined && body.branchId === undefined && body.branch === undefined) {
      delete payload.branch_id;
    }
    if (body.retail_price === undefined && body.selling_price === undefined) {
      delete payload.retail_price;
    }
    if (body.supplier === undefined && body.supplierName === undefined) {
      delete payload.supplier;
    }
    if (body.barcode === undefined) {
      delete payload.barcode;
    }
    if (body.image_url === undefined && body.imageUrl === undefined) {
      delete payload.image_url;
    }
    if (body.store_type === undefined && body.storeType === undefined) {
      delete payload.store_type;
    }
    if (body.is_active === undefined) {
      delete payload.is_active;
    }
    if (body.min_order_quantity === undefined) {
      delete payload.min_order_quantity;
    }
    if (body.max_order_quantity === undefined && body.max_stock_level === undefined && body.maxStock === undefined) {
      delete payload.max_order_quantity;
    }
    if (body.lead_time_days === undefined) {
      delete payload.lead_time_days;
    }
    if (body.is_perishable === undefined) {
      delete payload.is_perishable;
    }
    if (body.shelf_life_days === undefined) {
      delete payload.shelf_life_days;
    }
  }

  return payload;
};

// @desc    Get all inventory items
// @route   GET /api/inventory/items
// @access  Private
export const getItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branch_id, branchId, branch, category, search, store_type } = req.query;
    const branchFilter = branchNameToId(branch_id ?? branchId ?? branch);

    let query = supabase
      .from('simple_items')
      .select('*')
      .eq('is_active', true);

    if (branchFilter !== null) query = query.eq('branch_id', branchFilter);
    if (category) query = query.eq('category', String(category));
    if (store_type) query = query.eq('store_type', String(store_type));
    if (search) {
      const searchTerm = String(search).trim();
      query = query.or(`sku.ilike.%${searchTerm}%,item_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`);
    }

    query = applyBranchFilter(query, req);

    const limit = numberValue(req.query.limit, 500);
    const page = numberValue(req.query.page, 1);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error } = await query
      .order('last_updated', { ascending: false })
      .range(from, to);

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data: (data || []).map(mapSimpleInventoryItem)
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
    let { data, error } = await supabase
      .from('simple_items')
      .select('*')
      .eq('sku', req.params.id)
      .maybeSingle();

    if (!data && !error) {
      const barcodeResult = await supabase
        .from('simple_items')
        .select('*')
        .eq('barcode', req.params.id)
        .maybeSingle();
      data = barcodeResult.data;
      error = barcodeResult.error;
    }

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
      data: mapSimpleInventoryItem(data)
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
    const item = toSimpleItemPayload(req.body, req);

    const { data, error } = await supabase
      .from('simple_items')
      .insert([item])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: mapSimpleInventoryItem(data)
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
    const payload = toSimpleItemPayload(req.body, req, true);

    let { data, error } = await supabase
      .from('simple_items')
      .update(payload)
      .eq('sku', req.params.id)
      .select()
      .maybeSingle();

    if (!data && !error) {
      const barcodeResult = await supabase
        .from('simple_items')
        .update(payload)
        .eq('barcode', req.params.id)
        .select()
        .maybeSingle();
      data = barcodeResult.data;
      error = barcodeResult.error;
    }

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
      data: mapSimpleInventoryItem(data)
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
    let { data, error } = await supabase
      .from('simple_items')
      .update({ is_active: false, last_updated: new Date().toISOString() })
      .eq('sku', req.params.id)
      .select('sku')
      .maybeSingle();

    if (!data && !error) {
      const barcodeResult = await supabase
        .from('simple_items')
        .update({ is_active: false, last_updated: new Date().toISOString() })
        .eq('barcode', req.params.id)
        .select('sku')
        .maybeSingle();
      data = barcodeResult.data;
      error = barcodeResult.error;
    }

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
