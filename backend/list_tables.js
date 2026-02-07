
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    const { data, error } = await supabase.rpc('get_tables'); // Hope this rpc exists
    if (error) {
        // If RPC fails, try standard query to information_schema if allowed, 
        // or just list some likely candidates.
        console.error('RPC failed:', error.message);

        console.log('\n--- Checking common table names ---');
        const tables = [
            'stock_counts', 'stock_count_items',
            'store_physical_counts', 'store_physical_count_items',
            'bar_stock_records', 'bar_inventory_logs',
            'restaurant_bar_inventory', 'restaurant_inventory_items'
        ];

        for (const t of tables) {
            const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
            if (!error) {
                console.log(`${t}: ${count} rows`);
            } else {
                console.log(`${t}: Error or not found`);
            }
        }
    } else {
        console.log('Tables:', data);
    }
}

listTables().catch(console.error);
