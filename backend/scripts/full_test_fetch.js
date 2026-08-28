const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testFetch() {
    try {
        console.log('Fetching requests...');
        let query = supabase
            .from('stock_requests')
            .select('*, requesting_branch:branches!requesting_branch_id(name)')
            .order('created_at', { ascending: false });

        const { data: requests, error } = await query;
        if (error) {
            console.error('Requests Error:', error);
            return;
        }

        console.log(`Found ${requests.length} requests.`);

        if (requests.length === 0) return;

        const requestIds = requests.map(r => r.id);
        const { data: items, error: itemsError } = await supabase
            .from('stock_request_items')
            .select('*')
            .in('request_id', requestIds);

        if (itemsError) {
            console.error('Items Error:', itemsError);
            return;
        }

        console.log(`Found ${items.length} items.`);

        const skus = [...new Set((items || []).map(i => i.item_sku))];
        console.log('SKUs:', skus);

        const { data: itemDetails, error: detailsError } = await supabase
            .from('simple_items')
            .select('sku, item_name, description, category, unit_of_measure')
            .in('sku', skus);

        if (detailsError) {
            console.error('Item Details Error:', detailsError);
            return;
        }

        console.log(`Found ${itemDetails.length} item details.`);

        const result = requests.map(request => ({
            ...request,
            branch_name: request.requesting_branch?.name || 'Unknown',
            items: (items || []).filter(i => i.request_id === request.id).map(i => {
                const details = itemDetails?.find(id => id.sku === i.item_sku);
                return {
                    ...i,
                    item_name: details?.item_name || 'Unknown Item',
                    unit: details?.unit_of_measure || 'units'
                };
            })
        }));

        console.log('Sample result:', JSON.stringify(result[0], null, 2));

    } catch (err) {
        console.error('Fatal Error:', err);
    }
}

testFetch();
