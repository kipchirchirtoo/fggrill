#!/usr/bin/env node
/**
 * COMPREHENSIVE DATABASE AUDIT — Branch 2 (Bomet Town)
 * Checks ALL tables across all modules.
 */

const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
const BRANCH_ID = 2;

async function query(text, params = []) {
  const client = await pool.connect();
  try { return (await client.query(text, params)).rows; }
  finally { client.release(); }
}

async function getCount(table, where = '', params = []) {
  try {
    const rows = await query(`SELECT COUNT(*)::int AS cnt FROM ${table} ${where}`, params);
    return rows[0]?.cnt || 0;
  } catch (e) { return `ERROR: ${e.message}`; }
}

async function getSample(table, where = '', params = [], limit = 3) {
  try {
    return await query(`SELECT * FROM ${table} ${where} ORDER BY created_at DESC LIMIT ${limit}`, params);
  } catch (e) { return []; }
}

function printSample(label, rows) {
  if (!rows || !rows.length) return;
  console.log(`   Sample (${rows.length} shown):`);
  rows.forEach((r, i) => {
    const kv = Object.entries(r).slice(0, 6).map(([k,v]) => `${k}=${JSON.stringify(v)?.substring(0,50)}`).join(', ');
    console.log(`   [${i+1}] ${kv}`);
  });
}

async function auditTable(label, table, branchCol = 'branch_id', extraWhere = '') {
  const where = branchCol ? `WHERE ${branchCol} = $1 ${extraWhere}` : extraWhere ? `WHERE ${extraWhere}` : '';
  const params = branchCol ? [BRANCH_ID] : [];
  const cnt = await getCount(table, where, params);
  console.log(`\n📊 ${label}: ${cnt} row(s)  [table: ${table}]`);
  if (cnt > 0 && typeof cnt === 'number') {
    const sample = await getSample(table, where, params, 2);
    printSample(label, sample);
  }
}

