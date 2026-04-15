const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSchema() {
    console.log('--- accounting_bank_accounts ---');
    const { data: accounts, error: err1 } = await supabase.from('accounting_bank_accounts').select('*').limit(1);
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    if (err1) console.error(err1);
    else if (accounts && accounts.length > 0) console.log(Object.keys(accounts[0]));
    else console.log('Empty table');

    console.log('--- accounting_bank_transactions ---');
    const { data: txns, error: err2 } = await supabase.from('accounting_bank_transactions').select('*').limit(1);
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    if (err2) console.error(err2);
    else if (txns && txns.length > 0) console.log(Object.keys(txns[0]));
    else console.log('Empty table');
}

debugSchema();
