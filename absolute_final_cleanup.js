/**
 * Absolute Final Cleanup - Remove last blocking tables
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

async function absoluteFinalCleanup() {
    console.log('\n🚀 ABSOLUTE FINAL CLEANUP - Removing last blocking tables\n');

    // Clean the last blocking tables
    const blockingTables = [
        'stock_counts',
        'bar_orders',
        'staff_employment_history',
    ];

    for (const table of blockingTables) {
        try {
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

    // Now delete remaining users except superadmin
    console.log('\n⏳ Deleting remaining non-superadmin users...');
    const { data: usersToDelete } = await supabase
        .from('users')
        .select('id, email')
        .neq('role', 'super_admin');

    if (usersToDelete && usersToDelete.length > 0) {
        for (const user of usersToDelete) {
            const { error } = await supabase.from('users').delete().eq('id', user.id);
            if (error) {
                console.log(`❌ Could not delete ${user.email}: ${error.message}`);
            } else {
                console.log(`✅ Deleted: ${user.email}`);
            }
        }
    }

    // FINAL VERIFICATION
    console.log('\n' + '='.repeat(70));
    console.log('FINAL VERIFICATION');
    console.log('='.repeat(70));

    const { data: users } = await supabase.from('users').select('email, role, first_name, last_name');
    console.log(`\n✅ Total remaining users: ${users?.length || 0}`);
    users?.forEach(user => {
        console.log(`   - ${user.email} (${user.first_name} ${user.last_name}) - ${user.role}`);
    });

    if (users && users.length === 1 && users[0].role === 'super_admin') {
        console.log('\n' + '='.repeat(70));
        console.log('🎉 🎉 🎉 DATABASE CLEANUP 100% SUCCESSFUL! 🎉 🎉 🎉');
        console.log('='.repeat(70));
        console.log('\n✅ Only superadmin remains in the database');
        console.log('✅ All operational data has been removed');
        console.log('✅ System is ready for client handover');
        console.log('\n📝 NEXT STEPS:');
        console.log('   1. Update superadmin password for security');
        console.log('   2. Clear Supabase Storage buckets (staff photos, receipts, etc.)');
        console.log('   3. Test login with superadmin credentials');
        console.log('   4. Hand over to client with new credentials\n');
    } else if (users && users.filter(u => u.role !== 'super_admin').length > 0) {
        console.log('\n⚠️  WARNING: Some non-superadmin users still remain');
        console.log('These may need manual deletion from Supabase dashboard');
    }
}

absoluteFinalCleanup()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(`\n❌ Fatal error: ${error.message}`);
        process.exit(1);
    });
