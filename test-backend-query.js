require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testBackendQuery() {
    console.log('=== Testing Backend Query Logic ===\n');
    
    const skusToResolve = ['FGH-BEV-V---A-3-4'];
    
    console.log('SKUs to resolve:', skusToResolve);
    console.log('\nQuery string:', `item_code.in.(${skusToResolve.join(',')}),sku.in.(${skusToResolve.join(',')})`);
    
    // Test the exact query the backend would run
    const { data: storeItems, error: resolveError } = await supabase
        .from('store_items')
        .select('id, item_code, sku')
        .or(`item_code.in.(${skusToResolve.join(',')}),sku.in.(${skusToResolve.join(',')})`);
    
    if (resolveError) {
        console.error('\n❌ Error resolving SKUs:', resolveError);
        return;
    }
    
    console.log('\n✅ Query succeeded!');
    console.log('Results:', storeItems?.length || 0, 'items found');
    
    if (storeItems && storeItems.length > 0) {
        console.log('\nItems found:');
        storeItems.forEach(item => {
            console.log('  -', JSON.stringify(item, null, 2));
        });
        
        // Build map using both item_code and sku as keys
        const skuToIdMap = (storeItems || []).reduce((acc, item) => {
            if (item.item_code) acc[item.item_code] = item.id;
            if (item.sku) acc[item.sku] = item.id;
            return acc;
        }, {});
        
        console.log('\nSKU to ID map:', skuToIdMap);
        
        // Test resolution
        for (const sku of skusToResolve) {
            const resolvedId = skuToIdMap[sku];
            if (resolvedId) {
                console.log(`\n✅ SKU "${sku}" resolved to UUID: ${resolvedId}`);
            } else {
                console.log(`\n❌ SKU "${sku}" NOT FOUND in map`);
            }
        }
    } else {
        console.log('\n❌ No items found - this is the problem!');
    }
}

testBackendQuery().catch(console.error);
