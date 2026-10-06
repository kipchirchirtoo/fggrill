const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const KAPLONG_BRANCH_ID = 3;
const KAPLONG_BAR_OUTLET_ID = '7a69ab32-6594-47d6-ad92-b576301ec201';

const NORMALIZATIONS = [
  { oldName: 'AMARULA 1/2', newName: 'AMARULA 350ML', sku: 'FGH-LIQUEURS-001' },
  { oldName: 'BAILEYS 1/2', newName: 'BAILEYS 350ML', sku: 'FGH-LIQUEURS-004' },
  { oldName: 'BEST WHISKY 1/4', newName: 'BEST WHISKY 250ML', sku: 'FGH-WHISKY-002' },
  { oldName: 'BOND 7 1/4', newName: 'BOND 7 250ML', sku: 'FGH-WHISKY-007' },
  { oldName: 'BOND 7 1/2', newName: 'BOND 7 350ML', sku: 'FGH-WHISKY-008' },
  { oldName: 'CAPTAIN MORGAN 1/4', newName: 'CAPTAIN MORGAN 250ML', sku: 'FGH-SPIRITS-004' },
  { oldName: 'GILBEYS 1/4', newName: 'GILBEYS GIN 250ML', sku: 'FGH-GIN-001' },
  { oldName: 'GILBEYS 1/2', newName: 'GILBEYS GIN 350ML', sku: 'FGH-GIN-002' },
  { oldName: 'GRANTS1/2', newName: 'GRANTS 350ML', sku: 'FGH-WHISKY-020' },
  { oldName: 'HUNTERS 1/4', newName: 'HUNTERS 250ML', sku: 'FGH-OTH-HUNTER-0001' },
  { oldName: 'HUNTERS 1/2', newName: 'HUNTERS 350ML', sku: 'FGH-SPIRITS-011' },
  { oldName: 'JAMESON 1/2', newName: 'JAMESON 350ML', sku: 'FGH-WHISKY-033' },
  { oldName: 'KENYA CANE 1/4', newName: 'KENYA CANE 250ML', sku: 'FGH-WHISKY-048' },
  { oldName: 'KENYA CANE 1/2', newName: 'KENYA CANE 350ML', sku: 'FGH-WHISKY-049' },
  { oldName: 'RICHOT 1/4', newName: 'RICHOT 250ML', sku: 'FGH-SPIRITS-020' },
  { oldName: 'RICHORT 1/2', newName: 'RICHOT 350ML', sku: 'FGH-SPIRITS-021' },
  { oldName: 'VAT 69 1/2', newName: 'VAT 69 350ML', sku: 'FGH-WHISKY-064' },
  { oldName: 'VICEROY 1/4', newName: 'VICEROY 250ML', sku: 'FGH-SPIRITS-029' },
  { oldName: 'VICEROY 1/2', newName: 'VICEROY 350ML', sku: 'FGH-SPIRITS-030' },
  { oldName: 'VODKA 1/4', newName: 'VODKA 250ML', sku: 'FGH-VODKA-003' },
  { oldName: 'VODKA 1/2', newName: 'VODKA 350ML', sku: 'FGH-VODKA-004' }
];

async function normalizeFractions() {
  console.log('=== NORMALIZING ALL FRACTIONS TO ML AND CENTRAL STORE SKUs ===');

  for (const item of NORMALIZATIONS) {
    console.log(`\nProcessing: ${item.oldName} -> ${item.newName} (${item.sku})...`);

    // 1. Get Central Store Inventory Item ID
    const { data: inv } = await supabase.from('inventory_items')
      .select('id, sku, item_name')
      .eq('sku', item.sku)
      .maybeSingle();

    const invId = inv?.id || null;

    // 2. Update pos_outlet_items
    const { data: posBefore } = await supabase.from('pos_outlet_items')
      .select('id, name, sku, current_stock')
      .eq('outlet_id', KAPLONG_BAR_OUTLET_ID)
      .eq('name', item.oldName)
      .maybeSingle();

    if (posBefore) {
      await supabase.from('pos_outlet_items')
        .update({
          name: item.newName,
          sku: item.sku
        })
        .eq('id', posBefore.id);
      console.log(`  Updated pos_outlet_items: ${item.newName} (Stock preserved: ${posBefore.current_stock})`);
    } else {
      console.log(`  pos_outlet_items row not found by oldName: ${item.oldName}`);
    }

    // 3. Update bar_drinks
    const { data: drinkBefore } = await supabase.from('bar_drinks')
      .select('id, name, sku')
      .eq('branch_id', KAPLONG_BRANCH_ID)
      .eq('name', item.oldName)
      .maybeSingle();

    if (drinkBefore) {
      await supabase.from('bar_drinks')
        .update({
          name: item.newName,
          sku: item.sku,
          inventory_item_id: invId || drinkBefore.inventory_item_id
        })
        .eq('id', drinkBefore.id);
      console.log(`  Updated bar_drinks: ${item.newName} (Linked to invId: ${invId})`);
    }

    // 4. Update bar_stock
    const { data: stockBefore } = await supabase.from('bar_stock')
      .select('id, item_name, item_sku, current_stock')
      .eq('branch_id', KAPLONG_BRANCH_ID)
      .eq('item_name', item.oldName)
      .maybeSingle();

    if (stockBefore) {
      await supabase.from('bar_stock')
        .update({
          item_name: item.newName,
          item_sku: item.sku
        })
        .eq('id', stockBefore.id);
      console.log(`  Updated bar_stock: ${item.newName} (Stock preserved: ${stockBefore.current_stock})`);
    }

    // 5. Update branch_stock
    const { data: brStockBefore } = await supabase.from('branch_stock')
      .select('id, item_name, item_sku, current_stock, quantity')
      .eq('branch_id', KAPLONG_BRANCH_ID)
      .eq('item_name', item.oldName)
      .maybeSingle();

    if (brStockBefore) {
      await supabase.from('branch_stock')
        .update({
          item_name: item.newName,
          item_sku: item.sku
        })
        .eq('id', brStockBefore.id);
      console.log(`  Updated branch_stock: ${item.newName}`);
    }
  }

  // Verification
  console.log('\n=== VERIFICATION ===');
  const { data: checkPos } = await supabase.from('pos_outlet_items')
    .select('name, sku, current_stock, selling_price')
    .eq('outlet_id', KAPLONG_BAR_OUTLET_ID)
    .eq('is_active', true)
    .in('name', NORMALIZATIONS.map(n => n.newName));

  console.log(`Verified ${checkPos?.length} normalized items in Kaplong Main Bar POS:`);
  console.table(checkPos);
}

normalizeFractions().then(() => {
  console.log('\nAll fractions normalized to ML and Central Store SKUs successfully!');
  process.exit(0);
}).catch(err => {
  console.error('Error during normalization:', err);
  process.exit(1);
});
