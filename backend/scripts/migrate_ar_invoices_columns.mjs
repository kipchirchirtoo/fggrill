/**
 * Migration: add missing columns to accounting_ar_invoices
 * Run from backend/ directory:
 *   node --env-file=.env scripts/migrate_ar_invoices_columns.mjs
 */
import pg from 'pg';
const { Client } = pg;

// Pooler (6543) is often blocked; prefer direct connection (5432)
const directUrl = process.env.DATABASE_URL?.replace('.pooler.supabase.com:6543', '.supabase.co:5432').replace('postgres.rvoaowhxyweswwuxbrzm', 'postgres');
const connStr = directUrl || process.env.DATABASE_URL;
console.log('Connecting to:', connStr?.replace(/:([^:@]+)@/, ':***@'));
const client = new Client({ connectionString: connStr });
await client.connect();

const migrations = [
  `ALTER TABLE accounting_ar_invoices ADD COLUMN IF NOT EXISTS reference      TEXT`,
  `ALTER TABLE accounting_ar_invoices ADD COLUMN IF NOT EXISTS notes          TEXT`,
  `ALTER TABLE accounting_ar_invoices ADD COLUMN IF NOT EXISTS items          JSONB DEFAULT '[]'::jsonb`,
  `ALTER TABLE accounting_ar_invoices ADD COLUMN IF NOT EXISTS type           TEXT`,
  // unique index to prevent duplicate invoices for the same booking source
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_ar_invoices_reference_branch
     ON accounting_ar_invoices (reference, branch_id)
     WHERE reference IS NOT NULL`,
];

for (const sql of migrations) {
  process.stdout.write(`  Running: ${sql.slice(0, 70)}... `);
  try {
    await client.query(sql);
    console.log('OK');
  } catch (err) {
    console.log('ERROR:', err.message);
  }
}

await client.end();
console.log('\nDone.');
