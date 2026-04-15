import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';
import {
  generateSKU,
  generateAutoSKU,
  generateOrderNumber,
  previewSKU,
  getCategories,
  getCategoryCode
} from '../../services/sku.service';

// @desc    Get all items
// @route   GET /api/store/items
// @access  Private
export const getItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { search, ordering, category } = req.query;

    let query = supabase
      .from('simple_items')
      .select('*')
      .eq('is_active', true);

    // Filter by category if provided
    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`description.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    if (ordering) {
      const orderStr = String(ordering);
      // Check for negative sign for descending
      const isDesc = orderStr.startsWith('-');
      const field = isDesc ? orderStr.substring(1) : orderStr;

      // Special case for quantity if needed, but basic sort works
      query = query.order(field, { ascending: !isDesc });
    } else {
      query = query.order('last_updated', { ascending: false });
    }

    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    // Default limit 200 to ensure all items are visible by default
    const limit = parseInt(req.query.limit as string) || 200;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Get stats for the cards - fetch all items to calculate accurate stats
    const { data: allItems, error: statsError } = await supabase
      .from('simple_items')
      .select('sku, quantity, reorder_level')
      .eq('is_active', true);

    if (statsError) throw statsError;

    const total = allItems?.length || 0;
    const outOfStock = allItems?.filter(item => (item.quantity || 0) === 0).length || 0;
    const lowStock = allItems?.filter(item => {
      const qty = item.quantity || 0;
      const reorder = item.reorder_level || 10;
      return qty > 0 && qty <= reorder;
    }).length || 0;
    const inStock = total - outOfStock;

    const stats = {
      total,
      lowStock,
      outOfStock,
      inStock
    };

    // Apply range
    query = query.range(from, to);

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data?.length || 0,
      total: stats.total,
      page,
      pages: Math.ceil((stats.total || 0) / limit),
      stats,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single item (by SKU or Barcode)
// @route   GET /api/store/items/:id
// @access  Private
export const getItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id;
    // Try SKU first, then Barcode
    const { data, error } = await supabase
      .from('simple_items')
      .select('*')
      .or(`sku.eq.${id},barcode.eq.${id}`)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

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

// @desc    Create item
// @route   POST /api/store/items
// @access  Private (Manager)
// @desc    Suggest category and unit based on item name
export const suggestItemAttributes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { item_name } = req.body;
    if (!item_name) {
      res.status(400).json({ success: false, message: 'Item name is required' });
      return;
    }

    const name = item_name.toLowerCase();
    let category = 'other';
    let unit_of_measure = 'pcs';

    const foodKeywords = ['flour', 'sugar', 'milk', 'rice', 'salt', 'oil', 'beef', 'chicken', 'fish', 'potato', 'tomato', 'onion', 'bread', 'butter', 'egg', 'spice', 'garlic', 'ginger'];
    const beverageKeywords = ['beer', 'wine', 'soda', 'juice', 'water', 'whiskey', 'gin', 'vodka', 'coke', 'sprite', 'fanta', 'pepsi', 'tonic', 'cocktail'];
    const toiletriesKeywords = ['soap', 'shampoo', 'tissue', 'toothpaste', 'brush', 'lotion', 'towel'];

    const kgKeywords = ['flour', 'sugar', 'rice', 'salt', 'beef', 'chicken', 'fish', 'meat', 'potato', 'onion', 'tomato'];
    const literKeywords = ['milk', 'oil', 'juice', 'water', 'wine', 'whiskey', 'gin', 'vodka'];
    const packetKeywords = ['spice', 'biscuits', 'snack', 'tea', 'coffee'];
    const bottleKeywords = ['beer', 'soda', 'shampoo', 'lotion'];

    if (foodKeywords.some(k => name.includes(k))) category = 'food';
    else if (beverageKeywords.some(k => name.includes(k))) category = 'beverage';
    else if (toiletriesKeywords.some(k => name.includes(k))) category = 'toiletries';

    if (kgKeywords.some(k => name.includes(k))) unit_of_measure = 'kg';
    else if (literKeywords.some(k => name.includes(k))) unit_of_measure = 'liters';
    else if (packetKeywords.some(k => name.includes(k))) unit_of_measure = 'packets';
    else if (bottleKeywords.some(k => name.includes(k))) unit_of_measure = 'bottles';

    res.status(200).json({
      success: true,
      data: { category, unit_of_measure }
    });
  } catch (error) {
    next(error);
  }
};

export const createItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let {
      sku, description, retail_price, quantity,
      barcode, item_name, category, unit_of_measure,
      cost_price, supplier, reorder_level, image_url
    } = req.body;

    // =====================================================
    // SMART CATEGORIZATION & UNIT SUGGESTIONS
    // =====================================================
    if (item_name && (!category || !unit_of_measure)) {
      const name = item_name.toLowerCase();

      const foodKeywords = ['flour', 'sugar', 'milk', 'rice', 'salt', 'oil', 'beef', 'chicken', 'fish', 'potato', 'tomato', 'onion', 'bread', 'butter', 'egg', 'spice', 'garlic', 'ginger'];
      const beverageKeywords = ['beer', 'wine', 'soda', 'juice', 'water', 'whiskey', 'gin', 'vodka', 'coke', 'sprite', 'fanta', 'pepsi', 'tonic', 'cocktail'];
      const toiletriesKeywords = ['soap', 'shampoo', 'tissue', 'toothpaste', 'brush', 'lotion', 'towel'];

      const kgKeywords = ['flour', 'sugar', 'rice', 'salt', 'beef', 'chicken', 'fish', 'meat', 'potato', 'onion', 'tomato'];
      const literKeywords = ['milk', 'oil', 'juice', 'water', 'wine', 'whiskey', 'gin', 'vodka'];
      const packetKeywords = ['spice', 'biscuits', 'snack', 'tea', 'coffee'];
      const bottleKeywords = ['beer', 'soda', 'shampoo', 'lotion'];

      if (!category) {
        if (foodKeywords.some(k => name.includes(k))) category = 'food';
        else if (beverageKeywords.some(k => name.includes(k))) category = 'beverage';
        else if (toiletriesKeywords.some(k => name.includes(k))) category = 'toiletries';
      }

      if (!unit_of_measure) {
        if (kgKeywords.some(k => name.includes(k))) unit_of_measure = 'kg';
        else if (literKeywords.some(k => name.includes(k))) unit_of_measure = 'liters';
        else if (packetKeywords.some(k => name.includes(k))) unit_of_measure = 'packets';
        else if (bottleKeywords.some(k => name.includes(k))) unit_of_measure = 'bottles';
      }
    }

    // =====================================================
    // AUTO-GENERATE SKU IF NOT PROVIDED
    // Format: FGH-[CATEGORY]-[PRODUCT]-[SERIAL]
    // =====================================================
    let isAutoSku = false;
    let categoryCode = '';

    if (!sku || sku.trim() === '') {
      // Generate SKU automatically
      const skuResult = await generateSKU(
        category || 'General',
        item_name || description || 'Item',
        barcode
      );
      sku = skuResult.sku;
      isAutoSku = skuResult.isAuto;
      categoryCode = skuResult.categoryCode;

      logger.info(`Auto-generated SKU: ${sku} for item "${item_name || description}"`);
    } else {
      // User provided SKU - get category code
      categoryCode = getCategoryCode(category || 'General');
    }

    // Check if item exists by barcode first (if barcode provided)
    if (barcode) {
      const { data: existingByBarcode } = await supabase
        .from('simple_items')
        .select('*')
        .eq('barcode', barcode)
        .single();

      if (existingByBarcode) {
        // Barcode already exists - return error or update
        if (existingByBarcode.is_active) {
          res.status(400).json({
            success: false,
            message: `Barcode already assigned to: ${existingByBarcode.item_name || existingByBarcode.sku}`
          });
          return;
        }
      }
    }

    // Check if SKU exists (even if inactive)
    const { data: existingItem } = await supabase
      .from('simple_items')
      .select('*')
      .eq('sku', sku)
      .single();

    if (existingItem) {
      if (!existingItem.is_active) {
        // Reactivate with new data
        const { data, error } = await supabase
          .from('simple_items')
          .update({
            description: description || existingItem.description,
            retail_price: retail_price ?? cost_price ?? existingItem.retail_price ?? 0,
            quantity: quantity !== undefined ? quantity : existingItem.quantity,
            barcode: barcode || existingItem.barcode,
            item_name: item_name || existingItem.item_name,
            category: category || existingItem.category,
            category_code: categoryCode,
            unit_of_measure: unit_of_measure || existingItem.unit_of_measure,
            cost_price: cost_price || existingItem.cost_price,
            supplier: supplier || existingItem.supplier,
            reorder_level: reorder_level || existingItem.reorder_level,
            image_url: image_url || existingItem.image_url,
            is_active: true,
            is_auto_sku: isAutoSku,
            last_updated: new Date().toISOString()
          })
          .eq('sku', existingItem.sku)
          .select()
          .single();

        if (error) throw error;

        // Log history if quantity changed
        if (quantity !== undefined && quantity !== existingItem.quantity) {
          // Generate order number for this stock-in
          const orderNum = await generateOrderNumber('STKIN');

          const { error } = await supabase.from('stock_history').insert({
            item_sku: existingItem.sku,
            change_type: 'IN',
            quantity_change: quantity - existingItem.quantity,
            previous_quantity: existingItem.quantity,
            new_quantity: quantity,
            reason: 'REACTIVATION',
            reference: orderNum,
            user_id: req.user?.id
          });


          if (error) {


            console.error('Database error:', error);


            throw error;


          }
        }

        res.status(200).json({ success: true, data, reactivated: true });
        return;
      } else {
        res.status(400).json({
          success: false,
          message: 'Item with this SKU already exists.'
        });
        return;
      }
    }

    // Generate order number for initial stock
    let stockInOrderNum = null;
    if (quantity > 0) {
      stockInOrderNum = await generateOrderNumber('STKIN');
    }

    // Create new item
    const { data, error } = await supabase
      .from('simple_items')
      .insert([{
        sku,
        description: description || item_name,
        retail_price: retail_price ?? cost_price ?? 0,
        quantity: quantity || 0,
        barcode,
        item_name: item_name || description,
        category,
        category_code: categoryCode,
        unit_of_measure,
        cost_price,
        supplier,
        reorder_level,
        image_url,
        is_active: true,
        is_auto_sku: isAutoSku,
        last_updated: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    // Log initial stock with order number
    if (quantity > 0) {
      const { error } = await supabase.from('stock_history').insert({
        item_sku: sku,
        change_type: 'IN',
        quantity_change: quantity,
        previous_quantity: 0,
        new_quantity: quantity,
        reason: 'INITIAL_STOCK',
        reference: stockInOrderNum,
        user_id: req.user?.id
      });

      if (error) {

        console.error('Database error:', error);

        throw error;

      }
    }

    logger.info(`Item created: ${sku} (auto-generated: ${isAutoSku})`);

    res.status(201).json({
      success: true,
      data: {
        ...data,
        orderNumber: stockInOrderNum
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update item (Stock In/Out logic handled here or via specific endpoint)
// @route   PUT /api/store/items/:id
// @access  Private (Manager)
export const updateItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // First get current item to compare quantity
    const { data: currentItem } = await supabase
      .from('simple_items')
      .select('*')
      .eq('sku', req.params.id)
      .single();

    if (!currentItem) {
      res.status(404).json({ message: "Item not found" });
      return;
    }

    const { quantity, reason, reference, notes, ...otherFields } = req.body;

    const { data, error } = await supabase
      .from('simple_items')
      .update({
        ...otherFields,
        quantity: quantity !== undefined ? quantity : currentItem.quantity,
        last_updated: new Date().toISOString()
      })
      .eq('sku', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Log history if quantity changed
    if (quantity !== undefined && quantity !== currentItem.quantity) {
      const diff = quantity - currentItem.quantity;
      const type = diff > 0 ? 'IN' : 'OUT';

      const { error } = await supabase.from('stock_history').insert({
        item_sku: req.params.id,
        change_type: type,
        quantity_change: Math.abs(diff),
        previous_quantity: currentItem.quantity,
        new_quantity: quantity,
        reason: reason || (type === 'IN' ? 'PURCHASE' : 'USAGE'),
        reference: reference,
        notes: notes,
        user_id: req.user.id
      });


      if (error) {


        console.error('Database error:', error);


        throw error;


      }
    }

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add stock to existing item (FOUND mode - rapid stock-in)
// @route   POST /api/store/items/:id/add-stock
// @access  Private
export const addStock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sku = req.params.id;
    const { quantity, notes, reference } = req.body;

    if (!quantity || quantity <= 0) {
      res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0'
      });
      return;
    }

    // Get current item
    const { data: currentItem, error: fetchError } = await supabase
      .from('simple_items')
      .select('*')
      .or(`sku.eq.${sku},barcode.eq.${sku}`)
      .single();

    if (fetchError || !currentItem) {
      res.status(404).json({
        success: false,
        message: 'Item not found'
      });
      return;
    }

    const newQuantity = (currentItem.quantity || 0) + parseInt(quantity);

    // Update item quantity
    const { data, error: updateError } = await supabase
      .from('simple_items')
      .update({
        quantity: newQuantity,
        last_updated: new Date().toISOString()
      })
      .eq('sku', currentItem.sku)
      .select()
      .single();

    if (updateError) throw updateError;

    // Generate order number for this stock-in
    const orderNum = await generateOrderNumber('STKIN');

    // Log stock history with order number
    const { error: historyError } = await supabase.from('stock_history').insert({
      item_sku: currentItem.sku,
      change_type: 'IN',
      quantity_change: parseInt(quantity),
      previous_quantity: currentItem.quantity || 0,
      new_quantity: newQuantity,
      reason: 'STOCK_IN',
      reference: orderNum,
      notes: notes || reference || null,
      user_id: req.user?.id || null
    });

    if (historyError) {

      console.error('Database error:', historyError);

      throw historyError;

    }

    logger.info(`Stock added: ${currentItem.sku} +${quantity} (now ${newQuantity}) [${orderNum}]`);

    res.status(200).json({
      success: true,
      message: `Added ${quantity} units. New stock: ${newQuantity}`,
      orderNumber: orderNum,
      data: {
        ...data,
        previousQuantity: currentItem.quantity || 0,
        addedQuantity: parseInt(quantity),
        newQuantity,
        orderNumber: orderNum
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete item
// @route   DELETE /api/store/items/:id
// @access  Private (Manager)
export const deleteItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('simple_items')
      .update({ is_active: false })
      .eq('sku', req.params.id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Preview SKU (without creating)
// @route   POST /api/store/items/preview-sku
// @access  Private
export const previewSKUEndpoint = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { category, item_name } = req.body;

    const preview = previewSKU(category || 'General', item_name || 'Item');
    const categoryCode = getCategoryCode(category || 'General');

    res.status(200).json({
      success: true,
      preview,
      categoryCode,
      format: 'FGH-[CATEGORY]-[PRODUCT]-[SERIAL]',
      example: preview.replace('XXXX', '0001')
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get SKU categories
// @route   GET /api/store/categories
// @access  Private
export const getCategoriesEndpoint = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const categories = await getCategories();

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate SKU for testing
// @route   POST /api/store/items/generate-sku
// @access  Private
export const generateSKUEndpoint = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { category, item_name, barcode } = req.body;

    const result = await generateSKU(
      category || 'General',
      item_name || 'Item',
      barcode
    );

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get stock history for an item
// @route   GET /api/store/items/:id/history
// @access  Private
export const getStockHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sku = req.params.id;

    const { data, error } = await supabase
      .from('stock_history')
      .select('*')
      .eq('item_sku', sku)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: data || []
    });
  } catch (error) {
    next(error);
  }
};
