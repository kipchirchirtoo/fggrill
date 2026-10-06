const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const KAPLONG_BRANCH_ID = 3;
const KAPLONG_BAR_OUTLET_ID = '7a69ab32-6594-47d6-ad92-b576301ec201';

// The 10 new items confirmed by user
const NEW_ITEMS = [
  {
    name: 'PILSNER MFALME',
    price: 250,
    cost: 169,
    category: 'Beer, Cider & RTD',
    unit: 'bottle',
    sku: 'FGB-BER-MFALME',
    invSku: 'FGB-BER-MFALME'
  },
  {
    name: 'CORONA EXTRA',
    price: 350,
    cost: 240,
    category: 'Beer, Cider & RTD',
    unit: 'bottle',
    sku: 'FGB-BER-CORONA',
    invSku: 'FGB-BER-CORONA'
  },
  {
    name: 'JAMESON BLACK BARREL 750ML',
    price: 5500,
    cost: 3901,
    category: 'Whisky',
    unit: 'bottle',
    sku: 'FGH-WHISKY-035',
    invSku: 'FGH-WHISKY-035'
  },
  {
    name: 'J.WALKER BLONDE 750ML',
    price: 3000,
    cost: 1991,
    category: 'Whisky',
    unit: 'bottle',
    sku: 'FGH-WHISKY-041',
    invSku: 'FGH-WHISKY-041'
  },
  {
    name: 'HENNESSY VSOP',
    price: 13500,
    cost: 9200,
    category: 'Brandy & Cognac',
    unit: 'bottle',
    sku: 'FGH-COGNAC-004',
    invSku: 'FGH-COGNAC-004'
  },
  {
    name: 'BEST CREAM 750ML',
    price: 1500,
    cost: 1089,
    category: 'Liqueurs',
    unit: 'bottle',
    sku: 'FGH-LIQUEURS-006',
    invSku: 'FGH-LIQUEURS-006'
  },
  {
    name: 'V&A 750ML',
    price: 1200,
    cost: 803,
    category: 'Wine',
    unit: 'bottle',
    sku: 'FGH-SPIRITS-027',
    invSku: 'FGH-SPIRITS-027'
  },
  {
    name: 'CAMINO BOTTLE',
    price: 5000,
    cost: 2100,
    category: 'Vodka, Rum & Other Spirits',
    unit: 'bottle',
    sku: 'FGH-SPIRITS-002',
    invSku: 'FGH-SPIRITS-002'
  },
  {
    name: 'TRUST STUDDED',
    price: 100,
    cost: 50,
    category: 'Other',
    unit: 'packet',
    sku: 'FGB-OTH-TRUST-STUDDED',
    invSku: 'FGB-OTH-TRUST-STUDDED'
  },
  {
    name: 'J&B 750ML',
    price: 2400,
    cost: 1600,
    category: 'Whisky',
    unit: 'bottle',
    sku: 'FGH-WHISKY-025',
    invSku: 'FGH-WHISKY-025'
  }
];

// Duplicate/junk merges to consolidate stock onto canonical items
const STOCK_MERGES = [
  { sourceName: 'QUARANA', targetName: 'GUARANA' },
  { sourceName: 'SODA TAKEAWAY', targetName: 'SODA 500ML TAKE AWAY' },
  { sourceName: 'DASANI 1L', targetName: 'DASANI 1 LTR' },
  { sourceName: 'JARGERMASTER 750 ML', targetName: 'JAGERMASTER' },
  { sourceName: 'BAILEYS', targetName: 'BAILEYS 750ML' }
];

// Items to deactivate completely from Kaplong Bar
const ITEMS_TO_DEACTIVATE = [
  'QUARANA',
  'SODA TAKEAWAY',
  'DASANI 1L',
  'DASANI 500ML.',
  'JARGERMASTER 750 ML',
  'BAILEYS',
  'TAQUREY LONDON DRY 1LTR',
  'FRESH COCKTAIL/MANGO',
  'LEMON (B)',
  'WHISKY GLASS',
  'WINE GLASS'
];

