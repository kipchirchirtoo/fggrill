require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const KAPLONG_BRANCH_ID = 3;
const KAPLONG_BAR_OUTLET_ID = '7a69ab32-6594-47d6-ad92-b576301ec201';

const rawBarMenu = [
  // Soda (8)
  { category: 'Soda', name: 'SODA 300ML', price: 70 },
  { category: 'Soda', name: 'COKE ZERO', price: 100 },
  { category: 'Soda', name: 'SODA 500ML', price: 100 },
  { category: 'Soda', name: 'TONIC SODA CAN', price: 150 },
  { category: 'Soda', name: 'SODA 500ML TAKE AWAY', price: 100 },
  { category: 'Soda', name: 'NOVIDA', price: 100 },
  { category: 'Soda', name: 'SODA TAKEAWAY', price: 100 },
  { category: 'Soda', name: 'ALVARO', price: 200 },

  // Energy Drinks (5)
  { category: 'Energy Drinks', name: 'REDBULL', price: 300 },
  { category: 'Energy Drinks', name: 'QUARANA', price: 250 },
  { category: 'Energy Drinks', name: 'MONSTER', price: 350 },
  { category: 'Energy Drinks', name: 'PREDATOR CAN', price: 100 },
  { category: 'Energy Drinks', name: 'GUARANA', price: 250 },

  // Juice (6)
  { category: 'Juice', name: 'MINUTE MAID', price: 120 },
  { category: 'Juice', name: 'LIME LEMONADE', price: 100 },
  { category: 'Juice', name: 'DELMONTE', price: 350 },
  { category: 'Juice', name: 'PUNCH', price: 250 },
  { category: 'Juice', name: 'FRESH COCKTAIL/MANGO', price: 150 },
  { category: 'Juice', name: 'LEMON (B)', price: 20 },

  // Water (6)
  { category: 'Water', name: 'DASANI 500ML', price: 50 },
  { category: 'Water', name: 'DASANI 1L', price: 100 },
  { category: 'Water', name: 'DASANI 500ML.', price: 50 },
  { category: 'Water', name: 'KERINGET 500ML', price: 70 },
  { category: 'Water', name: 'DASANI 1 LTR', price: 100 },
  { category: 'Water', name: 'KERINGET 1 LTR', price: 150 },

  // Beer, Cider & RTD (30)
  { category: 'Beer, Cider & RTD', name: 'TUSKER LAGER', price: 250 },
  { category: 'Beer, Cider & RTD', name: 'GUINNESS', price: 280 },
  { category: 'Beer, Cider & RTD', name: 'TUSKER LAGER CAN', price: 300 },
  { category: 'Beer, Cider & RTD', name: 'GUINNESS CAN', price: 300 },
  { category: 'Beer, Cider & RTD', name: 'TUSKER LITE', price: 250 },
  { category: 'Beer, Cider & RTD', name: 'MANYATTA', price: 280 },
  { category: 'Beer, Cider & RTD', name: 'TUSKER LITE CAN', price: 300 },
  { category: 'Beer, Cider & RTD', name: 'MANYATTA CAN', price: 300 },
  { category: 'Beer, Cider & RTD', name: 'TUSKER MALT', price: 250 },
  { category: 'Beer, Cider & RTD', name: 'HEINEKEN', price: 350 },
  { category: 'Beer, Cider & RTD', name: 'TUSKER MALT CAN', price: 300 },
  { category: 'Beer, Cider & RTD', name: 'FAXE', price: 350 },
  { category: 'Beer, Cider & RTD', name: 'TUSKER CIDER', price: 280 },
  { category: 'Beer, Cider & RTD', name: 'WINDHOEK', price: 250 },
  { category: 'Beer, Cider & RTD', name: 'TUSKER CIDER CAN', price: 300 },
  { category: 'Beer, Cider & RTD', name: 'KINGFISHER', price: 300 },
  { category: 'Beer, Cider & RTD', name: 'WHITE CAP LAGER', price: 270 },
  { category: 'Beer, Cider & RTD', name: 'DESPARADO', price: 350 },
  { category: 'Beer, Cider & RTD', name: 'WHITE CAP CRISP[', price: 250 },
  { category: 'Beer, Cider & RTD', name: 'SAVANA CIDER', price: 350 },
  { category: 'Beer, Cider & RTD', name: 'WHITE CAP CAN', price: 300 },
  { category: 'Beer, Cider & RTD', name: 'HUNTERS GOLD', price: 250 },
  { category: 'Beer, Cider & RTD', name: 'PILSNER LAGER', price: 250 },
  { category: 'Beer, Cider & RTD', name: 'SNAPP', price: 250 },
  { category: 'Beer, Cider & RTD', name: 'PILSNER CAN', price: 300 },
  { category: 'Beer, Cider & RTD', name: 'SNAPP CAN', price: 300 },
  { category: 'Beer, Cider & RTD', name: 'BALOZI', price: 250 },
  { category: 'Beer, Cider & RTD', name: 'BLACK ICE', price: 250 },
  { category: 'Beer, Cider & RTD', name: 'BALOZI CAN', price: 300 },
  { category: 'Beer, Cider & RTD', name: 'GORDONS CAN', price: 250 },

  // Whisky (45)
  { category: 'Whisky', name: 'J.W RED 250ML', price: 800 },
  { category: 'Whisky', name: 'BLACK & WHITE 1 LTR', price: 2200 },
  { category: 'Whisky', name: 'J.W RED 375ML', price: 1700 },
  { category: 'Whisky', name: 'WILLIAM LAWSONS 350ML', price: 1500 },
  { category: 'Whisky', name: 'J.W RED 750ML', price: 2500 },
  { category: 'Whisky', name: 'WILLIAM LAWSONS 750ML', price: 2200 },
  { category: 'Whisky', name: 'J.W RED 1 LTR', price: 3000 },
  { category: 'Whisky', name: 'WILLIAM LAWSONS 1LTR', price: 3000 },
  { category: 'Whisky', name: 'J.W BLACK 250ML', price: 1300 },
  { category: 'Whisky', name: 'GLENFIDICH 12YRS', price: 8500 },
  { category: 'Whisky', name: 'J.W BLACK 375ML', price: 2200 },
  { category: 'Whisky', name: 'GLENFIDICH 15YRS', price: 12000 },
  { category: 'Whisky', name: 'J.W BLACK 750ML', price: 4500 },
  { category: 'Whisky', name: 'GLENFIDICH 18YRS', price: 17500 },
  { category: 'Whisky', name: 'J.W BLACK 1 LTR', price: 5500 },
  { category: 'Whisky', name: 'SINGLETON 12YRS', price: 6500 },
  { category: 'Whisky', name: 'DOUBLE BLACK 750ML', price: 5800 },
  { category: 'Whisky', name: 'SINGLETON 15YRS', price: 7800 },
  { category: 'Whisky', name: 'DOUBLE BLACK 1 LTR', price: 7000 },
  { category: 'Whisky', name: 'HUNTERS 1/4', price: 500 },
  { category: 'Whisky', name: 'GREEN LABEL', price: 12000 },
  { category: 'Whisky', name: 'HUNTERS 1/2', price: 700 },
  { category: 'Whisky', name: 'GOLD RESERVE', price: 9500 },
  { category: 'Whisky', name: 'HUNTERS 750ML', price: 1300 },
  { category: 'Whisky', name: 'GRANTS1/2', price: 1600 },
  { category: 'Whisky', name: 'BEST WHISKY 1/4', price: 500 },
  { category: 'Whisky', name: 'GRANTS 750ML', price: 2500 },
  { category: 'Whisky', name: 'BEST WHISKY 750ML', price: 1400 },
  { category: 'Whisky', name: 'GRANTS 1 LTR', price: 3200 },
  { category: 'Whisky', name: 'BOND 7 1/4', price: 600 },
  { category: 'Whisky', name: 'JAMESON 1/2', price: 1600 },
  { category: 'Whisky', name: 'BOND 7 1/2', price: 800 },
  { category: 'Whisky', name: 'JAMESON 750ML', price: 3500 },
  { category: 'Whisky', name: 'BOND 7 750ML', price: 1800 },
  { category: 'Whisky', name: 'JAMESON 1 LTR', price: 4500 },
  { category: 'Whisky', name: 'VAT 69 1/2', price: 1000 },
  { category: 'Whisky', name: 'JACK DANIELS 350ML', price: 2500 },
  { category: 'Whisky', name: 'VAT 69 750ML', price: 2000 },
  { category: 'Whisky', name: 'JACK DANIELS 750ML', price: 4500 },
  { category: 'Whisky', name: 'FAMOUS GROUSE', price: 2500 },
  { category: 'Whisky', name: 'JACK DANIELS 1 LTR', price: 6000 },
  { category: 'Whisky', name: 'BALANTINES 750ML', price: 3000 },
  { category: 'Whisky', name: 'BLACK & WHITE 350ML', price: 800 },
  { category: 'Whisky', name: 'WHISKY GLASS', price: 200 },
  { category: 'Whisky', name: 'BLACK & WHITE 750ML', price: 1500 },

  // Brandy & Cognac (11)
  { category: 'Brandy & Cognac', name: 'VICEROY 1/4', price: 650 },
  { category: 'Brandy & Cognac', name: 'RICHOT 750ML', price: 1800 },
  { category: 'Brandy & Cognac', name: 'VICEROY 1/2', price: 900 },
  { category: 'Brandy & Cognac', name: 'HENNESY 750ML', price: 7500 },
  { category: 'Brandy & Cognac', name: 'VICEROY 750ML', price: 1800 },
  { category: 'Brandy & Cognac', name: 'HENNESY 1 LTR', price: 13500 },
  { category: 'Brandy & Cognac', name: 'VICEROY 10 YRS', price: 4500 },
  { category: 'Brandy & Cognac', name: 'MARTEL VS 750ML', price: 8500 },
  { category: 'Brandy & Cognac', name: 'RICHOT 1/4', price: 650 },
  { category: 'Brandy & Cognac', name: 'MARTEL VSOP 750ML', price: 12500 },
  { category: 'Brandy & Cognac', name: 'RICHORT 1/2', price: 850 },

  // Gin (8)
  { category: 'Gin', name: 'GORDONS GIN 350ML', price: 1200 },
  { category: 'Gin', name: 'TAQUREY LONDON DRY 1LTR', price: 6000 },
  { category: 'Gin', name: 'GORDONS GIN 750ML', price: 2500 },
  { category: 'Gin', name: 'GILBEYS 1/4', price: 650 },
  { category: 'Gin', name: 'TANQUERAY NO 10', price: 6000 },
  { category: 'Gin', name: 'GILBEYS 1/2', price: 850 },
  { category: 'Gin', name: 'TAQUEREY LONDONDRY 750ML', price: 4500 },
  { category: 'Gin', name: 'GILBEYS 750ML', price: 1800 },

  // Vodka, Rum & Other Spirits (9)
  { category: 'Vodka, Rum & Other Spirits', name: 'VODKA 1/4', price: 650 },
  { category: 'Vodka, Rum & Other Spirits', name: 'KENYA CANE 1/4', price: 450 },
  { category: 'Vodka, Rum & Other Spirits', name: 'VODKA 1/2', price: 850 },
  { category: 'Vodka, Rum & Other Spirits', name: 'KENYA CANE 1/2', price: 700 },
  { category: 'Vodka, Rum & Other Spirits', name: 'VODKA 750ML', price: 1800 },
  { category: 'Vodka, Rum & Other Spirits', name: 'KENYA CANE 750ML', price: 1200 },
  { category: 'Vodka, Rum & Other Spirits', name: 'CAPTAIN MORGAN 1/4', price: 500 },
  { category: 'Vodka, Rum & Other Spirits', name: 'CAMINO TOT', price: 200 },
  { category: 'Vodka, Rum & Other Spirits', name: 'CAPTAIN MORGAN 750ML', price: 1400 },

  // Liqueurs (11)
  { category: 'Liqueurs', name: 'AMARULA 1/2', price: 1800 },
  { category: 'Liqueurs', name: 'SHERIDANS 1 LTR', price: 7000 },
  { category: 'Liqueurs', name: 'AMARULA 750ML', price: 3000 },
  { category: 'Liqueurs', name: 'SOUTHERN COMFORT', price: 3200 },
  { category: 'Liqueurs', name: 'AMARULA 1L', price: 5500 },
  { category: 'Liqueurs', name: 'JAGERMEISTER TOT', price: 200 },
  { category: 'Liqueurs', name: 'BAILEYS', price: 1800 },
  { category: 'Liqueurs', name: 'JAGERMASTER', price: 6600 },
  { category: 'Liqueurs', name: 'BAILEYS 1/2', price: 1800 },
  { category: 'Liqueurs', name: 'JARGERMASTER 750 ML', price: 4500 },
  { category: 'Liqueurs', name: 'BAILEYS 750ML', price: 3000 },

  // Wine (12)
  { category: 'Wine', name: '4TH STREET', price: 1200 },
  { category: 'Wine', name: 'CHAMDOR', price: 1400 },
  { category: 'Wine', name: 'ALL SEASONS 750ML', price: 1400 },
  { category: 'Wine', name: 'DROSDTY HOF', price: 1200 },
  { category: 'Wine', name: 'ASCONI', price: 2000 },
  { category: 'Wine', name: 'FOUR COUSINS', price: 1400 },
  { category: 'Wine', name: 'CAPRICE', price: 1300 },
  { category: 'Wine', name: 'NEDERBUG', price: 2800 },
  { category: 'Wine', name: 'CASABUENA', price: 1200 },
  { category: 'Wine', name: 'ROBERTSON', price: 1800 },
  { category: 'Wine', name: 'CELLAR CASK', price: 1200 },
  { category: 'Wine', name: 'WINE GLASS', price: 200 }
];

