import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { autoDeductIngredients, deductIngredientsForItem } from './kitchen/recipes.controller';

/**
 * Helper to parse branch_id from query or body
 * Returns a number if valid, otherwise undefined
 */
const parseBranchId = (id: any): number | undefined => {
  if (id === undefined || id === null || id === '' || id === 'null' || id === 'undefined' || id === 'true' || id === 'false') {
    return undefined;
  }
  const parsed = parseInt(id);
  return isNaN(parsed) ? undefined : parsed;
};

// @desc    Get all menu categories
// @route   GET /api/restaurant/menu/categories
// @access  Public
export const getMenuCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let query = supabase
      .from('restaurant_menu_categories')
      .select('*')
      .eq('is_active', true);

    const branchId = parseBranchId(req.query.branch_id) || req.user?.branch_id;
    if (branchId) {
      query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
    } else {
      // If no branch_id after parsing, we could optionaly filter by NULL only
      // but usually public menu categories should be shown.
      // query = query.is('branch_id', null);
    }

    const { data: categories, error } = await query
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

export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      name,
      sort_order,
      description,
      is_bar // Added for bar differentiation
    } = req.body;

    const { data: category, error } = await supabase
      .from('restaurant_menu_categories')
      .insert([{
        name,
        sort_order,
        description,
        is_active: true,
        is_bar: is_bar ?? false // Default to false if not specified
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      data: category
    });

    logger.info(`New menu category created: ${name} `);
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
    const branchId = req.user?.branch_id || parseBranchId(req.query.branch_id);
    if (branchId) {
      query = query.or(`branch_id.eq.${branchId}, branch_id.is.null`);
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
      ingredients,
      branchId
    } = req.body;

    const { data: item, error } = await supabase
      .from('restaurant_menu_items')
      .insert([{
        category_id: categoryId,
        name,
        description,
        price,
        image_url: imageUrl,
        preparation_time: preparationTime || 15, // Default to 15 minutes if not provided
        is_vegetarian: isVegetarian ?? false,
        is_spicy: isSpicy ?? false,
        allergens,
        ingredients,
        branch_id: req.user?.branch_id || branchId || null
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

    logger.info(`New menu item created: ${name} `);
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
      category_id,
      name,
      description,
      price,
      imageUrl,
      image_url,
      preparationTime,
      preparation_time,
      isVegetarian,
      is_vegetarian,
      isSpicy,
      is_spicy,
      allergens,
      ingredients,
      isAvailable,
      is_available,
      branchId,
      branch_id
    } = req.body;

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Handle both camelCase and snake_case field names
    if (categoryId !== undefined || category_id !== undefined) updateData.category_id = categoryId || category_id;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (imageUrl !== undefined || image_url !== undefined) updateData.image_url = imageUrl || image_url;
    if (preparationTime !== undefined || preparation_time !== undefined) updateData.preparation_time = preparationTime || preparation_time;
    if (isVegetarian !== undefined || is_vegetarian !== undefined) updateData.is_vegetarian = (isVegetarian ?? is_vegetarian) ?? false;
    if (isSpicy !== undefined || is_spicy !== undefined) updateData.is_spicy = (isSpicy ?? is_spicy) ?? false;
    if (allergens !== undefined) updateData.allergens = allergens;
    if (ingredients !== undefined) updateData.ingredients = ingredients;
    if (isAvailable !== undefined || is_available !== undefined) updateData.is_available = (isAvailable ?? is_available) ?? true;
    if (branchId !== undefined || branch_id !== undefined) updateData.branch_id = branchId || branch_id || null;

    const { data: item, error } = await supabase
      .from('restaurant_menu_items')
      .update(updateData)
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

    logger.info(`Menu item updated: ${name || 'item'} `);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete menu item
// @route   DELETE /api/restaurant/menu/items/:id
// @access  Private (Restaurant Staff)
export const deleteMenuItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('restaurant_menu_items')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Menu item deleted successfully'
    });

    logger.info(`Menu item deleted: ${id} `);
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle menu item availability
// @route   PUT /api/restaurant/menu/items/:id/toggle
// @access  Private (Restaurant Staff)
export const toggleItemAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Get current availability
    const { data: item, error: fetchError } = await supabase
      .from('restaurant_menu_items')
      .select('is_available')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Toggle it
    const { data: updatedItem, error: updateError } = await supabase
      .from('restaurant_menu_items')
      .update({
        is_available: !item.is_available,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.status(200).json({
      success: true,
      data: updatedItem
    });

    logger.info(`Menu item ${id} availability toggled to ${!item.is_available} `);
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
    // Support both camelCase and snake_case field names from frontend
    const orderType = req.body.orderType || req.body.order_type;
    const tableNumber = req.body.tableNumber || req.body.table_number;
    const roomNumber = req.body.roomNumber || req.body.room_number;
    const guestId = req.body.guestId || req.body.guest_id;
    const guestName = req.body.guestName || req.body.guest_name || req.body.customer_name;
    const specialInstructions = req.body.specialInstructions || req.body.special_instructions;
    const items = req.body.items;
    const paymentMethod = req.body.paymentMethod || req.body.payment_method;
    const status = req.body.status;
    // Fallback to user's branch if not provided in body
    const branchId = req.body.branchId || req.body.branch_id || req.user?.branch_id;

    if (!branchId) {
      logger.warn('Order creation attempted without branch_id');
      // Proceeding might be okay for super admin or specific cases, but let's log it.
      // Ideally we should probably require it, but legacy data might not have it.
    }

    // Generate order number
    // console.log('Generating order number via RPC...');
    const { data: orderNumber, error: rpcError } = await supabase
      .rpc('generate_order_number');

    if (rpcError) {
      console.error('RPC Error generating order number:', rpcError);
      logger.error('RPC Error generating order number', { error: rpcError });
    }

    // Determine order number with fallback
    const finalOrderNumber = orderNumber || `ORD${new Date().toISOString().replace(/[-:T]/g, '').slice(2, 12)}`;
    // console.log('Final order number being used:', finalOrderNumber);

    // Create order
    const orderData = {
      order_number: finalOrderNumber,
      order_type: orderType,
      table_number: tableNumber,
      room_number: roomNumber,
      guest_id: guestId,
      guest_name: guestName,
      special_instructions: specialInstructions,
      total_amount: 0, // Will be calculated by trigger
      payment_method: paymentMethod,
      payment_status: status === 'confirmed' ? 'paid' : 'pending',
      status: status || 'pending',
      confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
      confirmed_by: status === 'confirmed' ? req.user?.id : null,
      created_by: req.user?.id,
      branch_id: branchId
    };

    // console.log('Creating order with data:', JSON.stringify(orderData, null, 2));

    const { data: order, error: orderError } = await supabase
      .from('restaurant_orders')
      .insert([orderData])
      .select()
      .single();

    if (orderError || !order) {
      throw orderError || new Error('Failed to create order');
    }

    // Create order items - support both camelCase and snake_case field names
    // console.log('Creating order items, received items:', JSON.stringify(items, null, 2));

    if (!items || items.length === 0) {
      throw new Error('No items provided for order');
    }

    const orderItems = items.map((item: any) => {
      const menuItemId = item.menuItemId || item.menu_item_id;
      const unitPrice = item.unitPrice || item.unit_price;
      const qty = item.quantity;
      const notes = item.specialInstructions || item.special_instructions || item.notes;

      // console.log('Processing item:', { menuItemId, unitPrice, qty, notes });

      return {
        order_id: order.id,
        menu_item_id: menuItemId,
        quantity: qty,
        unit_price: unitPrice,
        total_price: qty * unitPrice,
        special_instructions: notes
      };
    });

    // console.log('Inserting order items:', JSON.stringify(orderItems, null, 2));

    const { error: itemsError } = await supabase
      .from('restaurant_order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error inserting order items:', itemsError);
      throw itemsError;
    }

    // console.log('Order items created successfully');

    // Calculate total amount from order items
    const totalAmount = orderItems.reduce((sum: number, item: any) => sum + item.total_price, 0);

    // Update order with calculated total
    const { error: updateError } = await supabase
      .from('restaurant_orders')
      .update({ total_amount: totalAmount })
      .eq('id', order.id);

    if (updateError) {
      throw updateError;
    }

    // Get updated order with items
    const { data: updatedOrder, error: getError } = await supabase
      .from('restaurant_orders')
      .select(`
  *,
  items: restaurant_order_items(
          *,
    menu_item: restaurant_menu_items(*)
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

    logger.info(`New order created: ${orderNumber} `);
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

    // Update order status - only update status and timestamps, not user references
    // (prepared_by, delivered_by, cancelled_by reference staff_profiles, not users)
    const { data: updatedOrder, error: updateError } = await supabase
      .from('restaurant_orders')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(status === 'confirmed' ? {
          confirmed_at: new Date().toISOString()
        } : {}),
        ...(status === 'preparing' ? {
          prepared_at: new Date().toISOString()
        } : {}),
        ...(status === 'ready' ? {
          prepared_at: new Date().toISOString()
        } : {}),
        ...(status === 'delivered' || status === 'served' ? {
          delivered_at: new Date().toISOString()
        } : {}),
        ...(status === 'cancelled' ? {
          cancelled_at: new Date().toISOString(),
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

    logger.info(`Order ${order.order_number} status updated to ${status} `);

    // Auto-deduct ingredients if served or delivered
    if (['served', 'delivered'].includes(status)) {
      try {
        // Get order items if not already joined
        const { data: orderWithItems } = await supabase
          .from('restaurant_orders')
          .select('*, items:restaurant_order_items(*)')
          .eq('id', req.params.id)
          .single();

        if (orderWithItems && orderWithItems.items) {
          for (const item of orderWithItems.items) {
            await deductIngredientsForItem({
              order_id: orderWithItems.id,
              menu_item_id: item.menu_item_id,
              quantity: item.quantity,
              branch_id: orderWithItems.branch_id,
              user_id: req.user?.id
            });
          }
          logger.info(`Ingredients auto-deducted for order ${orderWithItems.order_number}`);
        }
      } catch (deductError) {
        logger.error(`Error in auto-deduction for order ${req.params.id}:`, deductError);
        // Don't fail the request if deduction fails
      }
    }

    res.status(200).json({
      success: true,
      data: updatedOrder
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add items to existing order
// @route   POST /api/restaurant/orders/:id/items
// @access  Private (Restaurant Staff)
export const addItemsToOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No items provided'
      });
      return;
    }

    // Get current order
    const { data: order, error: getError } = await supabase
      .from('restaurant_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (getError || !order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    if (order.status === 'completed' || order.status === 'cancelled' || order.status === 'paid') {
      res.status(400).json({
        success: false,
        message: 'Cannot add items to a completed, cancelled, or paid order'
      });
      return;
    }

    // Create new order items
    const newItems = items.map((item: any) => ({
      order_id: id,
      menu_item_id: item.menu_item_id || item.id, // Support both formats
      quantity: item.quantity,
      unit_price: item.unit_price || item.price,
      total_price: (item.quantity) * (item.unit_price || item.price),
      special_instructions: item.notes || item.special_instructions
    }));

    const { error: insertError } = await supabase
      .from('restaurant_order_items')
      .insert(newItems);

    if (insertError) {
      throw insertError;
    }

    // Recalculate total amount for the order
    // We could sum existing + new, but safest is to re-query all items
    const { data: allItems, error: itemsError } = await supabase
      .from('restaurant_order_items')
      .select('total_price')
      .eq('order_id', id);

    if (itemsError) throw itemsError;

    const newTotal = allItems.reduce((sum, item) => sum + item.total_price, 0);

    // Update order total and updated_at
    const { data: updatedOrder, error: updateError } = await supabase
      .from('restaurant_orders')
      .update({
        total_amount: newTotal,
        updated_at: new Date().toISOString(),
        // Check if we need to revert status if it was ready?
        // Usually adding items puts it back to preparing or pending if they need kitchen work.
        // For now, let's set to 'preparing' if it was 'ready' or 'served', or keep 'pending'.
        status: (order.status === 'ready' || order.status === 'served') ? 'preparing' : order.status
      })
      .eq('id', id)
      .select(`
        *,
        items:restaurant_order_items(
          *,
          menu_item:restaurant_menu_items(*)
        )
      `)
      .single();

    if (updateError) throw updateError;

    res.status(200).json({
      success: true,
      data: updatedOrder,
      message: 'Items added to order successfully'
    });

    logger.info(`Items added to order ${order.order_number}`);

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
  guest: users!guest_id(*),
    items: restaurant_order_items(
          *,
      menu_item: restaurant_menu_items(*)
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
      guest: users!guest_id(*),
        items: restaurant_order_items(
          *,
          menu_item: restaurant_menu_items(*)
        )
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
    const branchId = req.user?.branch_id || parseBranchId(req.query.branch_id);
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    if (req.query.date) {
      const date = req.query.date as string;
      const startDate = `${date}T00:00:00`;
      const endDate = `${date}T23:59:59`;
      query = query.gte('created_at', startDate).lte('created_at', endDate);
    }
    // Handle from_date and to_date (used by frontend getMyOrders)
    if (req.query.from_date && req.query.to_date) {
      const fromDate = `${req.query.from_date}T00:00:00`;
      const toDate = `${req.query.to_date}T23:59:59`;
      query = query.gte('created_at', fromDate).lte('created_at', toDate);
    }
    // Handle startDate and endDate (legacy support)
    if (req.query.startDate && req.query.endDate) {
      query = query.gte('created_at', req.query.startDate).lte('created_at', req.query.endDate);
    }
    if (req.query.created_by) {
      query = query.eq('created_by', req.query.created_by);
    }

    const { data: orders, error, count } = await query;

    if (error) {
      throw error;
    }

    // Transform data to match frontend expectations
    const transformedOrders = orders?.map(order => ({
      ...order,
      total: order.total_amount, // Map total_amount to total for frontend
      items_count: order.items?.length || 0
    })) || [];

    res.status(200).json({
      success: true,
      count: orders.length,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
      data: transformedOrders
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

// =====================================================
// ROOM SERVICE ENDPOINTS
// =====================================================

// @desc    Create room service order
// @route   POST /api/restaurant/room-service
// @access  Private (Receptionist, Restaurant Staff)
export const createRoomServiceOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { room_number, items, special_instructions, guest_name } = req.body;

    if (!room_number || !items || items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Room number and at least one item are required'
      });
      return;
    }

    // Get room details to find guest
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, room_number, branch_id')
      .eq('room_number', room_number)
      .single();

    if (roomError && roomError.code !== 'PGRST116') {
      logger.warn(`Room ${room_number} not found, proceeding anyway`);
    }

    // Calculate total from menu items
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const { data: menuItem, error: menuError } = await supabase
        .from('restaurant_menu_items')
        .select('id, name, price')
        .eq('id', item.menu_item_id)
        .single();

      if (menuError) {
        logger.warn(`Menu item ${item.menu_item_id} not found`);
        continue;
      }

      const itemTotal = menuItem.price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        menu_item_id: menuItem.id,
        name: menuItem.name,
        quantity: item.quantity,
        unit_price: menuItem.price,
        total_price: itemTotal,
        notes: item.notes || null
      });
    }

    // Create the room service order
    const { data: order, error: orderError } = await supabase
      .from('restaurant_orders')
      .insert([{
        order_type: 'room_service',
        room_number: room_number,
        room_id: room?.id || null,
        branch_id: room?.branch_id || null,
        guest_name: guest_name || null,
        status: 'pending',
        total_amount: totalAmount,
        special_instructions: special_instructions || null,
        created_by: req.user?.id
      }])
      .select()
      .single();

    if (orderError) {
      throw orderError;
    }

    // Insert order items
    const orderItemsWithOrderId = orderItems.map(item => ({
      ...item,
      order_id: order.id
    }));

    const { error: itemsError } = await supabase
      .from('restaurant_order_items')
      .insert(orderItemsWithOrderId);

    if (itemsError) {
      logger.error('Error inserting order items:', itemsError);
    }

    res.status(201).json({
      success: true,
      data: {
        ...order,
        items: orderItems
      },
      message: 'Room service order created successfully'
    });

    logger.info(`Room service order created for room ${room_number}, total: ${totalAmount} `);
  } catch (error) {
    next(error);
  }
};

// @desc    Get room service orders
// @route   GET /api/restaurant/room-service
// @access  Private (Receptionist, Restaurant Staff)
export const getRoomServiceOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let query = supabase
      .from('restaurant_orders')
      .select('*, items:restaurant_order_items(*)')
      .eq('order_type', 'room_service')
      .order('created_at', { ascending: false });

    if (req.query.status) {
      query = query.eq('status', req.query.status);
    }

    if (req.query.room_number) {
      query = query.eq('room_number', req.query.room_number);
    }

    if (req.query.branch_id) {
      const bId = parseBranchId(req.query.branch_id);
      if (bId) query = query.eq('branch_id', bId);
    }

    const { data: orders, error } = await query;

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update room service order status
// @route   PUT /api/restaurant/room-service/:id/status
// @access  Private (Restaurant Staff)
export const updateRoomServiceOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status.Must be one of: ${validStatuses.join(', ')} `
      });
      return;
    }

    const updateData: any = { status };
    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    const { data: order, error } = await supabase
      .from('restaurant_orders')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('order_type', 'room_service')
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      data: order,
      message: `Order status updated to ${status} `
    });

    logger.info(`Room service order ${req.params.id} status updated to ${status} `);
  } catch (error) {
    next(error);
  }
};

