require('dotenv').config({ path: './backend/.env' });
const { Client } = require('pg');
const path = require('path');

const cleanupSQL = `
-- =====================================================
-- FAMOUSGATE DATABASE CLEANUP - FINAL VERSION
-- =====================================================
-- Purpose: Remove test/transactional data
-- Keep: Users, branches, staff, departments, menu, vehicles, inventory structure
-- =====================================================

BEGIN; -- Start transaction (can rollback if needed)

-- =====================================================
-- STEP 1: DELETE CHILD RECORDS FIRST (avoid FK violations)
-- =====================================================

-- 1.1 Delete restaurant order items (child of orders)
DELETE FROM restaurant_order_items;
SELECT 'Deleted restaurant_order_items: ' || (SELECT COUNT(*) FROM restaurant_order_items) || ' remaining';

-- 1.2 Delete stock request items (child of stock requests)
DELETE FROM stock_request_items;
SELECT 'Deleted stock_request_items: ' || (SELECT COUNT(*) FROM stock_request_items) || ' remaining';

-- =====================================================
-- STEP 2: DELETE PARENT TRANSACTIONAL RECORDS
-- =====================================================

-- 2.1 Delete payroll records
DELETE FROM payroll_records;
SELECT 'Deleted payroll_records: ' || (SELECT COUNT(*) FROM payroll_records) || ' remaining';

-- 2.2 Delete auth logs
DELETE FROM auth_logs;
SELECT 'Deleted auth_logs: ' || (SELECT COUNT(*) FROM auth_logs) || ' remaining';

-- 2.3 Delete notifications
DELETE FROM notifications;
SELECT 'Deleted notifications: ' || (SELECT COUNT(*) FROM notifications) || ' remaining';

-- 2.4 Delete stock requests
DELETE FROM stock_requests;
SELECT 'Deleted stock_requests: ' || (SELECT COUNT(*) FROM stock_requests) || ' remaining';

-- 2.5 Delete restaurant orders
DELETE FROM restaurant_orders;
SELECT 'Deleted restaurant_orders: ' || (SELECT COUNT(*) FROM restaurant_orders) || ' remaining';

-- 2.6 Delete payments
DELETE FROM payments;
SELECT 'Deleted payments: ' || (SELECT COUNT(*) FROM payments) || ' remaining';

-- 2.7 Delete staff loans
DELETE FROM staff_loans;
SELECT 'Deleted staff_loans: ' || (SELECT COUNT(*) FROM staff_loans) || ' remaining';

-- 2.8 Delete staff advances
DELETE FROM staff_advances;
SELECT 'Deleted staff_advances: ' || (SELECT COUNT(*) FROM staff_advances) || ' remaining';

-- 2.9 Delete approval requests
DELETE FROM approval_requests;
SELECT 'Deleted approval_requests: ' || (SELECT COUNT(*) FROM approval_requests) || ' remaining';

-- 2.10 Delete daily financial records
DELETE FROM daily_financial_records;
SELECT 'Deleted daily_financial_records: ' || (SELECT COUNT(*) FROM daily_financial_records) || ' remaining';

-- 2.11 Delete guests
DELETE FROM guests;
SELECT 'Deleted guests: ' || (SELECT COUNT(*) FROM guests) || ' remaining';

-- 2.12 Delete rooms (test data)
DELETE FROM rooms;
SELECT 'Deleted rooms: ' || (SELECT COUNT(*) FROM rooms) || ' remaining';

-- =====================================================
-- STEP 3: DELETE CREDIT BILLS (if any exist)
-- =====================================================

DELETE FROM credit_bill_items WHERE 1=1;
DELETE FROM credit_bills WHERE 1=1;
SELECT 'Deleted credit_bills: ' || (SELECT COUNT(*) FROM credit_bills) || ' remaining';

-- =====================================================
-- STEP 4: DELETE INVOICES (if any exist)
-- =====================================================

DELETE FROM invoice_items WHERE 1=1;
DELETE FROM invoices WHERE 1=1;
SELECT 'Deleted invoices: ' || (SELECT COUNT(*) FROM invoices) || ' remaining';

-- =====================================================
-- STEP 5: DELETE PURCHASE ORDERS (if any exist)
-- =====================================================

DELETE FROM purchase_order_items WHERE 1=1;
DELETE FROM purchase_orders WHERE 1=1;
SELECT 'Deleted purchase_orders: ' || (SELECT COUNT(*) FROM purchase_orders) || ' remaining';

-- =====================================================
-- STEP 6: DELETE OTHER TRANSACTIONAL TABLES
-- =====================================================

DELETE FROM bookings WHERE 1=1;
DELETE FROM bar_orders WHERE 1=1;
DELETE FROM bar_order_items WHERE 1=1;
DELETE FROM kitchen_orders WHERE 1=1;
DELETE FROM kitchen_order_items WHERE 1=1;
DELETE FROM kitchen_usage_logs WHERE 1=1;
DELETE FROM stock_dispatches WHERE 1=1;
DELETE FROM stock_dispatch_items WHERE 1=1;
DELETE FROM stock_transfers WHERE 1=1;
DELETE FROM stock_transfer_items WHERE 1=1;
DELETE FROM attendance_records WHERE 1=1;
DELETE FROM leave_requests WHERE 1=1;
DELETE FROM overtime_records WHERE 1=1;
DELETE FROM maintenance_requests WHERE 1=1;
DELETE FROM housekeeping_tasks WHERE 1=1;
DELETE FROM business_communications WHERE 1=1;
DELETE FROM communication_messages WHERE 1=1;
DELETE FROM expense_records WHERE 1=1;
DELETE FROM revenue_records WHERE 1=1;
DELETE FROM audit_logs WHERE 1=1;
DELETE FROM security_events WHERE 1=1;
DELETE FROM restaurant_bills WHERE 1=1;
DELETE FROM restaurant_bill_items WHERE 1=1;

SELECT 'Deleted all other transactional tables';

-- =====================================================
-- STEP 7: VERIFICATION - CHECK WHAT REMAINS
-- =====================================================

SELECT '
=====================================================
CLEANUP VERIFICATION - WHAT REMAINS
=====================================================
' as status;

SELECT 'MASTER DATA (KEPT)' as category, '' as table_name, '' as count
UNION ALL
SELECT '', 'users', COUNT(*)::text FROM users
UNION ALL
SELECT '', 'branches', COUNT(*)::text FROM branches
UNION ALL
SELECT '', 'staff_profiles', COUNT(*)::text FROM staff_profiles
UNION ALL
SELECT '', 'departments', COUNT(*)::text FROM departments
UNION ALL
SELECT '', 'room_types', COUNT(*)::text FROM room_types
UNION ALL
SELECT '', 'restaurant_menu_items', COUNT(*)::text FROM restaurant_menu_items
UNION ALL
SELECT '', 'restaurant_menu_categories', COUNT(*)::text FROM restaurant_menu_categories
UNION ALL
SELECT '', 'vehicles', COUNT(*)::text FROM vehicles
UNION ALL
SELECT '', 'maintenance_spare_parts', COUNT(*)::text FROM maintenance_spare_parts
UNION ALL
SELECT '', 'kenyan_public_holidays', COUNT(*)::text FROM kenyan_public_holidays
UNION ALL
SELECT '', '', ''
UNION ALL
SELECT 'TRANSACTIONAL DATA (DELETED)', '', ''
UNION ALL
SELECT '', 'payroll_records', COUNT(*)::text FROM payroll_records
UNION ALL
SELECT '', 'auth_logs', COUNT(*)::text FROM auth_logs
UNION ALL
SELECT '', 'notifications', COUNT(*)::text FROM notifications
UNION ALL
SELECT '', 'stock_requests', COUNT(*)::text FROM stock_requests
UNION ALL
SELECT '', 'stock_request_items', COUNT(*)::text FROM stock_request_items
UNION ALL
SELECT '', 'restaurant_orders', COUNT(*)::text FROM restaurant_orders
UNION ALL
SELECT '', 'restaurant_order_items', COUNT(*)::text FROM restaurant_order_items
UNION ALL
SELECT '', 'payments', COUNT(*)::text FROM payments
UNION ALL
SELECT '', 'guests', COUNT(*)::text FROM guests
UNION ALL
SELECT '', 'rooms', COUNT(*)::text FROM rooms
UNION ALL
SELECT '', 'staff_loans', COUNT(*)::text FROM staff_loans
UNION ALL
SELECT '', 'staff_advances', COUNT(*)::text FROM staff_advances
UNION ALL
SELECT '', 'approval_requests', COUNT(*)::text FROM approval_requests
UNION ALL
SELECT '', 'daily_financial_records', COUNT(*)::text FROM daily_financial_records
UNION ALL
SELECT '', 'credit_bills', COUNT(*)::text FROM credit_bills
UNION ALL
SELECT '', 'invoices', COUNT(*)::text FROM invoices
UNION ALL
SELECT '', 'purchase_orders', COUNT(*)::text FROM purchase_orders;

COMMIT;
`;

