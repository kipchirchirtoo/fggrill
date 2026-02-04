const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://utsvlihpudfraxzcmtle.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const TABLES_TO_CHECK = [
    'payments', 'reservations', 'restaurant_orders', 'bar_orders', 'bookings',
    'receipts', 'rooms', 'housekeeping_tasks', 'users', 'maintenance_requests',
    'staff_attendance', 'payroll', 'simple_items', 'branch_stock', 'expenses',
    'stock_history', 'branch_stock_movements', 'audit_config_consumption',
    'inventory_items', 'stock_movements', 'suppliers', 'restaurant_order_items',
    'restaurant_menu_items', 'stock_requests', 'stock_request_items',
    'employee_credit_bills', 'staff_profiles', 'branches',
    'conference_hall_bookings', 'conference_halls', 'kitchen_ledger_entries',
    'kitchen_stock_ledger', 'kitchen_stock', 'store_supplier_invoices',
    'store_suppliers', 'store_grni_control_account', 'store_grn',
    'store_supplier_balances', 'stock_requisitions', 'stock_requisition_items'
];

async function checkSchema() {
    console.log("Checking tables existence...");
    for (const table of TABLES_TO_CHECK) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`Table ${table}: MISSING or Error - ${error.message}`);
        } else {
            console.log(`Table ${table}: FOUND`);
        }
    }
}

checkSchema();
