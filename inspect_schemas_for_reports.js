const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('backend/.env')) {
    const envConfig = dotenv.parse(fs.readFileSync('backend/.env'));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log('--- simple_items ---');
    const { data: item } = await supabase.from('simple_items').select('*').limit(1).single();
    if (item) console.log(Object.keys(item));

    console.log('--- stock_history ---');
    const { data: history } = await supabase.from('stock_history').select('*').limit(1).single();
    if (history) console.log(Object.keys(history));

    console.log('--- branch_stock (if any) ---');
    const { data: branchStock } = await supabase.from('branch_stock').select('*').limit(1).single();
    if (branchStock) console.log(Object.keys(branchStock));
}
inspect();