async function tableExists(client, tableName) {
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
      );
    `, [tableName]);
    return result.rows[0].exists;
  } catch (e) {
    return false;
  }
}

async function executeCleanup() {
  console.log('🚀 EXECUTING FINAL CLEANUP PLAN\n');
  console.log('='.repeat(80));
  
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Start transaction
    await client.query('BEGIN');
    console.log('✅ Transaction started\n');
    
    // Split SQL into individual statements
    const statements = cleanupSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Executing ${statements.length} SQL statements...\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;
      
      try {
        // Check if DELETE statement references a table that exists
        if (stmt.toUpperCase().startsWith('DELETE FROM')) {
          const match = stmt.match(/DELETE FROM (\w+)/i);
          if (match) {
            const tableName = match[1];
            if (!(await tableExists(client, tableName))) {
              console.log(`  ⏭️  Skipped ${tableName} (table doesn't exist)`);
              continue;
            }
          }
        }
        
        // Check if SELECT statement references non-existent tables
        if (stmt.toUpperCase().startsWith('SELECT')) {
          const fromMatches = stmt.match(/FROM (\w+)/gi);
          if (fromMatches) {
            let skip = false;
            for (const match of fromMatches) {
              const tableName = match.replace(/FROM /i, '').trim();
              if (!(await tableExists(client, tableName))) {
                console.log(`  ⏭️  Skipped SELECT (table ${tableName} doesn't exist)`);
                skip = true;
                break;
              }
            }
            if (skip) continue;
          }
        }
        
        const result = await client.query(stmt);
        
        // Print SELECT results
        if (stmt.toUpperCase().startsWith('SELECT') && result.rows.length > 0) {
          const row = result.rows[0];
          const key = Object.keys(row)[0];
          console.log(`  ${row[key]}`);
        }
      } catch (stmtError) {
        // Skip if table doesn't exist
        if (stmtError.message.includes('does not exist')) {
          const match = stmt.match(/FROM (\w+)/i);
          if (match) {
            console.log(`  ⏭️  Skipped ${match[1]} (table doesn't exist)`);
            continue;
          }
        }
        console.error(`\n❌ Error in statement ${i + 1}: ${stmt.substring(0, 100)}...`);
        console.error(`   ${stmtError.message}`);
        throw stmtError;
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('\n✅ Transaction committed');
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ CLEANUP COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    console.error('Attempting rollback...');
    try {
      await client.query('ROLLBACK');
      console.log('✅ Rollback successful - no changes made');
    } catch (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError.message);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

executeCleanup();
