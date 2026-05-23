const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/allansamuel/Desktop/fggrill/backend/.env' });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data: cols } = await supabase.rpc('get_tables_with_counts'); 
  // Wait, let's just query a single item from simple_items
  const { data: item, error } = await supabase.from('simple_items').select('*').limit(1);
  console.log("Simple Items:", item);
  
  const { data: ledger, error: ledgerErr } = await supabase.from('central_stock_ledger').select('*').limit(1);
  console.log("Central Stock Ledger:", ledgerErr ? ledgerErr.message : ledger);
}

checkSchema();
