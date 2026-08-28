
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Searching for Alcohol Items...');

    const keywords = ['tusker', 'guiness', 'whisky', 'whiskey', 'vodka', 'gin', 'wine', 'beer'];
    const { data: items } = await supabase
        .from('restaurant_menu_items')
        .select('id, name, category_id');

    let found = false;
    if (items) {
        items.forEach(item => {
            const name = item.name.toLowerCase();
            if (keywords.some(k => name.includes(k))) {
                console.log(`Found Item: ${item.name} [CatID: ${item.category_id}]`);
                found = true;
            }
        });
    }

    if (!found) console.log('No alcoholic items found.');
}

main();
