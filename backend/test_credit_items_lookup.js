const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFetchOrderItemsForCreditBill() {
  console.log('=== Testing Order Items Lookup for Credit Bills ===');

  // Let's query credit_bills for MERCY CHEPKIRUI or any recent credit bills
  const { data: bills } = await supabase
    .from('credit_bills')
    .select('*')
    .ilike('customer_name', '%MERCY%')
    .limit(5);

  console.log(`Found ${bills?.length || 0} credit_bills for MERCY:`);
  for (const b of bills || []) {
    console.log(`\nBill Number: ${b.bill_number}, Amount: ${b.total_amount}, Document: ${b.source_document_number}, OrderID: ${b.source_pos_order_id}`);
    
    // Let's see if source_pos_order_id or source_document_number matches pos_shift_orders
    let order = null;
    if (b.source_pos_order_id) {
      const { data } = await supabase.from('pos_shift_orders').select('*').eq('id', b.source_pos_order_id).maybeSingle();
      order = data;
    }
    if (!order && b.source_document_number) {
      const { data } = await supabase.from('pos_shift_orders').select('*').or(`order_number.eq.${b.source_document_number},short_code.eq.${b.source_document_number}`).maybeSingle();
      order = data;
    }
    if (!order && b.bill_number) {
      // Try searching for bill_number in description or notes or metadata
      const { data } = await supabase.from('pos_shift_orders').select('*').or(`order_number.eq.${b.bill_number},short_code.eq.${b.bill_number}`).maybeSingle();
      order = data;
    }

    if (order) {
      console.log(`-> Found matching pos_shift_order ${order.id} (${order.order_number})`);
      const { data: items } = await supabase.from('pos_order_items').select('*').eq('order_id', order.id);
      console.log(`-> Order Items (${items?.length || 0}):`, items?.map(i => `${i.quantity || i.qty}x ${i.item_name || i.name} @ KES ${i.unit_price || i.price}`).join(', '));
    } else {
      console.log('-> No direct pos_shift_order match via ID/doc number.');
    }
  }

  // Also let's check staff_credit_bills for MERCY
  const { data: staffBills } = await supabase
    .from('staff_credit_bills')
    .select('*')
    .ilike('description', '%MERCY%')
    .limit(5);

  console.log(`\nFound ${staffBills?.length || 0} staff_credit_bills for MERCY:`);
  for (const sb of staffBills || []) {
    console.log(`\nStaff Bill: ${sb.bill_number}, Amount: ${sb.amount}, OrderID: ${sb.source_pos_order_id}, Desc: ${sb.description}`);
    
    let order = null;
    if (sb.source_pos_order_id) {
      const { data } = await supabase.from('pos_shift_orders').select('*').eq('id', sb.source_pos_order_id).maybeSingle();
      order = data;
    }
    if (!order && sb.bill_number) {
      const { data } = await supabase.from('pos_shift_orders').select('*').or(`order_number.eq.${sb.bill_number},short_code.eq.${sb.bill_number}`).maybeSingle();
      order = data;
    }
    // Also check if bill_number is contained in description e.g. CRD-202607-01024
    if (!order) {
      // Extract bill_number or doc number from description e.g. CRD-202607-01024
      const match = sb.description.match(/CRD-\d{6}-\d{5}/);
      if (match) {
        const { data: cb } = await supabase.from('credit_bills').select('*').eq('bill_number', match[0]).maybeSingle();
        if (cb) {
          console.log(`-> Matched credit_bills row ${cb.id}, doc_number: ${cb.source_document_number}, source_pos_order_id: ${cb.source_pos_order_id}`);
          if (cb.source_pos_order_id) {
            const { data } = await supabase.from('pos_shift_orders').select('*').eq('id', cb.source_pos_order_id).maybeSingle();
            order = data;
          }
          if (!order && cb.source_document_number) {
            const { data } = await supabase.from('pos_shift_orders').select('*').or(`order_number.eq.${cb.source_document_number},short_code.eq.${cb.source_document_number},id.eq.${cb.source_document_number}`).maybeSingle();
            order = data;
          }
        }
      }
    }

    if (order) {
      console.log(`-> Found matching pos_shift_order ${order.id} (${order.order_number})`);
      const { data: items } = await supabase.from('pos_order_items').select('*').eq('order_id', order.id);
      console.log(`-> Order Items (${items?.length || 0}):`, items?.map(i => `${i.quantity || i.qty || 1}x ${i.item_name || i.name} @ KES ${i.unit_price || i.price}`).join(', '));
    } else {
      console.log('-> No direct order found.');
    }
  }
}

testFetchOrderItemsForCreditBill();
