const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env from project root and backend
dotenv.config({ path: path.resolve('c:/Users/user/Desktop/fggrill/.env') });
dotenv.config({ path: path.resolve('c:/Users/user/Desktop/fggrill/backend/.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Using Supabase URL:', supabaseUrl);
// console.log('Using Supabase Key (truncated):', supabaseKey ? supabaseKey.substring(0, 10) + '...' : 'MISSING');

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    console.log(`Checking table 'dynamic_services'...`);
    
    try {
        const { data, error, status } = await supabase
            .from('dynamic_services')
            .select('*');
            
        if (error) {
            console.error('Error fetching dynamic_services:', error);
            console.error('Status:', status);
        } else {
            console.log('Successfully fetched from dynamic_services. Row count:', data.length);
            if (data.length > 0) {
                console.log('Sample data:', data[0]);
                console.log('All service types found:', [...new Set(data.map(d => d.service_type))]);
            } else {
                console.log('Table is empty.');
            }
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

checkTable();
