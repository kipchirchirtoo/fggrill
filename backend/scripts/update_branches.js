
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

const branchData = [
    { id: 1, name: 'KYOGONG', location: 'BOMET' },
    { id: 2, name: 'BOMET TOWN', location: 'BOMET' },
    { id: 3, name: 'KAPLONG', location: 'BOMET' },
    { id: 4, name: 'SOTIK', location: 'BOMET' },
    { id: 5, name: 'MOGOGOSHIEK', location: 'BOMET' },
    { id: 6, name: 'KAPTOTE', location: 'KERICHO' },
    { id: 7, name: 'LITEIN', location: 'KERICHO' },
    { id: 8, name: 'KAPSOIT', location: 'KERICHO' },
    { id: 9, name: 'GRILL', location: 'KERICHO' },
    { id: 10, name: 'GUESTHOUSE', location: 'KERICHO' }
];

async function main() {
    console.log('Updating Branches...');

    for (const b of branchData) {
        console.log(`Processing ID ${b.id}: ${b.name}`);

        // Upsert based on ID
        const code = b.name.substring(0, 3).toUpperCase();
        const { data, error } = await supabase
            .from('branches')
            .upsert({
                id: b.id,
                name: b.name,
                code: code,
                location: b.location,
                status: 'active',
                branch_type: b.name.includes('GUESTHOUSE') ? 'guesthouse' : 'restaurant' // Simple heuristic
            })
            .select();

        if (error) {
            console.error(`Failed to update branch ${b.id}:`, error);
        } else {
            console.log(`Updated successfully.`);
        }
    }

    // Deactivate others?
    // User said "analyse database on branches and branchess id and update them"
    // Does not explicitly say delete others. But implies these are THE branches.
    // I made a mistake in previous thought - I should be careful about deleting.
    // I will just print what other branches exist.

    const { data: others } = await supabase
        .from('branches')
        .select('id, name')
        .gt('id', 10);

    if (others && others.length > 0) {
        console.log('WARNING: The following branches exist outside the ID range 1-10:');
        others.forEach(o => console.log(`[ID: ${o.id}] ${o.name}`));
    }
}

main();
