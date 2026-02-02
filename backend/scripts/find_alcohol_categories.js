
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Searching for Alcohol Related Categories...');

    const keywords = ['beer', 'wine', 'whisky', 'whiskey', 'spirit', 'vodka', 'gin', 'rum', 'brandy', 'cognac'];
    const { data: categories } = await supabase
        .from('restaurant_menu_categories')
        .select('*');

    if (categories) {
        categories.forEach(cat => {
            const name = cat.name.toLowerCase();
            if (keywords.some(k => name.includes(k))) {
                console.log(`Found: ${cat.name} [ID: ${cat.id}] (is_bar: ${cat.is_bar})`);
            }
        });
    } else {
        console.log('No categories found.');
    }
}

main();
