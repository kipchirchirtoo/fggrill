const { supabase } = require('./src/config/supabase.js');

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
                console.log('No data, checking via openapi...');
                // we can't easily get schema without data using JS client simply, but let's see.
            }
        }
    }
}
checkSchema();
