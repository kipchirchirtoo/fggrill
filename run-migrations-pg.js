const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration from backend/.env
const connectionString = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

// Migration files in order (only .sql files, excluding .txt and .bak)
const migrationFiles = [
  '01_create_users_table.sql',
  '02_create_room_tables.sql',
  '03_create_booking_tables.sql',
  '04_create_booking_procedures.sql',
  '05_create_guest_tables.sql',
  '06_create_staff_tables.sql',
  '07_create_housekeeping_tables.sql',
  '08_create_restaurant_tables.sql',
  '09_create_finance_tables.sql',
  '10_create_maintenance_tables.sql',
  '11a_storekeeping_core.sql',
  '11b_storekeeping_suppliers.sql',
  '11c_storekeeping_purchase.sql',
  '11d_storekeeping_stock_operations.sql',
  '11e_storekeeping_policies.sql',
  '11f_storekeeping_functions.sql',
  '12_restaurant_enhancements.sql',
  '13_restaurant_simple.sql',
  '14_maintenance_audit_accounting_enhancement.sql',
  '15_attendance_overtime_system.sql',
  '19_user_role_enhancements.sql',
  '20_supplier_vat_enhancements.sql',
  '20241128_0_pool_token_sales.sql',
  '20241128_add_guest_name_to_orders.sql',
  '20241128_enhanced_housekeeping.sql',
  '20241128_fix_security_issues.sql',
  '20241128_housekeeping_enhancements.sql',
  '20241128_housekeeping_fix.sql',
  '20241128_housekeeping_seed.sql',
  '20241128_seed_menu_items.sql',
  '20241129_multi_branch_implementation.sql',
  '20241202_create_reports_table.sql',
  '20241202_fix_user_deletion_cascade.sql',
  '20260110_fix_user_creation_trigger.sql',
  '20260114_add_kitchen_operations_role.sql',
  '20260114_kitchen_management.sql',
  '20260126_kitchen_management_clean.sql',
  '20260127_fix_storage_rls.sql',
  '20260127_kitchen_food_controls.sql',
  '20260128_add_national_id_to_staff.sql',
  '20260203_food_controls_enhancement.sql',
  '20260204_add_auditor_workflow.sql',
  '20260204_add_morning_count_type.sql',
  '20260204_cashier_logbook.sql',
  '20260204_create_hr_settings.sql',
  '20260204_enhance_attendance_payroll.sql',
  '20260204_enhance_staff_profiles.sql',
  '20260204_fix_branch_id_type.sql',
  '20260204_fix_cashier_logbook_branch_id.sql',
  '20260204_fix_hr_relationships.sql',
  '20260204_fix_missing_fks.sql',
  '20260204_fix_user_creation_trigger_v2.sql',
  '20260204_hr_phase2_enhancement.sql',
  '20260204_payroll_workflow_locking.sql',
  '20260204_update_payroll_view.sql',
  '20260205_add_branch_to_attendance.sql',
  '20260206_add_terminal_method.sql',
  '20260206_create_drivers_table.sql',
  '20260206_create_run_dynamic_query.sql',
  '20260207_add_audit_to_orders.sql',
  '20260207_add_reconciliation_columns.sql',
  '20260207_enhance_stock_counts_auditor.sql',
  '20260207_fix_auditor_fk.sql',
  '20260207_fix_bank_branch_id.sql',
  '20260207_fix_bar_module_fks.sql',
  '20260207_fix_stock_count_items_fk.sql',
  '20260208_add_total_deductions_to_payroll.sql',
  '20260208_create_auditor_watchlist.sql',
  '20260210_fix_orphaned_expense.sql',
  '20260210_staff_profiles_decouple.sql',
  '20260211_consolidated_fix.sql',
  '20260211_inventory_consolidation.sql',
  '20260212_fix_housekeeping_orphans.sql',
  '20260212_fix_housekeeping_relationships.sql',
  '20260213_add_shift_details.sql',
  '20260213_food_control_workflow.sql',
  '20260213_pending_bills_migration.sql',
  '21_grn_enhancements.sql',
  '22_grni_control_account.sql',
  '23_supplier_invoices.sql',
  '24_supplier_payments.sql',
  '25_supplier_ledger.sql',
  '25_unified_billing_system.sql',
  '26_food_control_integration.sql',
  '26_vat_control_accounts.sql',
  '27_fix_menu_items_preparation_time.sql',
  '27_procurement_audit_logs.sql',
  '28_grn_inventory_logic.sql',
  '28_kyogong_shift_pos_system.sql',
  '29_cashier_shift_logs.sql',
  '29_conference_daily_attendance_and_banking.sql',
  '29_supplier_invoice_integration.sql',
  '30_comprehensive_enhancements.sql',
  '30_fix_grn_status_enum.sql',
  '30_shift_revenue_breakdown.sql',
  '30_supplier_credit_notes.sql',
  '31_fix_grn_rpc.sql',
  '32_fix_generate_movement_number.sql',
  '33_fix_po_update_ambiguity.sql',
  '34_fix_ledger_triggers.sql'
];

async function runMigration(client, filename) {
  const filePath = path.join(__dirname, 'backend', 'supabase', 'migrations', filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${filename} - file not found`);
    return { success: false, skipped: true };
  }

  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    
    console.log(`\n🔄 Running migration: ${filename}`);
    
    // Execute the SQL
    await client.query(sql);
    
    console.log(`✅ Successfully ran: ${filename}`);
    return { success: true };
  } catch (error) {
    // Check if error is about already existing objects
    if (error.message.includes('already exists') || 
        error.message.includes('duplicate key') ||
        error.message.includes('relation') && error.message.includes('already exists')) {
      console.log(`⚠️  ${filename} - objects already exist (skipping)`);
      return { success: true, alreadyExists: true };
    }
    
    console.error(`❌ Error running ${filename}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runAllMigrations() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database\n');
    
    console.log('🚀 Starting migration process...\n');
    console.log(`📦 Total migrations to run: ${migrationFiles.length}\n`);
    
    const results = {
      successful: 0,
      failed: 0,
      skipped: 0,
      alreadyExists: 0,
      errors: []
    };

    for (const filename of migrationFiles) {
      const result = await runMigration(client, filename);
      
      if (result.skipped) {
        results.skipped++;
      } else if (result.alreadyExists) {
        results.alreadyExists++;
        results.successful++;
      } else if (result.success) {
        results.successful++;
      } else {
        results.failed++;
        results.errors.push({ filename, error: result.error });
      }
      
      // Small delay between migrations
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${results.successful}`);
    console.log(`⚠️  Already Exists: ${results.alreadyExists}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⏭️  Skipped (not found): ${results.skipped}`);
    console.log(`📦 Total: ${migrationFiles.length}`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      results.errors.forEach(({ filename, error }) => {
        console.log(`   ${filename}:`);
        console.log(`   ${error}\n`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (results.failed === 0) {
      console.log('🎉 All migrations completed successfully!');
    } else {
      console.log('⚠️  Some migrations failed. Please review the errors above.');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run migrations
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         DATABASE MIGRATION RUNNER                          ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

runAllMigrations().catch(console.error);
