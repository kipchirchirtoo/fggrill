/**
 * Final Cleanup - Remove all blocking dependencies
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function finalCleanup() {
    console.log('\n🚀 FINAL CLEANUP - Removing all blocking dependencies\n');

    // Step 1: Delete all data from tables with UUID primary keys using proper filtering
    const uuidTables = [
        'restaurant_pool_token_sales',
        'folios',
        'reservations',
        'branch_inventory',
    ];

    for (const table of uuidTables) {
        try {
            // Use a different approach - select all and delete
            const { data } = await supabase.from(table).select('id');
            if (data && data.length > 0) {
                for (const row of data) {
                    await supabase.from(table).delete().eq('id', row.id);
                }
                console.log(`✅ Cleaned: ${table} (${data.length} records)`);
            } else {
                console.log(`✅ ${table} already empty`);
            }
        } catch (error) {
            console.log(`⚠️  Skipped: ${table} (${error.message})`);
        }
    }

    // Step 2: Clean inventory_items after branch_inventory is gone
    try {
        const { data } = await supabase.from('inventory_items').select('sku');
        if (data && data.length > 0) {
            for (const row of data) {
                await supabase.from('inventory_items').delete().eq('sku', row.sku);
            }
            console.log(`✅ Cleaned: inventory_items (${data.length} records)`);
        }
    } catch (error) {
        console.log(`⚠️  Could not clean inventory_items: ${error.message}`);
    }

    // Step 3: Now delete all users except superadmin
    console.log('\n⏳ Removing all users except superadmin...');
    try {
        const { data: usersToDelete } = await supabase
            .from('users')
            .select('id')
            .neq('role', 'super_admin');

        if (usersToDelete && usersToDelete.length > 0) {
            for (const user of usersToDelete) {
                const { error } = await supabase
                    .from('users')
                    .delete()
                    .eq('id', user.id);

                if (error) {
                    console.log(`⚠️  Could not delete user ${user.id}: ${error.message}`);
                }
            }
            console.log(`✅ Deleted ${usersToDelete.length} non-superadmin users`);
        }
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
    }

    // Final verification
    console.log('\n' + '='.repeat(60));
    console.log('FINAL VERIFICATION');
    console.log('='.repeat(60));

    const { data: users } = await supabase.from('users').select('email, role, first_name, last_name');
    console.log(`\n✅ Remaining users: ${users?.length || 0}`);
    users?.forEach(user => {
        console.log(`   - ${user.email} (${user.first_name} ${user.last_name}) - ${user.role}`);
    });

    if (users && users.length === 1 && users[0].role === 'super_admin') {
        console.log('\n' + '='.repeat(60));
        console.log('✅ ✅ ✅ DATABASE CLEANUP SUCCESSFUL! ✅ ✅ ✅');
        console.log('='.repeat(60));
        console.log('\n📝 Next steps:');
        console.log('   1. Update superadmin password');
        console.log('   2. Clear Supabase Storage buckets');
        console.log('   3. Test login with superadmin credentials');
        console.log('   4. System is ready for client handover!\n');
    } else {
        console.log('\n⚠️  Warning: More than just superadmin remains');
        console.log('You may need to manually review and clean remaining users');
    }
}

finalCleanup()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(`\n❌ Fatal error: ${error.message}`);
        process.exit(1);
    });
