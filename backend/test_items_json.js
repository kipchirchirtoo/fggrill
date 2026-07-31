const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectItemsStructure() {
  console.log('=== Inspecting items in pos_shift_orders ===');
  const { data: order } = await supabase
    .from('pos_shift_orders')
    .select('*')
    .limit(1)
    .single();

  console.log('pos_shift_orders keys:', Object.keys(order || {}));
  if (order?.items) console.log('order.items:', JSON.stringify(order.items, null, 2));

  // Let's check credit_bills keys & metadata
  const { data: cb } = await supabase
    .from('credit_bills')
    .select('*')
    .limit(1)
    .single();
  console.log('\ncredit_bills keys:', Object.keys(cb || {}));

  // Let's check restaurant_orders
  const { data: ro } = await supabase.from('restaurant_orders').select('*').limit(1).maybeSingle();
  if (ro) console.log('\nrestaurant_orders keys:', Object.keys(ro));

  // Let's check bar_orders
  const { data: bo } = await supabase.from('bar_orders').select('*').limit(1).maybeSingle();
  if (bo) console.log('\nbar_orders keys:', Object.keys(bo));
}

inspectItemsStructure();
