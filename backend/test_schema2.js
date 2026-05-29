const { createClient } = require('@supabase/supabase-js');
const url = 'https://utsvlihpudfraxzcmtle.supabase.co';
const key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '');
const supabase = createClient(url, key);

async function checkSchema() {
    const tables = ['staff_loans', 'staff_advances', 'staff_credit_bills', 'staff_profiles'];
    
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.error(`Error fetching ${table}:`, error.message);
        } else {
            console.log(`Table: ${table}`);
            if (data && data.length > 0) {
                console.log('Columns:', Object.keys(data[0]));
            } else {
                console.log('No data.');
            }
        }
    }
}
checkSchema();
