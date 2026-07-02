const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Please ensure your .env file has SUPABASE_URL and SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkYesterdaySales() {
  console.log("Checking yesterday's sales for 'Black and White 350ML' and 'Balozi'...");
  
  // Define yesterday's date range (June 24, 2026)
  const startDate = '2026-06-24T00:00:00.000Z';
  const endDate = '2026-06-25T00:00:00.000Z';

  // We query bar_order_items and join the parent bar_orders table
  const { data: items, error } = await supabase
    .from('bar_order_items')
    .select(`
      item_name,
      quantity,
      bar_orders!inner (
        created_at,
        waiter_name,
        cashier_name,
        status,
        payment_status
      )
    `)
    .or('item_name.ilike.%black%white%,item_name.ilike.%balozi%')
    .gte('bar_orders.created_at', startDate)
    .lt('bar_orders.created_at', endDate)
    .neq('bar_orders.status', 'cancelled');

  if (error) {
    console.error("Error querying database:", error.message);
    return;
  }

  if (!items || items.length === 0) {
    console.log("No sales found for these items in yesterday's shift.");
    return;
  }

  // Aggregate and format results
  console.log(`\nFound ${items.length} records. Here are the details:\n`);
  
  let totalBalozi = 0;
  let totalBW = 0;

  items.forEach(record => {
    const order = record.bar_orders;
    const dateStr = new Date(order.created_at).toLocaleString();
    
    console.log(`- [${dateStr}] ${record.quantity}x ${record.item_name} (Waiter: ${order.waiter_name || 'N/A'}, Cashier: ${order.cashier_name || 'N/A'}, Status: ${order.status})`);
    
    if (record.item_name.toLowerCase().includes('balozi')) {
      totalBalozi += record.quantity;
    } else if (record.item_name.toLowerCase().includes('black') && record.item_name.toLowerCase().includes('white')) {
      totalBW += record.quantity;
    }
  });

  console.log("\n--- SUMMARY ---");
  console.log(`Total BALOZI sold: ${totalBalozi}`);
  console.log(`Total BLACK & WHITE 350ML sold: ${totalBW}`);
}

checkYesterdaySales();
