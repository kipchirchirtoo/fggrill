import { pool } from './src/db';
async function run() {
  const tables = ['cashier_shifts', 'cashier_shift_logs', 'cashier_transactions', 'cashier_shift_transactions', 'payments', 'payment_tenders', 'payment_allocations', 'payment_receipts', 'customer_invoices', 'customer_account_ledger', 'cashier_entry_reversals'];
  for (const table of tables) {
    const res = await pool.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ', [table]);
    console.log(\nTable: );
    if (res.rows.length === 0) {
      console.log('  (Table does not exist or has no columns)');
    } else {
      res.rows.forEach(r => console.log(  : ));
    }
  }
  process.exit(0);
}
run();
