
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const tables = [
    'accounting_ar_invoices',
    'accounting_ap_bills',
    'accounting_journal_entries',
    'accounting_bank_transactions'
  ];

  for (const table of tables) {
    console.log(`\n--- Checking table: ${table} ---`);
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.error(`Error checking ${table}:`, error.message);
      continue;
    }

    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]).join(', '));
    } else {
      console.log('Table is empty. Checking via RPC if available or assuming it exists.');
      // Try to get a sample even if empty? Not easy in JS-SDK without rows.
    }
  }
}

checkSchema().catch(console.error);
