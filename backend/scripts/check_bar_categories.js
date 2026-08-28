
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Checking categories marked as is_bar=true...');
    const { data, error } = await supabase
        .from('restaurant_menu_categories')
        .select('id, name, is_bar')
        .eq('is_bar', true);

    if (error) {
        console.error(error);
    } else {
        console.log('Bar Categories:');
        data.forEach(cat => console.log(`- ${cat.name} [ID: ${cat.id}]`));
    }
}

main();
