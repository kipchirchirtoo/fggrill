const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectCreditBills() {
  console.log('=== 1. Inspecting staff_credit_bills ===');
  const { data: scb, error: scbErr } = await supabase
    .from('staff_credit_bills')
    .select('*')
    .limit(5);
  console.log('staff_credit_bills:', scb, 'Error:', scbErr);

  console.log('\n=== 2. Inspecting credit_bills ===');
  const { data: cb, error: cbErr } = await supabase
    .from('credit_bills')
    .select('*')
    .limit(5);
  console.log('credit_bills:', cb, 'Error:', cbErr);

  console.log('\n=== 3. Inspecting pos_shift_orders / restaurant_orders credited ===');
  const { data: orders, error: ordersErr } = await supabase
    .from('restaurant_orders')
    .select('*')
    .eq('is_credited', true)
    .limit(5);
  console.log('restaurant_orders credited:', orders, 'Error:', ordersErr);
}

inspectCreditBills();
