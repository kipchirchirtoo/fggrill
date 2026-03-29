
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL in .env');
  process.exit(1);
}

const client = new Client({
  connectionString: connectionString,
});

async function checkSchema() {
  await client.connect();
  const tables = [
    'accounting_ar_invoices',
    'accounting_ap_bills',
    'accounting_journal_entries',
    'accounting_bank_transactions',
    'accounting_bank_accounts',
    'accounting_customers',
    'accounting_vendors',
    'accounting_chart_of_accounts'
  ];

  for (const table of tables) {
    console.log(`\n--- Checking table: ${table} ---`);
    try {
      const res = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [table]);

      if (res.rows.length > 0) {
        console.log('Columns:', res.rows.map(r => r.column_name).join(', '));
      } else {
        console.log('Table not found or no columns returned.');
      }
    } catch (e) {
      console.error(`Error checking ${table}:`, e.message);
    }
  }
  await client.end();
}

checkSchema().catch(e => {
    console.error(e);
    process.exit(1);
});
