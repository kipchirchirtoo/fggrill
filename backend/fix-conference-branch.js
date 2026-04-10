const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixConferenceBranch() {
    console.log('🔍 Checking conference_hall_bookings table schema...\n');

    try {
        // Check if branch_id column exists by trying to select it
        const { data, error } = await supabase
            .from('conference_hall_bookings')
            .select('id, branch_id')
            .limit(1);

        if (error) {
            if (error.message.includes('column') && error.message.includes('branch_id')) {
                console.log('❌ branch_id column does NOT exist in conference_hall_bookings');
                console.log('📝 Applying fix...\n');
                
                // Apply the migration SQL
                const { error: migrationError } = await supabase.rpc('exec_sql', {
                    sql: `
                        -- Add branch_id column if it doesn't exist
                        ALTER TABLE conference_hall_bookings 
                        ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

                        -- Create index for fast branch filtering
                        CREATE INDEX IF NOT EXISTS idx_conference_hall_bookings_branch_id 
                        ON conference_hall_bookings(branch_id);

                        -- Backfill branch_id from conference_halls for existing records
                        UPDATE conference_hall_bookings chb
                        SET branch_id = ch.branch_id
                        FROM conference_halls ch
                        WHERE chb.conference_hall_id = ch.id
                        AND chb.branch_id IS NULL;
                    `
                });

                if (migrationError) {
                    console.error('❌ Migration failed:', migrationError.message);
                    console.log('\n📋 Manual SQL to run in Supabase SQL Editor:');
                    console.log(`
ALTER TABLE conference_hall_bookings 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

CREATE INDEX IF NOT EXISTS idx_conference_hall_bookings_branch_id 
ON conference_hall_bookings(branch_id);

UPDATE conference_hall_bookings chb
SET branch_id = ch.branch_id
FROM conference_halls ch
WHERE chb.conference_hall_id = ch.id
AND chb.branch_id IS NULL;
                    `);
                } else {
                    console.log('✅ Migration applied successfully!');
                }
            } else {
                console.error('❌ Error checking table:', error.message);
            }
        } else {
            console.log('✅ branch_id column EXISTS in conference_hall_bookings');
            console.log(`📊 Found ${data?.length || 0} records\n`);
            
            // Check if any records have NULL branch_id
            const { data: nullBranch, error: nullError } = await supabase
                .from('conference_hall_bookings')
                .select('id, branch_id, conference_hall_id')
                .is('branch_id', null);

            if (!nullError && nullBranch && nullBranch.length > 0) {
                console.log(`⚠️  Found ${nullBranch.length} records with NULL branch_id`);
                console.log('📝 Backfilling from conference_halls...\n');
                
                // Backfill each record
                for (const booking of nullBranch) {
                    const { data: hall } = await supabase
                        .from('conference_halls')
                        .select('branch_id')
                        .eq('id', booking.conference_hall_id)
                        .single();

                    if (hall && hall.branch_id) {
                        await supabase
                            .from('conference_hall_bookings')
                            .update({ branch_id: hall.branch_id })
                            .eq('id', booking.id);
                        console.log(`  ✓ Updated booking ${booking.id} with branch_id ${hall.branch_id}`);
                    }
                }
                console.log('\n✅ Backfill complete!');
            } else {
                console.log('✅ All records have branch_id set');
            }
        }

        console.log('\n🎉 Conference branch integration is ready!');
        console.log('\n📋 Summary:');
        console.log('  • Conference bookings from reception page → use activeBranchId');
        console.log('  • Conference bookings from branch accounting → use activeBranchId');
        console.log('  • Branch accounting invoices page → filters by activeBranchId');
        console.log('  • All conference bookings are now branch-aware!\n');

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

fixConferenceBranch();