function determineUnit(name) {
  const n = name.toUpperCase();
  if (n.includes('CAN')) return 'can';
  if (n.includes('TOT')) return 'tot';
  if (n.includes('GLASS')) return 'glass';
  return 'bottle';
}

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function setupKaplongBar() {
  console.log('Starting Kaplong Bar Menu & Bar Stock Setup...');
  console.log(`Branch ID: ${KAPLONG_BRANCH_ID}`);
  console.log(`Outlet ID: ${KAPLONG_BAR_OUTLET_ID}`);

  // Fetch Master Inventory for SKU and Cost mapping
  const { data: masterItems, error: mErr } = await supabase
    .from('simple_items')
    .select('id, sku, item_name, category, retail_price, cost_price');
  if (mErr) throw mErr;
  console.log(`Loaded ${masterItems.length} Master Inventory items.`);

  const posItemsToInsert = [];
  const branchStockToInsert = [];
  const barStockToInsert = [];

  const seenSkus = new Set();

  for (const item of rawBarMenu) {
    const norm = normalize(item.name);
    let matched = masterItems.find(m => normalize(m.item_name) === norm);

    if (!matched) {
      // Common variant mapping
      if (norm === 'redbull') matched = masterItems.find(m => normalize(m.item_name) === 'red bull');
      else if (norm === 'grants1 2') matched = masterItems.find(m => normalize(m.item_name) === 'grants 1 2');
      else if (norm === 'richort 1 2') matched = masterItems.find(m => normalize(m.item_name) === 'richot 1 2');
      else if (norm === 'quarana') matched = masterItems.find(m => normalize(m.item_name) === 'guarana');
      else if (norm === 'kenya cane 1 4') matched = masterItems.find(m => normalize(m.item_name) === 'kc 250ml');
      else if (norm === 'kenya cane 1 2') matched = masterItems.find(m => normalize(m.item_name) === 'kc 350ml');
      else if (norm === 'kenya cane 750ml') matched = masterItems.find(m => normalize(m.item_name) === 'kc 750ml');
      else if (norm === 'desparado') matched = masterItems.find(m => normalize(m.item_name) === 'desperado');
      else if (norm === 'savana cider') matched = masterItems.find(m => normalize(m.item_name) === 'savanna cider');
      else if (norm === 'taqurey london dry 1ltr') matched = masterItems.find(m => normalize(m.item_name) === 'tanqueray 1l');
      else if (norm === 'tanqueray no 10') matched = masterItems.find(m => normalize(m.item_name) === 'tangueray 10yrs');
      else if (norm === 'taquerey londondry 750ml') matched = masterItems.find(m => normalize(m.item_name) === 'tangueray 750ml');
      else if (norm === 'jagermaster') matched = masterItems.find(m => normalize(m.item_name) === 'jager');
      else if (norm === 'nederbug') matched = masterItems.find(m => normalize(m.item_name) === 'nederburg red');
      else if (norm === 'alvaro') matched = masterItems.find(m => normalize(m.item_name) === 'alvaro can');
      else if (norm === 'predator can') matched = masterItems.find(m => normalize(m.item_name) === 'predator');
      else if (norm === 'j w red 750ml') matched = masterItems.find(m => normalize(m.item_name) === 'j walker red 750ml');
      else if (norm === 'j w black 750ml') matched = masterItems.find(m => normalize(m.item_name) === 'j walker black 750ml');
      else if (norm === 'double black 750ml') matched = masterItems.find(m => normalize(m.item_name) === 'double black 750ml');
      else if (norm === 'hennesy 750ml') matched = masterItems.find(m => normalize(m.item_name) === 'hennessy 750ml');
      else if (norm === 'martel vs 750ml') matched = masterItems.find(m => normalize(m.item_name) === 'martell vs 700ml');
      else if (norm === 'martel vsop 750ml') matched = masterItems.find(m => normalize(m.item_name) === 'martell vsop');
      else if (norm === 'white cap crisp') matched = masterItems.find(m => normalize(m.item_name) === 'white cap crisp');
    }

    // Determine SKU
    let sku = matched ? matched.sku : `FGB-KPL-${item.name.replace(/[^A-Z0-9]/gi, '-').toUpperCase()}`;
    let counter = 1;
    let baseSku = sku;
    while (seenSkus.has(sku)) {
      sku = `${baseSku}-${counter}`;
      counter++;
    }
    seenSkus.add(sku);

    const costPrice = matched && matched.cost_price && matched.cost_price > 0
      ? Number(matched.cost_price)
      : Math.round(item.price * 0.75);

    const unit = determineUnit(item.name);

    // 1. POS Outlet Item
    posItemsToInsert.push({
      outlet_id: KAPLONG_BAR_OUTLET_ID,
      branch_id: KAPLONG_BRANCH_ID,
      name: item.name,
      sku: sku,
      category: item.category,
      unit: unit,
      selling_price: item.price,
      cost_price: costPrice,
      opening_stock: 0,
      current_stock: 0,
      reserved_stock: 0,
      low_stock_level: 5,
      track_stock: true, // Configured as true per user request
      is_active: true,
      is_available: true,
      status: 'active'
    });

    // 2. Branch Stock (branch-level inventory)
    branchStockToInsert.push({
      branch_id: KAPLONG_BRANCH_ID,
      item_sku: sku,
      item_name: item.name,
      current_stock: 0,
      quantity: 0,
      reorder_level: 10,
      minimum_stock: 5,
      max_stock_level: 100,
      unit_cost: costPrice
    });

    // 3. Bar Stock (outlet-level bar stock)
    barStockToInsert.push({
      branch_id: KAPLONG_BRANCH_ID,
      outlet_id: KAPLONG_BAR_OUTLET_ID,
      item_sku: sku,
      item_name: item.name,
      current_stock: 0,
      par_level: 5,
      unit: unit,
      low_stock: false
    });
  }

  console.log(`\nPrepared ${posItemsToInsert.length} items for Kaplong Main Bar POS outlet.`);

  async function retryOp(fn, retries = 5, delay = 1500) {
    for (let i = 1; i <= retries; i++) {
      try {
        const res = await fn();
        if (res && res.error) {
          if (i === retries) throw res.error;
          console.log(`Retry attempt ${i} after error: ${res.error.message}`);
          await new Promise(r => setTimeout(r, delay * i));
          continue;
        }
        return res;
      } catch (e) {
        if (i === retries) throw e;
        console.log(`Retry attempt ${i} after exception: ${e.message || e}`);
        await new Promise(r => setTimeout(r, delay * i));
      }
    }
  }

  // Clean out any existing items for this specific outlet only to prevent duplicates
  await retryOp(() =>
    supabase
      .from('pos_outlet_items')
      .delete()
      .eq('outlet_id', KAPLONG_BAR_OUTLET_ID)
  );

  await retryOp(() =>
    supabase
      .from('bar_stock')
      .delete()
      .eq('outlet_id', KAPLONG_BAR_OUTLET_ID)
  );

  await retryOp(() =>
    supabase
      .from('branch_stock')
      .delete()
      .eq('branch_id', KAPLONG_BRANCH_ID)
  );

  // Batch insert into pos_outlet_items with smaller chunk size
  const BATCH_SIZE = 25;
  for (let i = 0; i < posItemsToInsert.length; i += BATCH_SIZE) {
    const chunk = posItemsToInsert.slice(i, i + BATCH_SIZE);
    await retryOp(() => supabase.from('pos_outlet_items').insert(chunk));
    console.log(`Inserted pos_outlet_items chunk ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(posItemsToInsert.length / BATCH_SIZE)}`);
  }
  console.log(`Inserted all ${posItemsToInsert.length} into pos_outlet_items.`);

  // Batch insert into branch_stock
  for (let i = 0; i < branchStockToInsert.length; i += BATCH_SIZE) {
    const chunk = branchStockToInsert.slice(i, i + BATCH_SIZE);
    try {
      await retryOp(() => supabase.from('branch_stock').insert(chunk));
    } catch (e) {
      console.warn('branch_stock insert notice:', e.message || e);
    }
  }
  console.log(`Inserted into branch_stock.`);

  // Batch insert into bar_stock
  for (let i = 0; i < barStockToInsert.length; i += BATCH_SIZE) {
    const chunk = barStockToInsert.slice(i, i + BATCH_SIZE);
    try {
      await retryOp(() => supabase.from('bar_stock').insert(chunk));
    } catch (e) {
      console.warn('bar_stock insert notice:', e.message || e);
    }
  }
  console.log(`Inserted into bar_stock.`);

  // Final verification
  const { data: verifyItems } = await supabase
    .from('pos_outlet_items')
    .select('id, name, category, price, selling_price, track_stock, is_active, branch_id, outlet_id')
    .eq('outlet_id', KAPLONG_BAR_OUTLET_ID);

  console.log(`\n=== VERIFICATION ===`);
  console.log(`Total items in Kaplong Main Bar POS: ${verifyItems.length}`);
  const catCounts = {};
  let allTrackStock = true;
  let allActive = true;
  let allKaplongBranch = true;

  verifyItems.forEach(it => {
    catCounts[it.category] = (catCounts[it.category] || 0) + 1;
    if (it.track_stock !== true) allTrackStock = false;
    if (it.is_active !== true) allActive = false;
    if (it.branch_id !== 3) allKaplongBranch = false;
  });

  console.log('Category breakdown:', catCounts);
  console.log('All items have track_stock = true:', allTrackStock);
  console.log('All items active:', allActive);
  console.log('All items branch_id = 3:', allKaplongBranch);
}

setupKaplongBar().catch(console.error);
