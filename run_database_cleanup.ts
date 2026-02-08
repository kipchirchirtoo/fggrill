/**
 * Database Cleanup Script for Client Handover
 * Removes all data except superadmin login credentials
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();
dotenv.config({ path: 'backend/.env' });

const SUPABASE_URL = process.env.SUPABASE_PROJECT_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ ERROR: Missing Supabase credentials!');
    console.error('Please set SUPABASE_PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
    process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function verifySuper admin() {
    console.log('\n🔍 Verifying superadmin user exists...');

    const { data, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, role')
        .eq('role', 'super_admin');

    if (error) {
        console.error(`❌ Error checking for superadmin: ${error.message}`);
        return false;
    }

    if (!data || data.length === 0) {
        console.error('❌ ERROR: No superadmin user found!');
        console.error('Cannot proceed with cleanup - you would be locked out!');
        return false;
    }

    console.log(`✅ Found ${data.length} superadmin user(s):`);
    data.forEach(user => {
        console.log(`   - ${user.email} (${user.first_name} ${user.last_name})`);
    });

    return true;
}

async function askConfirmation(question: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim() === 'DELETE ALL DATA');
        });
    });
}

async function deleteFromTable(tableName: string, description: string) {
    try {
        const { error } = await supabase
            .from(tableName)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) throw error;
        console.log(`✅ Cleaned: ${description}`);
    } catch (error: any) {
        console.log(`⚠️  Skipped: ${description} (${error.message})`);
    }
}

async function cleanupDatabase() {
    console.log('\n' + '='.repeat(60));
    console.log('DATABASE CLEANUP FOR CLIENT HANDOVER');
    console.log('='.repeat(60));
    console.log('\n⚠️  WARNING: This will DELETE ALL DATA except superadmin!');
    console.log('⚠️  This action is IRREVERSIBLE!');
    console.log('\n');

    // Verify superadmin exists
    if (!(await verifySuperadmin())) {
        return false;
    }

    // Final confirmation
    console.log('\n' + '='.repeat(60));
    const confirmed = await askConfirmation("Type 'DELETE ALL DATA' to confirm: ");

    if (!confirmed) {
        console.log('\n❌ Cleanup cancelled.');
        return false;
    }

    console.log('\n🚀 Starting database cleanup...\n');

    // Define tables to clean
    const tablesToClean = [
        // Financial & Accounting
        { table: 'finance_daily_log_lines', desc: 'Finance daily log lines' },
        { table: 'finance_daily_logs', desc: 'Finance daily logs' },
        { table: 'accounting_journal_entries', desc: 'Accounting journal entries' },
        { table: 'mpesa_transaction_logs', desc: 'M-Pesa transaction logs' },
        { table: 'payment_receipts', desc: 'Payment receipts' },
        { table: 'bills', desc: 'Bills' },
        { table: 'invoices', desc: 'Invoices' },

        // Staff Financial
        { table: 'staff_credit_bills', desc: 'Staff credit bills' },
        { table: 'staff_loan_payments', desc: 'Staff loan payments' },
        { table: 'staff_loans', desc: 'Staff loans' },
        { table: 'staff_advances', desc: 'Staff advances' },
        { table: 'staff_payroll', desc: 'Staff payroll' },

        // Kitchen
        { table: 'kitchen_variance_reasons', desc: 'Kitchen variance reasons' },
        { table: 'kitchen_portion_ledger', desc: 'Kitchen portion ledger' },
        { table: 'kitchen_portion_stock', desc: 'Kitchen portion stock' },
        { table: 'kitchen_food_controls', desc: 'Kitchen food controls' },
        { table: 'kitchen_daily_variance', desc: 'Kitchen daily variance' },
        { table: 'kitchen_wastage', desc: 'Kitchen wastage' },
        { table: 'kitchen_usage', desc: 'Kitchen usage' },
        { table: 'recipe_items', desc: 'Recipe items' },
        { table: 'recipes', desc: 'Recipes' },
        { table: 'kitchen_grn_items', desc: 'Kitchen GRN items' },
        { table: 'kitchen_grn', desc: 'Kitchen GRNs' },
        { table: 'kitchen_requisition_items', desc: 'Kitchen requisition items' },
        { table: 'kitchen_requisitions', desc: 'Kitchen requisitions' },
        { table: 'kitchen_stock_ledger', desc: 'Kitchen stock ledger' },
        { table: 'kitchen_stock', desc: 'Kitchen stock' },

        // POS & Orders
        { table: 'order_items', desc: 'Order items' },
        { table: 'orders', desc: 'Orders' },
        { table: 'pos_sessions', desc: 'POS sessions' },
        { table: 'pool_table_tokens', desc: 'Pool table tokens' },

        // Restaurant
        { table: 'restaurant_bills', desc: 'Restaurant bills' },
        { table: 'bar_stock_movements', desc: 'Bar stock movements' },
        { table: 'restaurant_inventory', desc: 'Restaurant inventory' },

        // Reservations
        { table: 'room_bookings', desc: 'Room bookings' },
        { table: 'reservations', desc: 'Reservations' },
        { table: 'guest_profiles', desc: 'Guest profiles' },

        // Housekeeping
        { table: 'housekeeping_tasks', desc: 'Housekeeping tasks' },
        { table: 'room_maintenance', desc: 'Room maintenance' },
        { table: 'laundry_records', desc: 'Laundry records' },

        // Inventory
        { table: 'stock_history', desc: 'Stock history' },
        { table: 'dispatch_items', desc: 'Dispatch items' },
        { table: 'dispatch_notes', desc: 'Dispatch notes' },
        { table: 'dispatch_returns', desc: 'Dispatch returns' },
        { table: 'dispatch_tracking', desc: 'Dispatch tracking' },
        { table: 'stock_request_items', desc: 'Stock request items' },
        { table: 'stock_requests', desc: 'Stock requests' },
        { table: 'stock_levels', desc: 'Stock levels' },
        { table: 'stock_take_items', desc: 'Stock take items' },
        { table: 'stock_takes', desc: 'Stock takes' },
        { table: 'stock_out_records', desc: 'Stock out records' },
        { table: 'simple_transfer_items', desc: 'Simple transfer items' },
        { table: 'simple_shop_items', desc: 'Simple shop items' },
        { table: 'branch_stock_movements', desc: 'Branch stock movements' },
        { table: 'inventory_items', desc: 'Inventory items' },
        { table: 'simple_items', desc: 'Simple items' },

        // Procurement
        { table: 'purchase_order_items', desc: 'Purchase order items' },
        { table: 'purchase_orders', desc: 'Purchase orders' },
        { table: 'grn_items', desc: 'GRN items' },
        { table: 'goods_received_notes', desc: 'Goods received notes' },
        { table: 'supplier_invoices', desc: 'Supplier invoices' },
        { table: 'supplier_payments', desc: 'Supplier payments' },
        { table: 'suppliers', desc: 'Suppliers' },

        // Maintenance
        { table: 'maintenance_requests', desc: 'Maintenance requests' },
        { table: 'maintenance_schedules', desc: 'Maintenance schedules' },
        { table: 'vehicle_maintenance', desc: 'Vehicle maintenance' },

        // Vehicles & Drivers
        { table: 'drivers', desc: 'Drivers' },
        { table: 'vehicles', desc: 'Vehicles' },

        // Staff
        { table: 'staff_attendance', desc: 'Staff attendance' },
        { table: 'staff_leave', desc: 'Staff leave' },
    ];

    // Clean all tables
    for (const { table, desc } of tablesToClean) {
        await deleteFromTable(table, desc);
    }

    // Delete staff profiles (except superadmin)
    console.log('\n⏳ Removing staff profiles (except superadmin)...');
    try {
        const { data: superadmins } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'super_admin');

        const superadminIds = superadmins?.map(u => u.id) || [];

        const { error } = await supabase
            .from('staff_profiles')
            .delete()
            .not('user_id', 'in', `(${superadminIds.map(id => `'${id}'`).join(',')})`);

        if (error) throw error;
        console.log('✅ Staff profiles cleaned');
    } catch (error: any) {
        console.log(`⚠️  Could not clean staff profiles: ${error.message}`);
    }

    // Delete users (except superadmin)
    console.log('\n⏳ Removing users (except superadmin)...');
    try {
        const { error } = await supabase
            .from('users')
            .delete()
            .neq('role', 'super_admin');

        if (error) throw error;
        console.log('✅ Users cleaned (superadmin preserved)');
    } catch (error: any) {
        console.error(`❌ Error cleaning users: ${error.message}`);
        return false;
    }

    // Reset sequences
    console.log('\n⏳ Resetting sequences...');
    try {
        await supabase.from('sku_categories').update({ current_serial: 0 }).neq('code', 'NONE');
        await supabase.from('order_sequences').delete().neq('sequence_type', 'NONE');
        await supabase.from('simple_sequences').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        console.log('✅ Sequences reset');
    } catch (error: any) {
        console.log(`⚠️  Could not reset sequences: ${error.message}`);
    }

    // Verification
    console.log('\n' + '='.repeat(60));
    console.log('VERIFICATION');
    console.log('='.repeat(60));

    try {
        const { data: users } = await supabase
            .from('users')
            .select('email, role');

        console.log(`\n✅ Remaining users: ${users?.length || 0}`);
        users?.forEach(user => {
            console.log(`   - ${user.email} (${user.role})`);
        });

        // Check some major tables
        const tablesToCheck = ['orders', 'bills', 'reservations', 'inventory_items', 'suppliers'];
        console.log('\n📊 Data counts:');

        for (const table of tablesToCheck) {
            try {
                const { count } = await supabase
                    .from(table)
                    .select('id', { count: 'exact', head: true });
                console.log(`   - ${table}: ${count || 0} records`);
            } catch {
                console.log(`   - ${table}: N/A`);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ DATABASE CLEANUP COMPLETED SUCCESSFULLY!');
        console.log('='.repeat(60));
        console.log('\n📝 Next steps:');
        console.log('   1. Update superadmin password');
        console.log('   2. Clear Supabase Storage buckets');
        console.log('   3. Test login with superadmin credentials');
        console.log('   4. Deliver to client');

        return true;
    } catch (error: any) {
        console.error(`\n❌ Error during verification: ${error.message}`);
        return false;
    }
}

// Run cleanup
cleanupDatabase()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error(`\n❌ Unexpected error: ${error.message}`);
        process.exit(1);
    });
