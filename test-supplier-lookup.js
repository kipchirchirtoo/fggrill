require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supplierId = '622dbf68-0581-4bb6-981f-338f1087bbff';

async function test() {
  console.log('Looking up supplier:', supplierId);
  
  const { data, error } = await supabase
    .from('store_suppliers')
    .select('id, name, supplier_code, tax_id, vat_number')
    .eq('id', supplierId)
    .single();
  
  if (error) {
    console.error('Error:', error.message, error.code);
  } else {
    console.log('Found supplier:', data);
  }
  
  // Also list first 5 suppliers to confirm table exists
  const { data: list, error: listErr } = await supabase
    .from('store_suppliers')
    .select('id, name, supplier_code')
    .limit(5);
  
  if (listErr) {
    console.error('List error:', listErr.message);
  } else {
    console.log('\nFirst 5 suppliers:', list);
  }
}

test();
