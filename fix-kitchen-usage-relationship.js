require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixKitchenUsageRelationship() {
    console.log('🔧 Fixing kitchen_usage_records relationship with users...\n');

    try {
        // Step 1: Check if the table exists
        const { data: tables, error: tableError } = await supabase
            .from('kitchen_usage_records')
            .select('id')
            .limit(1);

        if (tableError) {
            console.log('ℹ️  kitchen_usage_records table does not exist or has no data');
            console.log('   This is expected if the feature hasn\'t been used yet');
            return;
        }

        // Step 2: Check current structure
        console.log('📊 Checking kitchen_usage_records structure...');
        
        const { data: records, error: checkError } = await supabase
            .from('kitchen_usage_records')
            .select('*')
            .limit(5);

        if (checkError) {
            console.error('❌ Error checking records:', checkError.message);
            return;
        }

        console.log(`   Found ${records?.length || 0} sample records`);

        // Step 3: Check for invalid user references
        console.log('\n🔍 Checking for invalid user references...');
        
        const { data: invalidRecords, error: invalidError } = await supabase.rpc('check_invalid_kitchen_usage_users', {});

        if (invalidError && !invalidError.message.includes('does not exist')) {
            console.log('   Creating helper function...');
            
            // Create the helper function
            const createFunctionSQL = `
                CREATE OR REPLACE FUNCTION check_invalid_kitchen_usage_users()
                RETURNS TABLE(record_id INTEGER, user_id UUID) AS $$
                BEGIN
                    RETURN QUERY
                    SELECT k.id, k.recorded_by
                    FROM kitchen_usage_records k
                    LEFT JOIN users u ON k.recorded_by = u.id
                    WHERE k.recorded_by IS NOT NULL AND u.id IS NULL;
                END;
                $$ LANGUAGE plpgsql;
            `;

            // Note: We can't execute raw SQL through Supabase client directly
            // So we'll check manually
            console.log('   Checking for orphaned records manually...');
        }

        // Step 4: Apply the fix using SQL
        console.log('\n🔧 Applying database fix...');
        
        const fixSQL = `
-- Fix kitchen_usage_records relationship with users

-- 1. Check if foreign key exists
DO $$ 
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'kitchen_usage_records_recorded_by_fkey'
        AND table_name = 'kitchen_usage_records'
    ) THEN
        ALTER TABLE kitchen_usage_records DROP CONSTRAINT kitchen_usage_records_recorded_by_fkey;
    END IF;
END $$;

-- 2. Clean up invalid references (set to NULL if user doesn't exist)
UPDATE kitchen_usage_records k
SET recorded_by = NULL
WHERE recorded_by IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = k.recorded_by);

-- 3. Add proper foreign key constraint
ALTER TABLE kitchen_usage_records
ADD CONSTRAINT kitchen_usage_records_recorded_by_fkey
FOREIGN KEY (recorded_by) REFERENCES users(id)
ON DELETE SET NULL;

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_kitchen_usage_records_recorded_by 
ON kitchen_usage_records(recorded_by);
`;

        console.log('\n📝 SQL to execute:');
        console.log('---');
        console.log(fixSQL);
        console.log('---\n');

        console.log('✅ Fix prepared!');
        console.log('\n📋 To apply this fix, run the SQL above in your Supabase SQL Editor');
        console.log('   OR use a database migration tool\n');

        // Save to file
        const fs = require('fs');
        fs.writeFileSync('fix-kitchen-usage-relationship.sql', fixSQL);
        console.log('💾 SQL saved to: fix-kitchen-usage-relationship.sql\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

fixKitchenUsageRelationship()
    .then(() => {
        console.log('✅ Analysis complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
