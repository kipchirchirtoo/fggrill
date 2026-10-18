const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { supabase } = require('../dist/config/supabase');

async function dump() {
  const { data: pos } = await supabase.from('pos_outlet_items')
    .select('name, selling_price, category')
    .eq('outlet_id', '7a69ab32-6594-47d6-ad92-b576301ec201')
    .order('name');
  
  const { data: bDrinks } = await supabase.from('bar_drinks')
    .select('name, price, selling_price, category, branch_id')
    .order('name');

  const { data: bometDrinks } = await supabase.from('bar_drinks')
    .select('name, price, selling_price, category')
    .eq('branch_id', 2)
    .order('name');

  fs.writeFileSync(path.join(__dirname, 'kaplong_pos_items.json'), JSON.stringify(pos, null, 2));
  fs.writeFileSync(path.join(__dirname, 'all_bar_drinks.json'), JSON.stringify(bDrinks, null, 2));
  console.log(`Saved ${pos ? pos.length : 0} Kaplong POS items and ${bDrinks ? bDrinks.length : 0} bar drinks.`);
}

dump();