// @desc    Upload menu item image
// @route   POST /api/restaurant/menu/items/:id/image
// @access  Private (Restaurant Staff)
export const uploadMenuItemImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { imageBase64, fileName, contentType } = req.body;

    if (!imageBase64) {
      res.status(400).json({ success: false, message: 'No image provided' });
      return;
    }

    // Decode base64
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique filename
    const ext = contentType?.split('/')[1] || 'jpg';
    const uniqueFileName = `menu - items / ${id}/${Date.now()}.${ext}`;

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('menu-images')
      .upload(uniqueFileName, buffer, {
        contentType: contentType || 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('menu-images')
      .getPublicUrl(uniqueFileName);

    const imageUrl = urlData.publicUrl;

    // Update menu item with image URL
    const { data: item, error: updateError } = await supabase
      .from('restaurant_menu_items')
      .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({
      success: true,
      data: { image_url: imageUrl, item }
    });

    logger.info(`Menu item ${id} image uploaded`);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete menu item image
// @route   DELETE /api/restaurant/menu/items/:id/image
// @access  Private (Restaurant Staff)
export const deleteMenuItemImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Get current item to find image path
    const { data: item, error: fetchError } = await supabase
      .from('restaurant_menu_items')
      .select('image_url')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (item?.image_url) {
      // Extract path from URL
      const urlParts = item.image_url.split('/menu-images/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('menu-images').remove([filePath]);
      }
    }

    // Clear image URL in database
    const { error: updateError } = await supabase
      .from('restaurant_menu_items')
      .update({ image_url: null, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;

    res.status(200).json({ success: true, message: 'Image deleted' });
  } catch (error) {
    next(error);
  }
};
// @desc    Get daily sales report
// @route   GET /api/restaurant/reports/daily-sales
// @access  Private
export const getDailySales = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const date = req.query.date as string || new Date().toISOString().split('T')[0];
    const branchId = parseBranchId(req.query.branch_id);

    const startDate = `${date}T00:00:00`;
    const endDate = `${date}T23:59:59`;

    let query = supabase
      .from('restaurant_orders')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .neq('status', 'cancelled');

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data: orders, error } = await query;

    if (error) {
      throw error;
    }

    const total = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
    const ordersCount = orders?.length || 0;
    const avgOrderValue = ordersCount > 0 ? total / ordersCount : 0;

    const byType = {
      dine_in: orders?.filter(o => o.order_type === 'dine_in').length || 0,
      takeaway: orders?.filter(o => o.order_type === 'takeaway').length || 0,
      room_service: orders?.filter(o => o.order_type === 'room_service').length || 0
    };

    res.status(200).json({
      success: true,
      data: {
        date,
        total,
        orders_count: ordersCount,
        avg_order_value: avgOrderValue,
        by_type: byType
      }
    });
  } catch (error) {
    next(error);
  }
};