async function run() {
  console.log('='.repeat(90));
  console.log('COMPREHENSIVE DATABASE AUDIT — ALL TABLES — Branch 2 (Bomet Town)');
  console.log('Database: NEW (rvoaowhxyweswwuxbrzm)');
  console.log('='.repeat(90));

  // Verify branch
  const branch = await query('SELECT id, name, location FROM branches WHERE id = $1', [BRANCH_ID]);
  console.log(`\n✓ Branch: ${branch[0]?.name} (${branch[0]?.location}) — ID: ${BRANCH_ID}`);

  // ============================================================
  // CORE / SHARED TABLES
  // ============================================================
  console.log('\n' + '='.repeat(90));
  console.log('SECTION A: CORE / SHARED TABLES');
  console.log('='.repeat(90));

  await auditTable('Users (all roles)', 'users');
  await auditTable('Branches', 'branches', null, '');
  await auditTable('Auth Logs', 'auth_logs');
  await auditTable('Feature Flags', 'feature_flags', null, '');
  await auditTable('System Config Values', 'system_config_values', null, '');
  await auditTable('Announcements', 'announcements', null, '');
  await auditTable('Impersonation Sessions', 'impersonation_sessions', null, '');

  // ============================================================
  // POS & CASHIER
  // ============================================================
  console.log('\n' + '='.repeat(90));
  console.log('SECTION B: POS & CASHIER');
  console.log('='.repeat(90));

  await auditTable('POS Outlets', 'pos_outlets');
  await auditTable('POS Outlet Items', 'pos_outlet_items');
  await auditTable('POS Outlet Assignments', 'pos_outlet_assignments');
  await auditTable('POS Outlet Shifts', 'pos_outlet_shifts');
  await auditTable('POS Shift Orders', 'pos_shift_orders');
  await auditTable('POS Shift Order Items', 'pos_shift_order_items');
  await auditTable('POS Shift Payments', 'pos_shift_payments');
  await auditTable('POS Shift Stock Counts', 'pos_shift_stock_counts');
  await auditTable('POS Void Requests', 'pos_void_requests');
  await auditTable('POS Inventory Mappings', 'pos_inventory_mappings');

  // ============================================================
  // RESTAURANT & ORDERS
  // ============================================================
  console.log('\n' + '='.repeat(90));
  console.log('SECTION C: RESTAURANT & ORDERS');
  console.log('='.repeat(90));

  await auditTable('Restaurant Orders', 'restaurant_orders');
  await auditTable('Restaurant Order Items', 'restaurant_order_items');
  await auditTable('Restaurant Tables', 'restaurant_tables');
  await auditTable('Menu Categories', 'menu_categories');
  await auditTable('Menu Items', 'menu_items');
  await auditTable('Menu Item Options', 'menu_item_options');
  await auditTable('Food Combos', 'food_combos');
  await auditTable('Combo Items', 'combo_items');
  await auditTable('Waiter Assignments', 'waiter_assignments');
  await auditTable('Table Reservations', 'table_reservations');

  // ============================================================
  // BAR
  // ============================================================
  console.log('\n' + '='.repeat(90));
  console.log('SECTION D: BAR');
  console.log('='.repeat(90));

  await auditTable('Bar Categories', 'bar_categories');
  await auditTable('Bar Items', 'bar_items');
  await auditTable('Bar Orders', 'bar_orders');
  await auditTable('Bar Order Items', 'bar_order_items');
  await auditTable('Bar Stock', 'bar_stock');
  await auditTable('Bar Stock Movements', 'bar_stock_movements');
  await auditTable('Bar Wastage', 'bar_wastage');

  // ============================================================
  // INVENTORY / STOCK
  // ============================================================
  console.log('\n' + '='.repeat(90));
  console.log('SECTION E: INVENTORY / STOCK');
  console.log('='.repeat(90));

  await auditTable('Simple Items (Stock)', 'simple_items');
  await auditTable('Stock Categories', 'stock_categories');
  await auditTable('Stock Requests', 'stock_requests');
  await auditTable('Stock Request Items', 'stock_request_items');
  await auditTable('Stock Dispatches', 'stock_dispatches');
  await auditTable('Stock Dispatch Items', 'stock_dispatch_items');
  await auditTable('Stock Receipts', 'stock_receipts');
  await auditTable('Stock Receipt Items', 'stock_receipt_items');
  await auditTable('Inventory Locations', 'inventory_locations');
  await auditTable('Inventory Item Catalog', 'inventory_item_catalog');
  await auditTable('Inventory Core Batches', 'inventory_core_batches');
  await auditTable('Inventory Movements', 'inventory_movements');
  await auditTable('Inventory Reservations', 'inventory_reservations');
  await auditTable('Inventory Balances', 'inventory_balances');
  await auditTable('Inventory Audit Logs', 'inventory_audit_logs');
  await auditTable('Inventory Alerts', 'inventory_alerts');
  await auditTable('SKU Order Sequences', 'sku_order_sequences');
  await auditTable('Dispatch Notes', 'dispatch_notes');
  await auditTable('Dispatch Note Items', 'dispatch_note_items');

  // ============================================================
  // KITCHEN
  // ============================================================
  console.log('\n' + '='.repeat(90));
  console.log('SECTION F: KITCHEN');
  console.log('='.repeat(90));

  await auditTable('Kitchen Shifts', 'kitchen_shifts');
  await auditTable('Kitchen Shift Items', 'kitchen_shift_items');
  await auditTable('Kitchen Shift Production', 'kitchen_shift_production');
  await auditTable('Kitchen Shift Stock Take', 'kitchen_shift_stock_take');
  await auditTable('Kitchen Shift Approvals', 'kitchen_shift_approvals');
  await auditTable('Kitchen Production Recipes', 'kitchen_production_recipes');
  await auditTable('Kitchen Store Receipts', 'kitchen_store_receipts');
  await auditTable('Kitchen Store Receipt Items', 'kitchen_store_receipt_items');
  await auditTable('Kitchen Expected Portions', 'kitchen_expected_portions');
  await auditTable('Kitchen Portion Tracking', 'kitchen_portion_tracking');
  await auditTable('Kitchen Daily Variance', 'kitchen_daily_variance');
  await auditTable('Kitchen Portion Stock', 'kitchen_portion_stock');
  await auditTable('Kitchen Portion Ledger', 'kitchen_portion_ledger');
  await auditTable('Kitchen Variance Logs', 'kitchen_variance_logs');
  await auditTable('Wastage Records', 'wastage_records');

  // ============================================================
  // BOOKINGS & ROOMS
  // ============================================================
  console.log('\n' + '='.repeat(90));
  console.log('SECTION G: BOOKINGS & ROOMS');
  console.log('='.repeat(90));

  await auditTable('Rooms', 'rooms');
  await auditTable('Room Types', 'room_types');
  await auditTable('Bookings', 'bookings');
  await auditTable('Booking Payments', 'booking_payments');
  await auditTable('Guests', 'guests');
  await auditTable('Guest Stays', 'guest_stays');
  await auditTable('Housekeeping Tasks', 'housekeeping_tasks');
  await auditTable('Room Status Logs', 'room_status_logs');

  // ============================================================
  // FINANCE / ACCOUNTANT
  // ============================================================
  console.log('\n' + '='.repeat(90));
  console.log('SECTION H: FINANCE / ACCOUNTANT');
  console.log('='.repeat(90));

  await auditTable('Daily Financial Records', 'daily_financial_records');
  await auditTable('Monthly Financial Adjustments', 'monthly_financial_adjustments');
  await auditTable('Branch Payment Receipts', 'branch_payment_receipts');
  await auditTable('Revenue Sources', 'revenue_sources');
  await auditTable('Revenue Entries', 'revenue_entries');
  await auditTable('Expenses', 'expenses');
  await auditTable('Payments (General)', 'payments');
  await auditTable('Payment Methods', 'payment_methods');
  await auditTable('Supplier Payments', 'supplier_payments');
  await auditTable('GRN (Goods Receipt Notes)', 'grns');
  await auditTable('GRN Items', 'grn_items');
  await auditTable('Purchase Orders', 'purchase_orders');
  await auditTable('Purchase Order Items', 'purchase_order_items');
  await auditTable('Petty Cash', 'petty_cash');
  await auditTable('Petty Cash Transactions', 'petty_cash_transactions');
  await auditTable('Bank Accounts', 'bank_accounts');
  await auditTable('Bank Transactions', 'bank_transactions');
  await auditTable('Credit Bills', 'credit_bills');
  await auditTable('Credit Bill Payments', 'credit_bill_payments');
  await auditTable('Invoices', 'invoices');
  await auditTable('Invoice Items', 'invoice_items');
  await auditTable('Staff Loans', 'staff_loans');
  await auditTable('Staff Loan Payments', 'staff_loan_payments');
  await auditTable('Payroll Records', 'payroll_records');
  await auditTable('Payroll Entries', 'payroll_entries');
  await auditTable('Expense Claims', 'expense_claims');
  await auditTable('Department Accounts', 'department_accounts');
  await auditTable('Unpaid Bills', 'unpaid_bills');

  // ============================================================
  // STAFF / HR
  // ============================================================
  console.log('\n' + '='.repeat(90));
  console.log('SECTION I: STAFF / HR');
  console.log('='.repeat(90));

  await auditTable('Staff Profiles', 'staff_profiles');
  await auditTable('Staff Attendance', 'staff_attendance');
  await auditTable('Staff Schedules', 'staff_schedules');
  await auditTable('Staff Terminals', 'staff_terminals');
  await auditTable('Staff RFID Tags', 'staff_rfid_tags');
  await auditTable('Leave Requests', 'leave_requests');
  await auditTable('Performance Reviews', 'performance_reviews');
  await auditTable('Shift Swaps', 'shift_swaps');
  await auditTable('Overtime Records', 'overtime_records');

  // ============================================================
  // MAINTENANCE
  // ============================================================
  console.log('\n' + '='.repeat(90));
  console.log('SECTION J: MAINTENANCE');
  console.log('='.repeat(90));

  await auditTable('Maintenance Requests', 'maintenance_requests');
  await auditTable('Maintenance Tasks', 'maintenance_tasks');
  await auditTable('Assets', 'assets');
  await auditTable('Asset Categories', 'asset_categories');

  // ============================================================
  // REPORTS & AUDIT
  // ============================================================
  console.log('\n' + '='.repeat(90));
  console.log('SECTION K: REPORTS & AUDIT');
  console.log('='.repeat(90));

  await auditTable('Report Jobs', 'report_jobs');
  await auditTable('Superadmin Audit Log', 'superadmin_audit_log');
  await auditTable('System Config History', 'system_config_history');
  await auditTable('Inventory Governance Reviews', 'inventory_governance_reviews');
  await auditTable('Inventory Governance Rules', 'inventory_governance_rules');

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(90));
  console.log('END OF AUDIT');
  console.log('='.repeat(90));

  await pool.end();
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
