const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkData() {
  console.log('Checking store_supplier_invoices...');
  const { data: invoices, count: invCount, error: invError } = await supabase
    .from('store_supplier_invoices')
    .select('*', { count: 'exact', head: true });
  
  if (invError) console.error('Error fetching invoices:', invError);
  else console.log(`Total invoices: ${invCount}`);

  console.log('Checking store_grn...');
  const { data: grns, count: grnCount, error: grnError } = await supabase
    .from('store_grn')
    .select('*', { count: 'exact', head: true });
  
  if (grnError) console.error('Error fetching GRNs:', grnError);
  else console.log(`Total GRNs: ${grnCount}`);

  // Check some recent records
  const { data: recentInvoices } = await supabase
    .from('store_supplier_invoices')
    .select('invoice_date, created_at, status')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('Recent invoices:', recentInvoices);
}

checkData();
