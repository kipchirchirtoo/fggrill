
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Fixing incorrectly categorized Bar items...');

    // 1. Update STEAKS
    // It seems the name has "[BAR]" in it, which is weird. Maybe it was auto-generated or manually added incorrectly.
    // We should rename it to "STEAKS" and set is_bar = false.

    const { error } = await supabase
        .from('restaurant_menu_categories')
        .update({
            is_bar: false,
            name: 'STEAKS' // Removing [BAR] suffix if it exists literally in the name
        })
        .ilike('name', '%STEAKS%') // Match anything with STEAKS
        .eq('is_bar', true);

    if (error) {
        console.error('Error updating STEAKS:', error);
    } else {
        console.log('Successfully removed STEAKS from Bar menu.');
    }

    // Double check
    const { data: check } = await supabase
        .from('restaurant_menu_categories')
        .select('name, is_bar')
        .ilike('name', '%STEAKS%');

    console.log('Current STEAKS stats:', check);
}

main();
