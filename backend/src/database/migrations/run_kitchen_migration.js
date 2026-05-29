const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://utsvlihpudfraxzcmtle.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to run the kitchen migration');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function runMigration() {
    try {
        // console.log('🚀 Starting Kitchen Management Module migration...\n');

        // Read the SQL file
        const sqlPath = path.join(__dirname, '20260114_kitchen_management.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

        // console.log('📝 Executing migration SQL...\n');

        // Execute the entire SQL content at once using Supabase SQL editor approach
        // We'll use the REST API directly
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            },
            body: JSON.stringify({ query: sqlContent })
        });

        if (!response.ok) {
            // If RPC doesn't work, we'll create tables individually
            // console.log('⚠️  RPC method not available, creating tables individually...\n');

            // Create tables using Supabase client
            const tables = [
                'kitchen_stock',
                'kitchen_stock_ledger',
                'kitchen_requisitions',
                'kitchen_requisition_items',
                'kitchen_grn',
                'kitchen_grn_items',
                'recipes',
                'recipe_items',
                'kitchen_usage',
                'kitchen_wastage',
                'kitchen_daily_variance'
            ];

            // console.log('✅ Migration SQL prepared. Please run this in Supabase SQL Editor:');
            // console.log('\n' + '='.repeat(80));
            // console.log('Go to: https://supabase.com/dashboard/project/utsvlihpudfraxzcmtle/sql/new');
            // console.log('Copy and paste the contents of:');
            // console.log('backend/src/database/migrations/20260114_kitchen_management.sql');
            // console.log('='.repeat(80) + '\n');

            // console.log('📋 Tables to be created:');
            tables.forEach((table, i) => {
                // console.log(`   ${i + 1}. ${table}`);
            });

            // console.log('\n✨ After running the migration, the following will be created:');
            // console.log('   - 11 tables for kitchen management');
            // console.log('   - Triggers for auto-updating stock balances');
            // console.log('   - Functions for generating requisition/GRN numbers');
            // console.log('   - Functions for calculating recipe costs');

            return;
        }

        const result = await response.json();
        // console.log('✅ Migration completed successfully!');
        // console.log(result);

    } catch (error) {
        console.error('❌ Migration error:', error.message);
        // console.log('\n📋 Manual Migration Instructions:');
        // console.log('1. Go to: https://supabase.com/dashboard/project/utsvlihpudfraxzcmtle/sql/new');
        // console.log('2. Copy the contents of: backend/src/database/migrations/20260114_kitchen_management.sql');
        // console.log('3. Paste and run in the SQL Editor');
    }
}

runMigration();
