require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

console.log('SUPABASE_URL:', supabaseUrl ? 'Found' : 'Missing');
console.log('SUPABASE_KEY:', supabaseKey ? 'Found' : 'Missing');

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPurchaseOrders() {
  console.log('\n=== Testing Purchase Orders Query ===');
  const supplier_id = '47151fed-8aea-426f-a47b-cecbc35c2fb1';
  
  try {
    const { data, error } = await supabase
      .from('store_purchase_orders')
      .select(`
        *,
        supplier:store_suppliers(id, name, supplier_code),
        items:store_po_items(
          *,
          item:store_items(id, name, item_code, unit)
        )
      `)
      .eq('supplier_id', supplier_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Purchase Orders Error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('✅ Purchase Orders Success');
      console.log(`Found ${data?.length || 0} purchase orders`);
      if (data && data.length > 0) {
        console.log('Sample:', JSON.stringify(data[0], null, 2));
      }
    }
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }
}

async function testGRNs() {
  console.log('\n=== Testing GRNs Query ===');
  const supplier_id = '47151fed-8aea-426f-a47b-cecbc35c2fb1';
  
  try {
    const { data, error } = await supabase
      .from('store_grn')
      .select(`
        *,
        supplier:store_suppliers(id, name, supplier_code),
        purchase_order:store_purchase_orders(id, po_number)
      `)
      .eq('supplier_id', supplier_id)
      .order('grn_date', { ascending: false });

    if (error) {
      console.error('❌ GRNs Error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('✅ GRNs Success');
      console.log(`Found ${data?.length || 0} GRNs`);
      if (data && data.length > 0) {
        console.log('Sample:', JSON.stringify(data[0], null, 2));
      }
    }
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }
}

async function testSimplified() {
  console.log('\n=== Testing Simplified Queries ===');
  const supplier_id = '47151fed-8aea-426f-a47b-cecbc35c2fb1';
  
  // Test without joins
  console.log('\n1. Purchase Orders (no joins):');
  const { data: po, error: poError } = await supabase
    .from('store_purchase_orders')
    .select('*')
    .eq('supplier_id', supplier_id);
  
  if (poError) {
    console.error('❌ Error:', poError.message);
  } else {
    console.log(`✅ Found ${po?.length || 0} purchase orders`);
  }

  console.log('\n2. GRNs (no joins):');
  const { data: grn, error: grnError } = await supabase
    .from('store_grn')
    .select('*')
    .eq('supplier_id', supplier_id);
  
  if (grnError) {
    console.error('❌ Error:', grnError.message);
  } else {
    console.log(`✅ Found ${grn?.length || 0} GRNs`);
  }
}

async function main() {
  console.log('Testing Supplier Detail Page Endpoints...\n');
  
  await testSimplified();
  await testPurchaseOrders();
  await testGRNs();
  
  console.log('\n=== Test Complete ===\n');
}

main().catch(console.error);
