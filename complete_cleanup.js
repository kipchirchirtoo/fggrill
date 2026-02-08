/**
 * Database Cleanup Script - FIXED VERSION
 * Handles foreign key constraints properly
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();
dotenv.config({ path: 'backend/.env' });

const SUPABASE_URL = process.env.SUPABASE_PROJECT_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ ERROR: Missing Supabase credentials!');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function cleanupDatabase() {
    console.log('\n' + '='.repeat(60));
    console.log('DATABASE CLEANUP - COMPLETING CLEANUP');
    console.log('='.repeat(60));

    console.log('\n🚀 Cleaning remaining tables with foreign key dependencies...\n');

    // Clean tables that were missed due to foreign keys
    const additionalTables = [
        'restaurant_pool_token_sales',
        'folios',
        'reservations',
        'stock_levels',
        'inventory_items',
        'suppliers',
    ];

    for (const table of additionalTables) {
        try {
            const { error } = await supabase.from(table).delete().gte('id', 0);
            if (error) throw error;
            console.log(`✅ Cleaned: ${table}`);
        } catch (error) {
            console.log(`⚠️  Skipped: ${table} (${error.message})`);
        }
    }

    // Now try to delete users again (except superadmin)
    console.log('\n⏳ Removing users (except superadmin)...');
    try {
        const { error } = await supabase
            .from('users')
            .delete()
            .neq('role', 'super_admin');

        if (error) throw error;
        console.log('✅ Users cleaned (superadmin preserved)');
    } catch (error) {
        console.error(`❌ Error cleaning users: ${error.message}`);
    }

    // Delete staff profiles
    console.log('\n⏳ Removing staff profiles (except superadmin)...');
    try {
        const { data: superadmins } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'super_admin');

        if (superadmins && superadmins.length > 0) {
            for (const admin of superadmins) {
                // Keep only superadmin profiles
                await supabase
                    .from('staff_profiles')
                    .delete()
                    .neq('user_id', admin.id);
            }
        }
        console.log('✅ Staff profiles cleaned');
    } catch (error) {
        console.log(`⚠️  Could not clean staff profiles: ${error.message}`);
    }

    // Final verification
    console.log('\n' + '='.repeat(60));
    console.log('FINAL VERIFICATION');
    console.log('='.repeat(60));

    const { data: users } = await supabase.from('users').select('email, role');
    console.log(`\n✅ Remaining users: ${users?.length || 0}`);
    users?.forEach(user => {
        console.log(`   - ${user.email} (${user.role})`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ DATABASE CLEANUP COMPLETED!');
    console.log('='.repeat(60));
    console.log('\n📝 Next steps:');
    console.log('   1. Update superadmin password');
    console.log('   2. Clear Supabase Storage buckets');
    console.log('   3. Test login');
    console.log('   4. Deliver to client\n');
}

cleanupDatabase()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(`\n❌ Error: ${error.message}`);
        process.exit(1);
    });
