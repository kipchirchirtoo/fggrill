const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://utsvlihpudfraxzcmtle.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
    try {
        // console.log('🚀 Starting Food Controls Enhancement migration...\n');

        const sqlPath = path.join(__dirname, '20260203_food_controls_enhancement.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

        // console.log('📝 Executing migration SQL...\n');

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
            const errorText = await response.text();
            console.error('❌ RPC error:', errorText);
            return;
        }

        const result = await response.json();
        // console.log('✅ Migration completed successfully!');
        // console.log(result);

    } catch (error) {
        console.error('❌ Migration error:', error.message);
    }
}

runMigration();
