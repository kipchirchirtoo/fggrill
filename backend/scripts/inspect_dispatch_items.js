
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('--- Inspecting Dispatch Items ---');

    const { data: items, error } = await supabase
        .from('dispatch_items')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching dispatch items:', error);
        return;
    }

    if (items && items.length > 0) {
        console.log('Sample dispatch item:', items[0]);
    } else {
        console.log('No dispatch items found.');
    }
}

main();
