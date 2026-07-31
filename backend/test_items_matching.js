const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testComprehensiveItemsMatching() {
  console.log('=== Testing Comprehensive Items Matching for Credit Bills ===');

  // Let's get staff_profiles for MERCY CHEPKIRUI
  const { data: staff } = await supabase
    .from('staff_profiles')
    .select('*')
    .ilike('first_name', '%MERCY%')
    .limit(1)
    .single();

  if (!staff) {
    console.log('Staff not found');
    return;
  }

  console.log(`Found Staff: ${staff.first_name} ${staff.last_name} (ID: ${staff.id}, UserID: ${staff.user_id})`);

  // Fetch credit_bills & staff_credit_bills for this staff
  const { data: staffBills } = await supabase
    .from('staff_credit_bills')
    .select('*')
    .eq('staff_id', staff.id);

  const { data: cbBills } = await supabase
    .from('credit_bills')
    .select('*')
    .or(`staff_id.eq.${staff.id},customer_name.ilike.%MERCY%`);

  console.log(`Found ${staffBills?.length || 0} staff_credit_bills and ${cbBills?.length || 0} credit_bills`);

  // Fetch all pos_shift_orders for this staff / waiter / customer
  const staffIds = [staff.id, staff.user_id].filter(Boolean);
  const { data: posOrders } = await supabase
    .from('pos_shift_orders')
    .select('id, order_number, short_code, waiter_id, waiter_name, customer_name, total_amount, items, created_at, staff_credit_bill_id')
    .or(`waiter_id.in.(${staffIds.join(',')}),created_by.in.(${staffIds.join(',')}),customer_name.ilike.%MERCY%`);

  console.log(`Found ${posOrders?.length || 0} candidate pos_shift_orders`);

  for (const b of [...(staffBills || []), ...(cbBills || [])]) {
    const billAmt = Number(b.amount || b.total_amount || 0);
    const billDate = (b.bill_date || b.credit_date || b.created_at || '').split('T')[0];

    // Try matching order
    let matched = (posOrders || []).find(o => 
      o.staff_credit_bill_id === b.id ||
      o.id === b.source_pos_order_id ||
      o.order_number === b.source_document_number ||
      o.short_code === b.source_document_number
    );

    if (!matched) {
      // Try fuzzy date & amount match
      matched = (posOrders || []).find(o => {
        const oDate = (o.created_at || '').split('T')[0];
        const oAmt = Number(o.total_amount || 0);
        return oDate === billDate && Math.abs(oAmt - billAmt) < 0.01;
      });
    }

    if (matched && Array.isArray(matched.items) && matched.items.length > 0) {
      console.log(`\n🎉 MATCHED ITEMS for Bill ${b.bill_number} (KES ${billAmt}, Date ${billDate}):`);
      matched.items.forEach(i => console.log(`   - ${i.quantity || i.qty || 1}x ${i.name || i.item_name} @ KES ${i.unit_price || i.price} = KES ${i.line_total || i.total || i.price}`));
    } else {
      console.log(`\n⚠️ No items match found for Bill ${b.bill_number} (KES ${billAmt}, Date ${billDate}, Desc: ${b.description || b.notes || 'N/A'})`);
    }
  }
}

testComprehensiveItemsMatching();
