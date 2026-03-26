const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function repairMigrations() {
  const versions = [
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
    '30_comprehensive_enhancements_fixed.sql',
    '30_fix_grn_status_enum.sql',
    '30_shift_revenue_breakdown.sql',
    '30_supplier_credit_notes.sql',
    '31_fix_grn_rpc.sql',
    '31_fix_payments_rls_kyogong.sql',
    '32_fix_generate_movement_number.sql',
    '32_kyogong_cash_float_tracking.sql',
    '33_fix_po_update_ambiguity.sql',
    '34_fix_ledger_triggers.sql',
    '35_stock_take_audit_log.sql',
    '36_stock_take_submit_with_locking.sql',
    '37_stock_take_auto_verify.sql',
    '38_petty_cash_transactions.sql',
    '39_payments_verification_system.sql',
    '40_fix_dispatch_trigger_item_name.sql',
    '41_fix_generator_ambiguities.sql',
    '42_fix_supplier_payment_enums.sql',
    'fix_kyogong_bill_constraint.sql'
  ];
  
  try {
    for (const m of versions) {
      console.log(`Marking ${m} as applied...`);
      await pool.query('INSERT INTO public._migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [m]);
    }
    console.log('Successfully repaired migration history.');
  } catch (err) {
    console.error('Repair failed:', err);
  } finally {
    await pool.end();
  }
}

repairMigrations();
