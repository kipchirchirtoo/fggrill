const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCounts() {
    try {
        const { count: totalCount, error: totalError } = await supabase
            .from('simple_items')
            .select('*', { count: 'exact', head: true });

        const { count: beverageCount, error: beverageError } = await supabase
            .from('simple_items')
            .select('*', { count: 'exact', head: true })
            .ilike('category', '%beverage%');

        const { count: activeCount, error: activeError } = await supabase
            .from('simple_items')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        const { count: activeBeverageCount, error: activeBeverageError } = await supabase
            .from('simple_items')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true)
            .ilike('category', '%beverage%');

        const { data: categories } = await supabase
            .from('simple_items')
            .select('category');

        const uniqueCategories = [...new Set(categories.map(c => c.category))];

        console.log('Total items in simple_items:', totalCount);
        console.log('Beverage items in simple_items:', beverageCount);
        console.log('Total ACTIVE items:', activeCount);
        console.log('Active Beverage items:', activeBeverageCount);
        console.log('Unique categories:', uniqueCategories);

    } catch (err) {
        console.error(err);
    }
}

checkCounts();
