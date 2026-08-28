import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';
import { randomBytes } from 'crypto';
import {
  generateSKU,
  generateAutoSKU,
  generateOrderNumber,
  previewSKU,
  getCategories,
  getCategoryCode
} from '../../services/sku.service';
import {
  getCanonicalCentralWarehouseLocation,
  getCentralWarehouseRecord,
  isWarehouseUserContext,
} from '../../services/inventory-warehouse.service';

/**
 * Finds or auto-creates the inventory location for the active store context.
 */
export async function ensureInventoryLocation(
  sb: typeof supabase,
  branchId: number | undefined,
  context?: { contextType?: string | null; warehouseId?: string | null }
): Promise<string> {
  const isWarehouseContext = context?.contextType === 'warehouse' || !!context?.warehouseId;

  if (isWarehouseContext) {
    const { id: existingWarehouseLocationId, warehouse } = await getCanonicalCentralWarehouseLocation();
    if (existingWarehouseLocationId) return existingWarehouseLocationId;

    const centralWarehouse = warehouse || await getCentralWarehouseRecord();
    if (!centralWarehouse?.operating_branch_id) {
      throw new Error('Active warehouse context has no operating branch');
    }

    const insertPayload: any = {
      branch_id: centralWarehouse.operating_branch_id,
      warehouse_id: centralWarehouse.id.startsWith('legacy-branch-') ? null : centralWarehouse.id,
      location_code: `WAREHOUSE-${centralWarehouse.code}`,
      name: centralWarehouse.name,
      location_type: 'central_store',
      is_active: true,
      metadata: {
        canonical: true,
        hosted_at_branch_id: centralWarehouse.operating_branch_id
      }
    };

    const { data: created, error } = await sb
      .from('inventory_locations')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) throw error;
    return created.id;
  }

  if (!branchId) throw new Error('branch_id required to resolve inventory location');

  const { data: existing } = await sb
    .from('inventory_locations')
    .select('id')
    .eq('branch_id', branchId)
    .eq('location_type', 'branch_store')
    .eq('is_active', true)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const locationCode = `BRANCH-STORE-${branchId}`;
  const { data: created, error } = await sb
    .from('inventory_locations')
    .insert({
      branch_id: branchId,
      location_code: locationCode,
      name: 'Branch Store',
      location_type: 'branch_store',
      is_active: true
    })
    .select('id')
    .single();
  if (error) throw error;
  return created.id;
}

