require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspect() {
  console.log('=== SOTIK (branch 4) OPEN SHIFT ORDERS ===');
  const { data: sOrders, error: sErr } = await supabase
    .from('pos_shift_orders')
    .select('id, order_number, status, payment_status, kitchen_status, captain_printed_at, created_at, items, total_amount')
    .eq('shift_id', 'ecd81b67-1c34-4963-90a5-df11f1a21b75')
    .order('created_at', { ascending: false })
    .limit(10);

  if (sErr) console.error('Sotik orders error:', sErr);
  else {
    console.log(`Total orders in open shift: ${sOrders.length}`);
    sOrders.forEach(o => {
      console.log(`  Order #${o.order_number} [${o.id}] status=${o.status}, pay=${o.payment_status}, kitchen=${o.kitchen_status}, captain_printed_at=${o.captain_printed_at}, items=${(o.items || []).length}, created=${o.created_at}`);
    });
  }

  console.log('\n=== LITEIN (branch 7) OPEN SHIFT ORDERS ===');
  const { data: lOrders, error: lErr } = await supabase
    .from('pos_shift_orders')
    .select('id, order_number, status, payment_status, kitchen_status, captain_printed_at, created_at, items, total_amount')
    .eq('shift_id', 'a9d4d2c8-7940-4253-98bd-c3f78e59a787')
    .order('created_at', { ascending: false })
    .limit(10);

  if (lErr) console.error('Litein orders error:', lErr);
  else {
    console.log(`Total orders in open shift: ${lOrders.length}`);
    lOrders.forEach(o => {
      console.log(`  Order #${o.order_number} [${o.id}] status=${o.status}, pay=${o.payment_status}, kitchen=${o.kitchen_status}, captain_printed_at=${o.captain_printed_at}, items=${(o.items || []).length}, created=${o.created_at}`);
    });
  }

  console.log('\n=== ALL RECENT ORDERS IN SOTIK AND LITEIN (LAST 24 HOURS) ===');
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: recentOrders } = await supabase
    .from('pos_shift_orders')
    .select('id, order_number, status, payment_status, kitchen_status, captain_printed_at, created_at, shift_id, outlet_id')
    .gte('created_at', yesterday)
    .order('created_at', { ascending: false })
    .limit(30);

  console.log(`Recent orders across all branches in last 24h: ${recentOrders ? recentOrders.length : 0}`);
}

inspect().catch(console.error);
