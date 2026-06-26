const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env', 'utf-8');
const getEnv = (key) => {
    const line = env.split('\n').find(l => l.startsWith(key + '='));
    return line ? line.split('=')[1].trim() : '';
};

const url = getEnv('SUPABASE_PROJECT_URL') || getEnv('SUPABASE_URL');
const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(url, serviceKey);

async function run() {
    const { data, error } = await supabase
        .from('stock_counts')
        .select('*')
        .limit(1);
    if (error) {
        console.error('Error selecting stock_counts:', error);
    } else {
        console.log('Sample stock_counts row keys:', data.length > 0 ? Object.keys(data[0]) : 'No rows found');
    }
}
run();
