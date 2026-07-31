const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testLinkCreditItems() {
  console.log('=== Testing Linkage between Credit Bills and POS Orders ===');

  // Let's check pos_shift_orders where staff_credit_bill_id is not null OR payment_method = credit OR payment_status = credit OR notes/metadata has bill_number
  const { data: posOrders } = await supabase
    .from('pos_shift_orders')
    .select('id, order_number, short_code, staff_credit_bill_id, customer_name, total_amount, items, created_at')
    .not('items', 'is', null)
    .limit(10);

  console.log(`Found ${posOrders?.length || 0} pos_shift_orders with items:`);
  for (const po of posOrders || []) {
    console.log(`Order ${po.order_number} (${po.short_code}), StaffBillID: ${po.staff_credit_bill_id}, Items Count: ${Array.isArray(po.items) ? po.items.length : 0}`);
  }

  // Let's check staff_credit_bills linked to pos_shift_orders via staff_credit_bill_id or source_pos_order_id
  const { data: staffBills } = await supabase
    .from('staff_credit_bills')
    .select('*')
    .limit(10);

  for (const sb of staffBills || []) {
    // Try matching pos_shift_orders by staff_credit_bill_id = sb.id OR source_pos_order_id = sb.source_pos_order_id OR short_code / order_number matching description/bill_number
    const { data: matchedOrder } = await supabase
      .from('pos_shift_orders')
      .select('id, order_number, short_code, items, total_amount')
      .or(`staff_credit_bill_id.eq.${sb.id}${sb.source_pos_order_id ? `,id.eq.${sb.source_pos_order_id}` : ''}`)
      .maybeSingle();

    if (matchedOrder && matchedOrder.items) {
      console.log(`\n✅ LINK MATCHED for staff_credit_bill ${sb.bill_number}:`, matchedOrder.items);
    } else {
      // Also try matching by bill_number or doc_number in credit_bills
      console.log(`No direct pos_shift_order for staff_credit_bill ${sb.bill_number} (Amount KES ${sb.amount})`);
    }
  }
}

testLinkCreditItems();
