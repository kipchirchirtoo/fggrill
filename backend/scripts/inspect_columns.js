
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectColumns() {
    console.log('Inspecting columns for hk_staff_profiles...');

    const { data, error } = await supabase
        .rpc('run_dynamic_query', {
            query: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'hk_staff_profiles'
      `
        });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Columns:', JSON.stringify(data, null, 2));
}

inspectColumns();
