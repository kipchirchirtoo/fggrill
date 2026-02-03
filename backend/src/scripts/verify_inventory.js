require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
    console.log('--- Master Inventory Completeness Report ---');

    const { data: items, error } = await supabase
        .from('store_items')
        .select('name, category, sub_category, unit')
        .order('sub_category', { ascending: true });

    if (error) {
        console.error('Error fetching items:', error);
        return;
    }

    // Filter to only user categories or show all
    console.log(`Total items in master: ${items.length}`);

    const categories = [...new Set(items.map(i => i.sub_category))];

    categories.forEach(cat => {
        console.log(`\n[${cat || 'Uncategorized'}]`);
        const catItems = items.filter(i => i.sub_category === cat);
        catItems.forEach(i => {
            console.log(` - ${i.name} (${i.unit}) | ${i.category}`);
        });
    });
}

verify();
