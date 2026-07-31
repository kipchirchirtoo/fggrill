const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectCreditBillDetails() {
  console.log('=== Inspecting credit bill details ===');
  
  // 1. Fetch a few staff_credit_bills
  const { data: scb } = await supabase
    .from('staff_credit_bills')
    .select('*')
    .limit(3);

  console.log('staff_credit_bills sample:', JSON.stringify(scb, null, 2));

  // 2. Fetch a few credit_bills
  const { data: cb } = await supabase
    .from('credit_bills')
    .select('*')
    .limit(3);

  console.log('\ncredit_bills sample:', JSON.stringify(cb, null, 2));
}

inspectCreditBillDetails();
