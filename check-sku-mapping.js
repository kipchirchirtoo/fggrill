require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSKUMapping() {
    console.log('=== Checking SKU Mapping Between simple_items and store_items ===\n');
    
    // Get a sample SKU from simple_items
    const testSKU = 'FGH-BEV-V---A-3-4';
    
    console.log(`1. Checking simple_items for SKU: ${testSKU}`);
    const { data: simpleItem, error: simpleError } = await supabase
        .from('simple_items')
        .select('*')
        .eq('sku', testSKU)
        .single();
    
    if (simpleError) {
        console.error('Error fetching from simple_items:', simpleError);
    } else {
        console.log('Found in simple_items:', JSON.stringify(simpleItem, null, 2));
    }
    
    console.log(`\n2. Checking store_items for matching records:`);
    
    // Check by item_code
    const { data: byItemCode, error: itemCodeError } = await supabase
        .from('store_items')
        .select('id, item_code, sku, name')
        .eq('item_code', testSKU);
    
    console.log(`   a) By item_code = '${testSKU}':`, byItemCode?.length || 0, 'results');
    if (byItemCode && byItemCode.length > 0) {
        console.log('      ', JSON.stringify(byItemCode[0], null, 2));
    }
    
    // Check by sku
    const { data: bySKU, error: skuError } = await supabase
        .from('store_items')
        .select('id, item_code, sku, name')
        .eq('sku', testSKU);
    
    console.log(`   b) By sku = '${testSKU}':`, bySKU?.length || 0, 'results');
    if (bySKU && bySKU.length > 0) {
        console.log('      ', JSON.stringify(bySKU[0], null, 2));
    }
    
    // Check with OR condition (like the backend does)
    const { data: byOr, error: orError } = await supabase
        .from('store_items')
        .select('id, item_code, sku, name')
        .or(`item_code.eq.${testSKU},sku.eq.${testSKU}`);
    
    console.log(`   c) By OR condition:`, byOr?.length || 0, 'results');
    if (byOr && byOr.length > 0) {
        console.log('      ', JSON.stringify(byOr[0], null, 2));
    }
    
    console.log('\n3. Sample of store_items table (first 5 rows):');
    const { data: sampleItems } = await supabase
        .from('store_items')
        .select('id, item_code, sku, name')
        .limit(5);
    
    if (sampleItems) {
        sampleItems.forEach(item => {
            console.log('   ', JSON.stringify(item, null, 2));
        });
    }
    
    console.log('\n4. Count of items in each table:');
    const { count: simpleCount } = await supabase
        .from('simple_items')
        .select('sku', { count: 'exact', head: true });
    
    const { count: storeCount } = await supabase
        .from('store_items')
        .select('id', { count: 'exact', head: true });
    
    console.log(`   simple_items: ${simpleCount} items`);
    console.log(`   store_items: ${storeCount} items`);
    
    console.log('\n=== CONCLUSION ===');
    if (!byOr || byOr.length === 0) {
        console.log('❌ SKU from simple_items NOT FOUND in store_items');
        console.log('   This is the root cause of the 400 error!');
        console.log('\n   SOLUTION: Items in simple_items need to be synced to store_items');
        console.log('   OR: Use simple_items directly for purchase orders');
    } else {
        console.log('✅ SKU mapping exists - backend should work');
    }
}

checkSKUMapping().catch(console.error);
