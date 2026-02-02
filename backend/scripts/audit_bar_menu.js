
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('--- Current BAR Categories ---');
    const { data: categories } = await supabase
        .from('restaurant_menu_categories')
        .select('*')
        .eq('is_bar', true);

    if (!categories || categories.length === 0) {
        console.log('No BAR categories found.');
    } else {
        for (const cat of categories) {
            console.log(`[ID: ${cat.id}] ${cat.name}`);

            // Get items for this category
            const { data: items } = await supabase
                .from('restaurant_menu_items')
                .select('id, name, price')
                .eq('category_id', cat.id);

            if (items && items.length > 0) {
                console.log(`    -> Contains ${items.length} items (showing first 5):`);
                items.slice(0, 5).forEach(i => console.log(`       - ${i.name} (${i.price})`));
            } else {
                console.log(`    -> (Empty)`);
            }
        }
    }
}

main();
