const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

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

async function checkTables() {
    console.log('Checking tables existence and row counts...');

    for (const table of TABLES_TO_CHECK) {
        try {
            const res = await pool.query(`SELECT to_regclass('public.${table}')`);
            if (res.rows[0].to_regclass) {
                const count = await pool.query(`SELECT COUNT(*) FROM ${table}`);
                console.log(`✅ Table '${table}' exists. Rows: ${count.rows[0].count}`);
            } else {
                console.log(`❌ Table '${table}' DOES NOT EXIST.`);
            }
        } catch (err) {
            console.error(`Error checking table '${table}':`, err.message);
        }
    }

    process.exit(0);
}

checkTables();
