import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// @desc    Get all menu categories
// @route   GET /api/restaurant/menu/categories
// @access  Public
export const getMenuCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: categories, error } = await supabase
      .from('restaurant_menu_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all menu items
// @route   GET /api/restaurant/menu/items
// @access  Public
export const getMenuItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let query = supabase
      .from('restaurant_menu_items')
      .select('*, category:restaurant_menu_categories(*)');

    // Add filters
    if (req.query.category) {
      query = query.eq('category_id', req.query.category);
    }
    if (req.query.available === 'true') {
      query = query.eq('is_available', true);
    }
    if (req.query.vegetarian === 'true') {
      query = query.eq('is_vegetarian', true);
    }

    const { data: items, error } = await query.order('name');

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      data: items
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create menu item
// @route   POST /api/restaurant/menu/items
// @access  Private (Restaurant Staff)
export const createMenuItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      categoryId,
      name,
      description,
      price,
      imageUrl,
      preparationTime,
      isVegetarian,
      isSpicy,
      allergens,
      ingredients
    } = req.body;

    const { data: item, error } = await supabase
      .from('restaurant_menu_items')
      .insert([{
        category_id: categoryId,
        name,
        description,
        price,
        image_url: imageUrl,
        preparation_time: preparationTime,
        is_vegetarian: isVegetarian,
        is_spicy: isSpicy,
        allergens,
        ingredients
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      data: item
    });

    logger.info(`New menu item created: ${name}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Update menu item
// @route   PUT /api/restaurant/menu/items/:id
// @access  Private (Restaurant Staff)
export const updateMenuItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      categoryId,
      name,
      description,
      price,
      imageUrl,
      preparationTime,
      isVegetarian,
      isSpicy,
      allergens,
      ingredients,
      isAvailable
    } = req.body;

    const { data: item, error } = await supabase
      .from('restaurant_menu_items')
      .update({
        category_id: categoryId,
        name,
        description,
        price,
        image_url: imageUrl,
        preparation_time: preparationTime,
        is_vegetarian: isVegetarian,
        is_spicy: isSpicy,
        allergens,
        ingredients,
        is_available: isAvailable,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      data: item
    });

    logger.info(`Menu item updated: ${name}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Create order
// @route   POST /api/restaurant/orders
// @access  Private
export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      orderType,
      tableNumber,
      roomNumber,
      guestId,
      specialInstructions,
      items
    } = req.body;

    // Generate order number
    const { data: orderNumber } = await supabase
      .rpc('generate_order_number');

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('restaurant_orders')
      .insert([{
        order_number: orderNumber,
        order_type: orderType,
        table_number: tableNumber,
        room_number: roomNumber,
        guest_id: guestId,
        special_instructions: specialInstructions,
        total_amount: 0, // Will be calculated by trigger
        created_by: req.user?.id
      }])
      .select()
      .single();

    if (orderError || !order) {
      throw orderError || new Error('Failed to create order');
    }

    // Create order items
    const { error: itemsError } = await supabase
      .from('restaurant_order_items')
      .insert(
        items.map((item: any) => ({
          order_id: order.id,
          menu_item_id: item.menuItemId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.quantity * item.unitPrice,
          special_instructions: item.specialInstructions
        }))
      );

    if (itemsError) {
      throw itemsError;
    }

    // Get updated order with items
    const { data: updatedOrder, error: getError } = await supabase
      .from('restaurant_orders')
      .select(`
        *,
        items:restaurant_order_items(
          *,
          menu_item:restaurant_menu_items(*)
        )
      `)
      .eq('id', order.id)
      .single();

    if (getError) {
      throw getError;
    }

    res.status(201).json({
      success: true,
      data: updatedOrder
    });

    logger.info(`New order created: ${orderNumber}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status
// @route   PUT /api/restaurant/orders/:id/status
// @access  Private (Restaurant Staff)
export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status } = req.body;

    // Get current order
    const { data: order, error: getError } = await supabase
      .from('restaurant_orders')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (getError || !order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    // Update order status
    const { data: updatedOrder, error: updateError } = await supabase
      .from('restaurant_orders')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(status === 'confirmed' ? {
          confirmed_at: new Date().toISOString(),
          confirmed_by: req.user?.id
        } : {}),
        ...(status === 'preparing' ? {
          prepared_at: new Date().toISOString(),
          prepared_by: req.user?.id
        } : {}),
        ...(status === 'delivered' ? {
          delivered_at: new Date().toISOString(),
          delivered_by: req.user?.id
        } : {}),
        ...(status === 'cancelled' ? {
          cancelled_at: new Date().toISOString(),
          cancelled_by: req.user?.id,
          cancellation_reason: req.body.reason
        } : {})
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({
      success: true,
      data: updatedOrder
    });

    logger.info(`Order ${order.order_number} status updated to ${status}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Get order details
// @route   GET /api/restaurant/orders/:id
// @access  Private
export const getOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: order, error } = await supabase
      .from('restaurant_orders')
      .select(`
        *,
        guest:users!guest_id(*),
        items:restaurant_order_items(
          *,
          menu_item:restaurant_menu_items(*)
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error) {
      throw error;
    }

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all orders
// @route   GET /api/restaurant/orders
// @access  Private
export const getOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const startIndex = (page - 1) * limit;

    let query = supabase
      .from('restaurant_orders')
      .select(`
        *,
        guest:users!guest_id(*),
        items:restaurant_order_items(*)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(startIndex, startIndex + limit - 1);

    // Add filters
    if (req.query.status) {
      query = query.eq('status', req.query.status);
    }
    if (req.query.type) {
      query = query.eq('order_type', req.query.type);
    }
    if (req.query.guest) {
      query = query.eq('guest_id', req.query.guest);
    }

    const { data: orders, error, count } = await query;

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      count: orders.length,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get inventory items
// @route   GET /api/restaurant/inventory
// @access  Private (Restaurant Staff)
export const getInventoryItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: items, error } = await supabase
      .from('restaurant_inventory_items')
      .select('*')
      .order('name');

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      data: items
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update inventory item stock
// @route   POST /api/restaurant/inventory/:id/stock
// @access  Private (Restaurant Staff)
export const updateInventoryStock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { transactionType, quantity, notes } = req.body;

    // Create inventory transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('restaurant_inventory_transactions')
      .insert([{
        item_id: req.params.id,
        transaction_type: transactionType,
        quantity,
        notes,
        created_by: req.user?.id
      }])
      .select()
      .single();

    if (transactionError) {
      throw transactionError;
    }

    // Get updated inventory item
    const { data: item, error: itemError } = await supabase
      .from('restaurant_inventory_items')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (itemError) {
      throw itemError;
    }

    res.status(200).json({
      success: true,
      data: {
        item,
        transaction
      }
    });

    logger.info(`Inventory stock updated for item ${item.name}`);
  } catch (error) {
    next(error);
  }
};
