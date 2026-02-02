
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

const branchData = [
    { id: 1, name: 'KYOGONG', location: 'BOMET', code: 'KYO' },
    { id: 2, name: 'BOMET TOWN', location: 'BOMET', code: 'BTN' },
    { id: 3, name: 'KAPLONG', location: 'BOMET', code: 'KPL' },
    { id: 4, name: 'SOTIK', location: 'BOMET', code: 'STK' },
    { id: 5, name: 'MOGOGOSHIEK', location: 'BOMET', code: 'MOG' },
    { id: 6, name: 'KAPTOTE', location: 'KERICHO', code: 'KPT' },
    { id: 7, name: 'LITEIN', location: 'KERICHO', code: 'LIT' },
    { id: 8, name: 'KAPSOIT', location: 'KERICHO', code: 'KST' },
    { id: 9, name: 'GRILL', location: 'KERICHO', code: 'GRL' },
    { id: 10, name: 'GUESTHOUSE', location: 'KERICHO', code: 'GHS' }
];

async function main() {
    console.log('Updating Branches with Unique Codes...');

    for (const b of branchData) {
        console.log(`Processing ID ${b.id}: ${b.name} (${b.code})`);

        // Upsert based on ID
        const { data, error } = await supabase
            .from('branches')
            .upsert({
                id: b.id,
                name: b.name,
                code: b.code,
                location: b.location,
                status: 'active',
                branch_type: b.name.includes('GUESTHOUSE') ? 'guesthouse' : 'restaurant'
            })
            .select();

        if (error) {
            console.error(`Failed to update branch ${b.id}:`, error);
        } else {
            console.log(`Updated successfully.`);
        }
    }

    // Deactivate others
    console.log('Deactivating mismatching branches...');
    const authorizedIds = branchData.map(b => b.id);

    // Deactivate any active branch not in our authorized list
    const { error: deactivateError } = await supabase
        .from('branches')
        .update({ status: 'inactive' })
        .not('id', 'in', `(${authorizedIds.join(',')})`)
        .eq('status', 'active'); // Only update if currently active

    if (deactivateError) console.error('Error deactivating branches:', deactivateError);
    else console.log('Unauthorized branches deactivated.');

    // Check results
    const { data: allBranches } = await supabase
        .from('branches')
        .select('id, name, code, status')
        .order('id');

    console.log('--- Final Branch List ---');
    allBranches.forEach(b => console.log(`[${b.id}] ${b.name} (${b.code}) - ${b.status}`));
}

main();
