const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findCreditBillItems() {
  console.log('=== Deep Searching Credit Bill Items Linkage ===');

  // Let's inspect credit_bills rows where metadata or source fields exist
  const { data: cbs } = await supabase
    .from('credit_bills')
    .select('*')
    .not('source_document_number', 'is', null)
    .neq('source_document_number', 'pending')
    .limit(10);

  console.log('Sample credit_bills with doc numbers:', cbs?.map(c => ({
    bill_number: c.bill_number,
    doc_num: c.source_document_number,
    order_id: c.source_pos_order_id,
    metadata: c.metadata,
    notes: c.notes
  })));

  // Let's check pos_order_payments table for credit payments
  const { data: pop } = await supabase
    .from('pos_order_payments')
    .select('*')
    .or('payment_method.eq.credit,payment_method.eq.staff_credit')
    .limit(5);

  console.log('\nSample pos_order_payments with credit method:', pop);

  // Let's inspect pos_shift_orders where payment_status = credit
  const { data: creditOrders } = await supabase
    .from('pos_shift_orders')
    .select('id, order_number, short_code, total_amount, payment_status, customer_name, metadata, notes')
    .or('payment_status.eq.credit,payment_status.eq.staff_credit,payment_method.eq.credit')
    .limit(5);

  console.log('\nSample pos_shift_orders with credit payment_status:', creditOrders);

  // Let's check if there are any tables named *credit_bill* or *items*
  const { data: tables } = await supabase
    .rpc('get_tables_list')
    .catch(() => ({ data: null }));

  console.log('RPC tables:', tables);
}

findCreditBillItems();