async function syncKaplong() {
  console.log('=== SYNCING KAPLONG BAR STOCK & STOCKTAKE CATALOG ===');

  // 1. Process Stock Merges
  console.log('\n--- 1. MERGING STOCK FROM DUPLICATES ONTO CANONICAL ITEMS ---');
  for (const merge of STOCK_MERGES) {
    // 1a. Bar Stock
    const { data: srcBarStock } = await supabase.from('bar_stock')
      .select('*')
      .eq('branch_id', KAPLONG_BRANCH_ID)
      .eq('item_name', merge.sourceName)
      .maybeSingle();

    const { data: tgtBarStock } = await supabase.from('bar_stock')
      .select('*')
      .eq('branch_id', KAPLONG_BRANCH_ID)
      .eq('item_name', merge.targetName)
      .maybeSingle();

    if (srcBarStock && tgtBarStock && Number(srcBarStock.current_stock || 0) > 0) {
      const newStock = Number(tgtBarStock.current_stock || 0) + Number(srcBarStock.current_stock || 0);
      console.log(`Merging bar_stock ${merge.sourceName} (${srcBarStock.current_stock}) into ${merge.targetName} (${tgtBarStock.current_stock}) => ${newStock}`);
      await supabase.from('bar_stock').update({ current_stock: newStock }).eq('id', tgtBarStock.id);
      await supabase.from('bar_stock').update({ current_stock: 0 }).eq('id', srcBarStock.id);
    }

    // 1b. POS Outlet Items
    const { data: srcPos } = await supabase.from('pos_outlet_items')
      .select('*')
      .eq('outlet_id', KAPLONG_BAR_OUTLET_ID)
      .eq('name', merge.sourceName)
      .maybeSingle();

    const { data: tgtPos } = await supabase.from('pos_outlet_items')
      .select('*')
      .eq('outlet_id', KAPLONG_BAR_OUTLET_ID)
      .eq('name', merge.targetName)
      .maybeSingle();

    if (srcPos && tgtPos && Number(srcPos.current_stock || 0) > 0) {
      const newPosStock = Number(tgtPos.current_stock || 0) + Number(srcPos.current_stock || 0);
      console.log(`Merging pos_outlet_items ${merge.sourceName} (${srcPos.current_stock}) into ${merge.targetName} (${tgtPos.current_stock}) => ${newPosStock}`);
      await supabase.from('pos_outlet_items').update({ current_stock: newPosStock }).eq('id', tgtPos.id);
      await supabase.from('pos_outlet_items').update({ current_stock: 0 }).eq('id', srcPos.id);
    }
  }

  // 2. Ensure Inventory Items exist for New Items
  console.log('\n--- 2. ENSURING INVENTORY_ITEMS & RESOLVING UUIDs ---');
  for (const item of NEW_ITEMS) {
    let { data: invItem } = await supabase.from('inventory_items')
      .select('id, sku, item_name')
      .eq('sku', item.invSku)
      .maybeSingle();

    if (!invItem) {
      console.log(`Creating inventory_items for ${item.name} (${item.invSku})...`);
      const { data: created, error } = await supabase.from('inventory_items').insert({
        sku: item.invSku,
        item_name: item.name,
        category: item.category,
        unit: item.unit,
        item_type: 'stockable',
        tracking_mode: 'standard',
        default_unit_cost: item.cost,
        default_selling_price: item.price,
        cost_price: item.cost,
        retail_price: item.price,
        is_active: true,
        is_for_sale: true,
        store_type: 'bar_store'
      }).select().single();
      if (error) console.error(`Error creating inv item for ${item.name}:`, error);
      invItem = created;
    }
    item.invId = invItem?.id;
  }

  // 3. Ensure bar_drinks exist
  console.log('\n--- 3. ENSURING BAR_DRINKS FOR NEW ITEMS ---');
  for (const item of NEW_ITEMS) {
    let { data: bDrink } = await supabase.from('bar_drinks')
      .select('id, name, sku')
      .eq('branch_id', KAPLONG_BRANCH_ID)
      .eq('name', item.name)
      .maybeSingle();

    if (!bDrink) {
      console.log(`Inserting bar_drinks: ${item.name}...`);
      const { data: created, error } = await supabase.from('bar_drinks').insert({
        branch_id: KAPLONG_BRANCH_ID,
        outlet_id: KAPLONG_BAR_OUTLET_ID,
        name: item.name,
        sku: item.sku,
        category: item.category,
        unit: item.unit,
        selling_price: item.price,
        price: item.price,
        cost_price: item.cost,
        stock_quantity: 0,
        is_available: true,
        is_active: true,
        inventory_item_id: item.invId
      }).select().single();
      if (error) console.error(`Error creating bar_drinks for ${item.name}:`, error);
      bDrink = created;
    } else {
      await supabase.from('bar_drinks').update({
        selling_price: item.price,
        price: item.price,
        is_active: true,
        is_available: true,
        inventory_item_id: item.invId || bDrink.inventory_item_id
      }).eq('id', bDrink.id);
    }
    item.drinkId = bDrink?.id;
  }

  // 4. Ensure pos_outlet_items exist
  console.log('\n--- 4. ENSURING POS_OUTLET_ITEMS FOR NEW ITEMS ---');
  for (const item of NEW_ITEMS) {
    let { data: pItem } = await supabase.from('pos_outlet_items')
      .select('id, name')
      .eq('outlet_id', KAPLONG_BAR_OUTLET_ID)
      .eq('name', item.name)
      .maybeSingle();

    if (!pItem) {
      console.log(`Inserting pos_outlet_items: ${item.name}...`);
      const { error } = await supabase.from('pos_outlet_items').insert({
        outlet_id: KAPLONG_BAR_OUTLET_ID,
        branch_id: KAPLONG_BRANCH_ID,
        name: item.name,
        sku: item.sku,
        category: item.category,
        unit: item.unit,
        selling_price: item.price,
        cost_price: item.cost,
        opening_stock: 0,
        current_stock: 0,
        reserved_stock: 0,
        low_stock_level: 5,
        track_stock: true,
        is_active: true,
        is_available: true,
        status: 'active',
        source_table: 'bar_drinks',
        source_item_id: item.drinkId
      });
      if (error) console.error(`Error inserting pos item ${item.name}:`, error);
    } else {
      await supabase.from('pos_outlet_items').update({
        selling_price: item.price,
        cost_price: item.cost,
        source_table: 'bar_drinks',
        source_item_id: item.drinkId,
        track_stock: true,
        is_active: true,
        is_available: true
      }).eq('id', pItem.id);
    }
  }

  // 5. Ensure bar_stock exists
  console.log('\n--- 5. ENSURING BAR_STOCK FOR NEW ITEMS ---');
  for (const item of NEW_ITEMS) {
    let { data: bStock } = await supabase.from('bar_stock')
      .select('id, item_name')
      .eq('branch_id', KAPLONG_BRANCH_ID)
      .eq('item_name', item.name)
      .maybeSingle();

    if (!bStock) {
      console.log(`Inserting bar_stock: ${item.name}...`);
      const { error } = await supabase.from('bar_stock').insert({
        branch_id: KAPLONG_BRANCH_ID,
        outlet_id: KAPLONG_BAR_OUTLET_ID,
        drink_id: item.drinkId,
        item_sku: item.sku,
        item_name: item.name,
        current_stock: 0,
        par_level: 5,
        unit: item.unit,
        low_stock: false
      });
      if (error) console.error(`Error inserting bar_stock ${item.name}:`, error);
    } else {
      await supabase.from('bar_stock').update({
        drink_id: item.drinkId,
        item_sku: item.sku,
        unit: item.unit
      }).eq('id', bStock.id);
    }
  }

  // 6. Ensure branch_stock exists
  console.log('\n--- 6. ENSURING BRANCH_STOCK FOR NEW ITEMS ---');
  for (const item of NEW_ITEMS) {
    let { data: brStock } = await supabase.from('branch_stock')
      .select('id, item_sku')
      .eq('branch_id', KAPLONG_BRANCH_ID)
      .eq('item_sku', item.sku)
      .maybeSingle();

    if (!brStock) {
      console.log(`Inserting branch_stock: ${item.name} (${item.sku})...`);
      const { error } = await supabase.from('branch_stock').insert({
        branch_id: KAPLONG_BRANCH_ID,
        item_sku: item.sku,
        item_name: item.name,
        current_stock: 0,
        quantity: 0,
        reorder_level: 10,
        minimum_stock: 5,
        max_stock_level: 100,
        unit_cost: item.cost
      });
      if (error) console.error(`Error inserting branch_stock ${item.name}:`, error);
    }
  }

  // 7. Deactivate Duplicates & Junk in Kaplong Bar
  console.log('\n--- 7. DEACTIVATING DUPLICATE & OBSOLETE ITEMS ---');
  for (const name of ITEMS_TO_DEACTIVATE) {
    console.log(`Deactivating ${name}...`);
    await supabase.from('pos_outlet_items')
      .update({ is_active: false, is_available: false })
      .eq('outlet_id', KAPLONG_BAR_OUTLET_ID)
      .eq('name', name);

    await supabase.from('bar_drinks')
      .update({ is_active: false, is_available: false })
      .eq('branch_id', KAPLONG_BRANCH_ID)
      .eq('name', name);
  }

  // Deactivate the duplicate POOL TOKEN in pos_outlet_items
  await supabase.from('pos_outlet_items')
    .update({ is_active: false, is_available: false })
    .eq('id', '2df4c9be-f7d6-4927-a76b-2dcfa8d6dafa');
  console.log('Deactivated duplicate POOL TOKEN.');

  // 8. VERIFICATION
  console.log('\n=== FINAL VERIFICATION ===');
  const { data: finalPos } = await supabase.from('pos_outlet_items')
    .select('id, name, sku, selling_price, source_item_id, current_stock, category')
    .eq('outlet_id', KAPLONG_BAR_OUTLET_ID)
    .eq('source_table', 'bar_drinks')
    .eq('is_active', true)
    .order('name');

  const { data: finalDrinks } = await supabase.from('bar_drinks')
    .select('id, name, sku, selling_price, is_active')
    .eq('branch_id', KAPLONG_BRANCH_ID)
    .eq('is_active', true)
    .order('name');

  const { data: finalBarStock } = await supabase.from('bar_stock')
    .select('id, item_name, item_sku, current_stock')
    .eq('branch_id', KAPLONG_BRANCH_ID)
    .order('item_name');

  console.log(`Active Kaplong Main Bar POS items: ${finalPos?.length}`);
  console.log(`Active Kaplong bar_drinks items: ${finalDrinks?.length}`);
  console.log(`Total Kaplong bar_stock records: ${finalBarStock?.length}`);
  
  const inStockCount = finalPos.filter(p => Number(p.current_stock || 0) > 0).length;
  console.log(`Items with current physical stock intact: ${inStockCount}`);
}

syncKaplong().then(() => {
  console.log('\nSync completed successfully!');
  process.exit(0);
}).catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
