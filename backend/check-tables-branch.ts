import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const tables = [
    'audit_logs',
    'audit_trail',
    'financial_audit_logs',
    'inventory_audit_logs',
    'inventory_audit_log',
    'stock_take_audit_log',
    'dispatch_audit_log',
    'branch_payment_audit',
    'attendance_audit_logs',
    'shift_audit_log',
    'inventory_governance_reviews',
    'audit_exceptions',
    'approval_requests',
    'void_bills',
    'cashier_logbooks',
    'auditor_watchlist'
  ];

  console.log('Checking branch_id column for tables:');
  for (const table of tables) {
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: table }).select();
    // If RPC get_table_columns does not exist, let's do a select limit 1 and check keys
    const { data: rows, error: selectError } = await supabase.from(table).select('*').limit(1);
    if (selectError) {
      console.log(`Table ${table}: Error or not found: ${selectError.message}`);
    } else {
      const keys = rows && rows.length > 0 ? Object.keys(rows[0]) : [];
      const hasBranchId = keys.includes('branch_id');
      console.log(`Table ${table}: has branch_id? ${hasBranchId}. Columns: ${keys.join(', ')}`);
    }
  }
}
main();