// @desc    Get all items
// @route   GET /api/store/items
// @access  Private
export const getItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { search, ordering, category, store_type } = req.query;
    const branchId = (req as any).user?.branch_id;

    // Find this branch's inventory location (creates it if missing)
    let locationId: string | null = null;
    const warehouseContext = isWarehouseUserContext(req.user);
    if (branchId) {
      try {
        locationId = await ensureInventoryLocation(supabase, Number(branchId), {
          contextType: warehouseContext ? 'warehouse' : 'branch',
          warehouseId: req.user?.warehouse_id || null
        });
      } catch (err: any) {
        logger.warn(`getItems: could not resolve inventory location for branch ${branchId}: ${err.message}`);
      }
    }

    // Branch-tagged items (e.g. bar drinks auto-synced from a branch's own
    // menu) must stay out of the shared/central catalog — otherwise every
    // branch's local items inflate central store's master inventory count.
    // Central-context requests (no branch_id, or the central warehouse
    // itself) only see branch_id IS NULL rows; branch requests see their
    // own branch's items plus the shared catalog.
    const isCentralContext = warehouseContext;

    let query = supabase
      .from('inventory_items')
      .select('id, sku, item_name, description, category, unit, default_unit_cost, default_selling_price, reorder_level, is_active, store_type, metadata, created_at, updated_at, branch_id')
      .eq('is_active', true);

    query = isCentralContext
      ? query.is('branch_id', null)
      : query.or(`branch_id.is.null,branch_id.eq.${branchId}`);

    if (category) query = query.eq('category', category);
    if (store_type) {
      query = query.eq('store_type', store_type);
    } else {
      // Exclude pure kitchen/restaurant menu items from every store view —
      // these are prepared dishes tracked by the kitchen, not physical store stock.
      query = query
        .not('category', 'eq', 'KITCHEN MENU')
        .not('sku', 'like', 'MENU-%');
    }

    if (search) {
      const s = String(search).trim();
      query = query.or(`description.ilike.%${s}%,item_name.ilike.%${s}%,sku.ilike.%${s}%`);
    }

    if (ordering) {
      const orderStr = String(ordering);
      const isDesc = orderStr.startsWith('-');
      const field = isDesc ? orderStr.substring(1) : orderStr;
      query = query.order(field === 'last_updated' ? 'updated_at' : field, { ascending: !isDesc });
    } else {
      query = query.order('updated_at', { ascending: false });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 200;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.range(from, to);
    const { data: rawItems, error } = await query;
    if (error) throw error;

    // Merge quantities — primary source is inventory_balances (location-scoped),
    // fallback is inventory_items.quantity (the column updated by central
    // stocktake approval and direct item edits) so central storekeeper users
    // (who have no branch_id → no locationId) always see real quantities.
    let data: any[] = rawItems || [];
    if (data.length > 0) {
      const itemIds = data.map((i: any) => i.id);

      // 1. Location-scoped balances (branch storekeepers)
      const balMapBySku = new Map<string, number>();
      const balMapById = new Map<string, number>();
      if (branchId || locationId) {
        let locIds: string[] = locationId ? [locationId] : [];
        if (branchId) {
          const { data: locRows } = await supabase
            .from('inventory_locations')
            .select('id')
            .eq('branch_id', branchId)
            .eq('location_type', 'branch_store');
          if (locRows && locRows.length > 0) {
            locIds = [...new Set([...locIds, ...locRows.map((l: any) => l.id)])];
          }
        }

        if (locIds.length > 0) {
          const { data: balances, error: balErr } = await supabase
            .from('inventory_balances')
            .select('item_id, current_quantity, inventory_items:item_id(sku)')
            .in('location_id', locIds);
          if (balErr) logger.warn(`getItems: balances query error: ${balErr.message}`);
          for (const b of (balances || [])) {
            const qty = Number(b.current_quantity);
            balMapById.set(b.item_id, qty);
            const sku = (b as any).inventory_items?.sku;
            if (sku) balMapBySku.set(sku, qty);
          }
        }
      }

      // 2. Fallback: inventory_items.quantity column (central store / no location)
      const itemQtyMap = new Map<string, number>();
      const { data: qtyRows, error: qtyErr } = await supabase
        .from('inventory_items')
        .select('id, quantity')
        .in('id', itemIds);
      if (qtyErr) logger.warn(`getItems: quantity fallback error: ${qtyErr.message}`);
      for (const r of (qtyRows || [])) {
        if (r.quantity != null) itemQtyMap.set(r.id, Number(r.quantity));
      }

      // 3. Fallback: branch_stock quantities (branch storekeeper context).
      // branch_stock is updated by stocktake approvals, GRN receipts, store transfers
      // and store stocktake approvals — it is the authoritative live stock for
      // branch-level items even when inventory_balances hasn't been seeded.
      const branchStockMap = new Map<string, number>();
      if (branchId) {
        const skus = data.map((i: any) => i.sku).filter(Boolean);
        if (skus.length > 0) {
          const { data: bsRows, error: bsErr } = await supabase
            .from('branch_stock')
            .select('item_sku, quantity')
            .eq('branch_id', branchId)
            .in('item_sku', skus);
          if (bsErr) logger.warn(`getItems: branch_stock fallback error: ${bsErr.message}`);
          for (const r of (bsRows || [])) branchStockMap.set(r.item_sku, Number(r.quantity));
        }
      }

      data = data.map((item: any) => ({
        ...item,
        unit_of_measure: item.unit,
        cost_price: item.default_unit_cost,
        retail_price: item.default_selling_price,
        quantity: balMapBySku.get(item.sku) ?? branchStockMap.get(item.sku) ?? balMapById.get(item.id) ?? itemQtyMap.get(item.id) ?? item.quantity ?? 0,
        last_updated: item.updated_at,
      }));
    }

    const total = data.length;
    const outOfStock = data.filter((item: any) => (item.quantity || 0) === 0).length;
    const lowStock = data.filter((item: any) => {
      const qty = item.quantity || 0;
      const reorder = item.reorder_level || 10;
      return qty > 0 && qty <= reorder;
    }).length;

    res.status(200).json({
      success: true,
      count: data.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      stats: { total, lowStock, outOfStock, inStock: total - outOfStock },
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
      cost_price, supplier, reorder_level, image_url,
      store_type
    } = req.body;

    // =====================================================
    // SMART CATEGORIZATION & UNIT SUGGESTIONS
    // =====================================================
    if (item_name && (!category || !unit_of_measure || !store_type)) {
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

      if (!store_type) {
        const lowerCat = (category || '').toLowerCase();
        const barKeywords = ['wine', 'spirit', 'beer', 'whisky', 'whiskey', 'vodka', 'soda', 'liquor', 'rum', 'cognac', 'gin', 'brandy', 'tequila', 'champagne', 'cider', 'juice', 'water', 'tonic', 'liqueur', 'syrup', 'beverage', 'drink', 'coke', 'fanta', 'sprite', 'krest', 'stoney', 'novida', 'dasani', 'savanna', 'guinness', 'tusker', 'pilsner', 'smirnoff', 'gilbeys', 'jameson', 'hennessy'];
        const isBeverage = lowerCat === 'beverage' || lowerCat === 'bar' || lowerCat === 'drinks' || lowerCat === 'spirits' || lowerCat === 'wines' || lowerCat === 'bar stock-alcoholic';
        const isBarKeyword = barKeywords.some(kw => name.includes(kw));
        store_type = (isBeverage || isBarKeyword) ? 'bar_store' : 'foodstuffs';
      }
    }

    // Default store_type fallback
    if (!store_type) {
      store_type = 'foodstuffs';
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
      // User provided SKU — must match the canonical FGH-CAT-PRODUCT-SERIAL
      // shape generateSKU() produces. The catalog already has 8+ legacy SKU
      // formats from historical bulk imports (left alone deliberately — a
      // retroactive rewrite risks breaking printed barcodes and historical
      // document references), but new items must not add a 9th.
      const sanitizedSku = sku.trim().toUpperCase();
      if (!/^FGH-[A-Z]{2,6}-[A-Z0-9]{1,6}-\d{4}$/.test(sanitizedSku)) {
        res.status(400).json({
          success: false,
          message: `Invalid SKU format "${sku}". Expected FGH-<CATEGORY>-<PRODUCT>-<SERIAL>, e.g. FGH-BEV-COKE-0001. Leave the SKU field blank to auto-generate one.`
        });
        return;
      }
      sku = sanitizedSku;
      categoryCode = getCategoryCode(category || 'General');
    }

    // Check if SKU exists in inventory_items (simple_items is a VIEW on it)
    const { data: existingItem } = await supabase
      .from('inventory_items')
      .select('id, sku, item_name, description, category, unit, default_unit_cost, default_selling_price, reorder_level, quantity, store_type, is_active')
      .eq('sku', sku)
      .maybeSingle();

    if (existingItem) {
      if (!existingItem.is_active) {
        // Reactivate with new data using inventory_items column names
        const { data, error } = await supabase
          .from('inventory_items')
          .update({
            item_name: item_name || existingItem.item_name,
            description: description || existingItem.description,
            default_selling_price: retail_price ?? cost_price ?? existingItem.default_selling_price ?? 0,
            quantity: quantity !== undefined ? quantity : (existingItem.quantity ?? 0),
            category: category || existingItem.category,
            unit: unit_of_measure || existingItem.unit,
            default_unit_cost: cost_price ?? existingItem.default_unit_cost,
            reorder_level: reorder_level ?? existingItem.reorder_level,
            store_type: store_type || existingItem.store_type || 'foodstuffs',
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('sku', existingItem.sku)
          .select()
          .single();

        if (error) throw error;

        // Log history if quantity changed
        if (quantity !== undefined && quantity !== (existingItem.quantity ?? 0)) {
          const orderNum = await generateOrderNumber('STKIN');
          const { error: histErr } = await supabase.from('stock_history').insert({
            item_sku: existingItem.sku,
            change_type: 'IN',
            quantity_change: quantity - (existingItem.quantity ?? 0),
            previous_quantity: existingItem.quantity ?? 0,
            new_quantity: quantity,
            reason: 'REACTIVATION',
            reference: orderNum,
            user_id: req.user?.id
          });
          if (histErr) logger.warn(`createItem reactivate: stock_history insert failed: ${histErr.message}`);
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

    // Create new item — insert into inventory_items (simple_items is a VIEW on it)
    const { data, error } = await supabase
      .from('inventory_items')
      .insert([{
        sku,
        item_name: item_name || description,
        description: description || item_name,
        category,
        unit: unit_of_measure || 'units',
        item_type: 'stockable',
        default_unit_cost: cost_price ?? 0,
        default_selling_price: retail_price ?? cost_price ?? 0,
        reorder_level: reorder_level || 0,
        store_type: store_type || 'foodstuffs',
        is_active: true,
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    // Log initial stock with order number and set quantity on inventory_items
    if (quantity > 0) {
      // Update quantity on inventory_items directly
      await supabase
        .from('inventory_items')
        .update({ quantity })
        .eq('sku', sku);

      const { error: histErr } = await supabase.from('stock_history').insert({
        item_sku: sku,
        change_type: 'IN',
        quantity_change: quantity,
        previous_quantity: 0,
        new_quantity: quantity,
        reason: 'INITIAL_STOCK',
        reference: stockInOrderNum,
        user_id: req.user?.id
      });

      if (histErr) {
        logger.warn(`createItem: stock_history insert failed (non-fatal): ${histErr.message}`);
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
    // Read from inventory_items — simple_items is a VIEW on it
    const { data: currentItem } = await supabase
      .from('inventory_items')
      .select('id, sku, item_name, description, category, unit, default_unit_cost, default_selling_price, reorder_level, quantity, store_type, is_active')
      .eq('sku', req.params.id)
      .maybeSingle();

    if (!currentItem) {
      res.status(404).json({ message: "Item not found" });
      return;
    }

    const { quantity, reason, reference, notes,
            unit_of_measure, cost_price, retail_price, item_name,
            ...otherFields } = req.body;

    // Build update payload with correct inventory_items column names
    const updatePayload: any = {
      ...otherFields,
      updated_at: new Date().toISOString()
    };
    if (item_name !== undefined) updatePayload.item_name = item_name;
    if (unit_of_measure !== undefined) updatePayload.unit = unit_of_measure;
    if (cost_price !== undefined) updatePayload.default_unit_cost = cost_price;
    if (retail_price !== undefined) updatePayload.default_selling_price = retail_price;
    if (quantity !== undefined) updatePayload.quantity = quantity;
    // Remove fields that must not be updated: lookup key and view-only aliases
    delete updatePayload.sku;
    delete updatePayload.last_updated;
    delete updatePayload.is_auto_sku;
    delete updatePayload.category_code;
    delete updatePayload.barcode;
    delete updatePayload.supplier;

    const { data, error } = await supabase
      .from('inventory_items')
      .update(updatePayload)
      .eq('sku', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Log history if quantity changed (non-fatal — stock_history is audit-only)
    if (quantity !== undefined && quantity !== currentItem.quantity) {
      const diff = quantity - currentItem.quantity;
      const type = diff > 0 ? 'IN' : 'OUT';

      const { error: histErr } = await supabase.from('stock_history').insert({
        item_sku: req.params.id,
        change_type: type,
        quantity_change: Math.abs(diff),
        previous_quantity: currentItem.quantity,
        new_quantity: quantity,
        reason: reason || (type === 'IN' ? 'PURCHASE' : 'USAGE'),
        reference: reference,
        notes: notes,
        user_id: req.user?.id
      });

      if (histErr) {
        logger.warn(`updateItem: stock_history insert failed (non-fatal): ${histErr.message}`);
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

    const branchId = (req as any).user?.branch_id;

    // Look up item by SKU
    const { data: currentItem, error: fetchError } = await supabase
      .from('inventory_items')
      .select('id, sku, item_name, reorder_level, is_active')
      .eq('sku', sku)
      .maybeSingle();

    if (fetchError || !currentItem) {
      res.status(404).json({ success: false, message: 'Item not found' });
      return;
    }

    // Find or create the branch's inventory location
    const locationId = await ensureInventoryLocation(supabase, branchId);

    // Get current balance
    const { data: existing } = await supabase
      .from('inventory_balances')
      .select('id, current_quantity')
      .eq('item_id', currentItem.id)
      .eq('location_id', locationId)
      .is('batch_id', null)
      .maybeSingle();

    const prevQty = Number(existing?.current_quantity || 0);
    const newQuantity = prevQty + parseInt(quantity);

    if (existing) {
      const { error: updateError } = await supabase
        .from('inventory_balances')
        .update({ current_quantity: newQuantity })
        .eq('id', existing.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('inventory_balances')
        .insert({ item_id: currentItem.id, location_id: locationId, current_quantity: newQuantity });
      if (insertError) throw insertError;
    }

    const orderNum = await generateOrderNumber('STKIN');
    logger.info(`Stock added: ${currentItem.sku} +${quantity} (now ${newQuantity}) [${orderNum}]`);

    res.status(200).json({
      success: true,
      message: `Added ${quantity} units. New stock: ${newQuantity}`,
      orderNumber: orderNum,
      data: {
        ...currentItem,
        quantity: newQuantity,
        previousQuantity: prevQty,
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
      .from('inventory_items')
      .update({ is_active: false, updated_at: new Date().toISOString() })
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

export const generateBarcodeEndpoint = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const barcode = `ITM-${randomBytes(4).toString('hex').toUpperCase()}`;

      const { data: existing, error } = await supabase
        .from('simple_items')
        .select('sku')
        .eq('barcode', barcode)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!existing) {
        res.status(200).json({
          success: true,
          data: { barcode }
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      message: 'Unable to generate a unique barcode at this time'
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

// @desc    Get central store inventory valuation split by store_type
// @route   GET /api/store/valuation
// @access  Private
export const getCentralValuation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: items, error } = await supabase
      .from('simple_items')
      .select('sku, quantity, cost_price, store_type')
      .eq('is_active', true);

    if (error) throw error;

    const summary = {
      foodstuffs: {
        item_count: 0,
        total_quantity: 0,
        total_value: 0
      },
      bar_store: {
        item_count: 0,
        total_quantity: 0,
        total_value: 0
      },
      stationery: {
        item_count: 0,
        total_quantity: 0,
        total_value: 0
      },
      grand_total: {
        item_count: 0,
        total_quantity: 0,
        total_value: 0
      }
    };

    (items || []).forEach(item => {
      const type = item.store_type === 'bar_store'
        ? 'bar_store'
        : item.store_type === 'stationery'
          ? 'stationery'
          : 'foodstuffs';
      const qty = Number(item.quantity || 0);
      const cost = Number(item.cost_price || 0);
      const val = qty * cost;

      summary[type].item_count += 1;
      summary[type].total_quantity += qty;
      summary[type].total_value += val;

      summary.grand_total.item_count += 1;
      summary.grand_total.total_quantity += qty;
      summary.grand_total.total_value += val;
    });

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};
