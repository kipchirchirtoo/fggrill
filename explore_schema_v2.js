const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function exploreFurther() {
    // Search for all table names
    // Since we can't use pg_tables directly, we'll try to guess or use a common pattern
    const searchTerms = ['room', 'hall', 'conf', 'rate', 'price', 'branch', 'facility', 'service', 'cottage', 'stay', 'resident'];
    
    console.log('--- Checking for Tables ---');
    for (const term of searchTerms) {
        // This is a bit brute force but since we don't have direct schema access, we'll try common names
        const tablesToTry = [term, term + 's', 'branch_' + term, term + '_types', term + '_rates'];
        for (const table of tablesToTry) {
            const { data, error } = await supabase.from(table).select('*').limit(1);
            if (!error) {
                console.log(`Table found: ${table}`);
                if (data.length > 0) {
                    console.log(`- Columns: ${Object.keys(data[0]).join(', ')}`);
                } else {
                    // Try to get columns even if no data
                    console.log(`- Table ${table} exists but is empty.`);
                }
            }
        }
    }

    console.log('\n--- Checking Branches ---');
    const { data: branches, error: branchError } = await supabase.from('branches').select('*');
    if (branchError) {
        console.log('Error fetching branches:', branchError.message);
    } else {
        console.log('Branches found:', branches.map(b => ({ id: b.id, name: b.name, code: b.code })));
    }
}

exploreFurther();
