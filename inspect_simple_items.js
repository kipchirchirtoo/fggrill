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
    const { data, error } = await supabase.from('simple_items').select('*').limit(200);
    if (error) { console.error(error); return; }

    console.log('Total items in simple_items:', data.length);
    data.forEach(item => {
        console.log(`[${item.category}] ${item.description} (${item.sku}) Status: ${item.is_active}`);
    });
}
inspect();
