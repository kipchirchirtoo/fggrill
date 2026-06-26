import { supabase } from './src/config/supabase';

async function run() {
  const branchId = 2; // Bomet Town

  const rawItems = [
    { sku: 'BEEF-MBUZI', name: 'BEEF/ MBUZI', unit: 'kg' },
    { sku: 'BEEF', name: 'BEEF', unit: 'kg' },
    { sku: 'MINCED-MEAT', name: 'MINCED MEAT', unit: 'kg' },
    { sku: 'EXE-FLOUR', name: 'EXE FLOUR', unit: 'kg' },
    { sku: 'MILK', name: 'MILK', unit: 'liters' },
    { sku: 'AJAB-FLOUR', name: 'AJAB FLOUR', unit: 'kg' },
    { sku: 'FULL-CHICKEN', name: 'FULL CHICKEN', unit: 'pieces' },
    { sku: 'POTATOES', name: 'POTATOES', unit: 'kg' },
    { sku: 'RICE', name: 'RICE', unit: 'kg' }
  ];

  for (const item of rawItems) {
    console.log(`Checking kitchen_stock for ${item.name}...`);
    const { data: stock, error: fetchErr } = await supabase
      .from('kitchen_stock')
      .select('id, current_balance')
      .eq('branch_id', branchId)
      .eq('item_name', item.name);

    if (fetchErr) {
        console.error('Error fetching stock:', fetchErr.message);
        break;
    }

    if (!stock || stock.length === 0) {
      console.log(`Inserting ${item.name} into kitchen_stock...`);
      const { error: insertErr } = await supabase
        .from('kitchen_stock')
        .insert({
          branch_id: branchId,
          item_sku: item.sku,
          item_name: item.name,
          unit_of_measure: item.unit,
          current_balance: 50
        });
      
      if (insertErr) {
        console.error(`Failed to insert ${item.name}:`, insertErr);
      } else {
        console.log(`Successfully added ${item.name} to stock.`);
      }
    } else {
      console.log(`${item.name} is already in stock.`);
      if (stock[0].current_balance <= 0) {
         console.log(`Updating ${item.name} current_balance...`);
         await supabase
            .from('kitchen_stock')
            .update({ current_balance: 50 })
            .eq('id', stock[0].id);
      }
    }
  }

  console.log('Stock update complete.');
}
run();
