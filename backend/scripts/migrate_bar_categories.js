const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    const migrationFile = '20260202_add_is_bar_to_categories.sql';
    console.log(`Loading migration: ${migrationFile}`);
    const sqlPath = path.join(__dirname, '..', 'migrations', migrationFile);

    if (!fs.existsSync(sqlPath)) {
        console.error(`Migration file not found: ${sqlPath}`);
        return;
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Running SQL...');

    // Try to use exec_sql RPC
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Migration failed via RPC:', error);
        console.log('Falling back to direct data updates if column exists...');

        // If RPC fails, column might already exist, try to update data via JS client
        try {
            const BAR_KEYWORDS = [
                'beverage', 'drink', 'beer', 'wine', 'cocktail', 'spirit',
                'juice', 'tea', 'coffee', 'water', 'soda', 'shisha',
                'liquor', 'whiskey', 'vodka', 'gin', 'rum', 'brandy', 'tequila'
            ];

            const { data: categories, error: fetchError } = await supabase
                .from('restaurant_menu_categories')
                .select('id, name');

            if (fetchError) throw fetchError;

            for (const cat of categories) {
                const isBar = BAR_KEYWORDS.some(k => cat.name.toLowerCase().includes(k));
                await supabase
                    .from('restaurant_menu_categories')
                    .update({ is_bar: isBar })
                    .eq('id', cat.id);
            }
            console.log('Data update completed (assumed column exists).');
        } catch (updateError) {
            console.error('Manual update failed:', updateError.message);
            console.log('Please run the migration manually in Supabase SQL Editor:');
            console.log(sql);
        }
    } else {
        console.log('Migration successful via RPC:', data);
    }
}

runMigration();
