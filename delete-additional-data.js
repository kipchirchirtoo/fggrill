require('dotenv').config({ path: './backend/.env' });
const { Client } = require('pg');

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

async function deleteData() {
  console.log('🗑️ DELETING ADDITIONAL DATA\n');
  console.log('='.repeat(80));
  
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    await client.query('BEGIN');
    console.log('✅ Transaction started\n');
    
    // Tables to delete from (in dependency order - children first)
    const tablesToDelete = [
      // Stock count items (child of stock_counts)
      'stock_count_items',
      'stock_counts',
      
      // Store items (child tables first)
      'store_po_items',
      'store_grn_items',
      'store_grni_control_account', // Delete before store_grn (FK constraint)
      'store_grn',
      'store_purchase_orders', // Delete before store_suppliers (FK: supplier_id)
      'store_supplier_payments', // Delete before store_suppliers (FK constraint)
      'store_suppliers',
      'store_items',
      
      // Staff credit payments (child of staff_credit_bills)
      'staff_credit_bill_payments',
      'staff_credit_bills',
      'staff_attendance',
      'staff_payroll_adjustments',
      'staff_leave',
      
      // Kitchen requisition items (child of kitchen_requisitions)
      'kitchen_requisition_items',
      'kitchen_requisitions',
      'kitchen_usage_records',
      'kitchen_stock_ledger',
      'kitchen_stock',
      
      // Reports
      'reports',
      
      // Accounting tables (child tables first)
      'accounting_journal_lines',
      'accounting_journal_entries',
      'accounting_ar_invoices',
      'accounting_customers',
      'accounting_chart_of_accounts',
      'accounting_bank_transactions',
      'accounting_fiscal_periods',
      
      // Cashier tables (child tables first)
      'shift_transaction_items',
      'shift_transactions',
      'cashier_transactions',
      'cashier_shift_transactions',
      'cashier_shift_logs',
      'cashier_shifts',
      
      // Branch stock
      'branch_stock_movements',
      'branch_stock',
      
      // Simple items
      'simple_items',
    ];
    
    let deletedTotal = 0;
    
    for (const table of tablesToDelete) {
      try {
        // Get count before delete
        const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
        const count = parseInt(countResult.rows[0].count);
        
        if (count === 0) {
          console.log(`  ✓ ${table.padEnd(40)} 0 records (already empty)`);
          continue;
        }
        
        // Delete all records
        await client.query(`DELETE FROM ${table}`);
        
        console.log(`  ✅ ${table.padEnd(40)} ${count} records deleted`);
        deletedTotal += count;
      } catch (e) {
        console.log(`  ❌ ${table.padEnd(40)} Error: ${e.message}`);
      }
    }
    
    // Drop views (they regenerate from base tables)
    const viewsToDrop = [
      'v_inventory_alerts',
      'v_consumption_summary',
      'v_current_stock_levels',
      'v_daily_kitchen_usage',
      'v_daily_stock_out',
      'v_driver_performance',
      'v_expiring_items',
      'v_in_transit_summary',
      'v_kitchen_usage_details',
      'v_low_stock_alerts',
      'v_low_stock_by_branch',
      'v_pending_requests',
      'v_pending_transfers',
      'v_purchase_order_summary',
      'v_shop_inventory',
      'v_staff_accountability',
      'v_stock_count_variances',
      'v_supplier_performance',
      'v_transfer_status',
      'v_vehicle_utilization',
      'v_wastage_records',
      'vw_hk_daily_summary',
      'vw_hk_leaderboard',
      'vw_hk_room_status_overview',
      'vw_hk_staff_workload',
      'vw_hk_sustainability_summary',
      'vw_staff_accountability_report',
      'vw_variance_reason_summary',
      'v_inventory_valuation',
    ];
    
    console.log(`\nDropping views (will regenerate):\n`);
    
    for (const view of viewsToDrop) {
      try {
        await client.query(`DROP VIEW IF EXISTS ${view} CASCADE`);
        console.log(`  ✅ Dropped view: ${view}`);
      } catch (e) {
        // View might not exist
        console.log(`  ⏭️  Skipped ${view} (doesn't exist)`);
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n✅ Transaction committed`);
    console.log(`\n📊 Total records deleted: ${deletedTotal}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ CLEANUP COMPLETE!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await client.query('ROLLBACK');
    console.log('✅ Rollback successful');
    process.exit(1);
  } finally {
    await client.end();
  }
}

deleteData();
