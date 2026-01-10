const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    const tables = [
        'inventory_items',
        'simple_items',
        'restaurant_inventory_items',
        'stock_counts',
        'stock_count_items',
        'branch_stock',
        'stock_takes',
        'stock_take_items'
    ];

    for (const table of tables) {
        try {
            const { data, error } = await supabase.from(table).select('*').limit(1);
            if (error) {
                console.log(`Table ${table}: Error - ${error.message}`);
            } else {
                console.log(`Table ${table}: Exists. Sample record:`, data[0] ? Object.keys(data[0]) : 'Empty');
            }
        } catch (err) {
            console.log(`Table ${table}: Unexpected error - ${err.message}`);
        }
    }
}

checkTables();
