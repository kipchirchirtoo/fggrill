const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findItems() {
  console.log('=== Finding items for credit bills ===');
  
  // 1. Fetch recent credit_bills
  const { data: cbList } = await supabase.from('credit_bills').select('*').order('created_at', { ascending: false }).limit(10);
  console.log('Recent 10 credit_bills:');
  for (const b of cbList || []) {
    console.log(`ID: ${b.id} | BillNo: ${b.bill_number} | DocNo: ${b.source_document_number} | PosOrderId: ${b.source_pos_order_id} | Name: ${b.customer_name} | Amount: ${b.total_amount}`);
  }

  // 2. Fetch recent pos_shift_orders
  const { data: psoList } = await supabase.from('pos_shift_orders').select('*').order('created_at', { ascending: false }).limit(10);
  console.log('\nRecent 10 pos_shift_orders:');
  for (const o of psoList || []) {
    console.log(`ID: ${o.id} | OrderNo: ${o.order_number} | ShortCode: ${o.short_code} | Customer: ${o.customer_name} | Amount: ${o.total_amount} | Status: ${o.payment_status}`);
  }

  // 3. Fetch recent pos_order_items
  const { data: poiList } = await supabase.from('pos_order_items').select('*').limit(10);
  console.log('\nSample pos_order_items:');
  for (const item of poiList || []) {
    console.log(`ID: ${item.id} | OrderID: ${item.order_id} | Name: ${item.item_name || item.name} | Qty: ${item.quantity || item.qty} | Price: ${item.unit_price || item.price}`);
  }
}

findItems();
