const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumn() {
    const { data, error } = await supabase
        .from('restaurant_menu_categories')
        .select('id, name, is_bar')
        .limit(5);

    if (error) {
        console.error('Error checking column:', error);
    } else {
        console.log('Column is_bar exists and data is:', data);
    }
}

checkColumn();
