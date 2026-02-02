
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('--- Inspecting COLD BEVERAGES [BAR] Items ---');

    // Get Category ID
    const { data: cats } = await supabase
        .from('restaurant_menu_categories')
        .select('id')
        .eq('name', 'COLD BEVERAGES [BAR]')
        .single();

    if (!cats) { console.log('Category not found'); return; }

    const { data: items } = await supabase
        .from('restaurant_menu_items')
        .select('id, name')
        .eq('category_id', cats.id);

    items.forEach(i => console.log(`- ${i.name}`));
}

main();
