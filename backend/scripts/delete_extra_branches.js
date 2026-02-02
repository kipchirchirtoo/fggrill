
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Deleting unauthorized branches (ID > 10)...');

    // First list what we are about to delete
    const { data: toDelete } = await supabase
        .from('branches')
        .select('*')
        .gt('id', 10);

    if (!toDelete || toDelete.length === 0) {
        console.log('No extra branches found to delete.');
        return;
    }

    console.log(`Found ${toDelete.length} branches to delete:`);
    toDelete.forEach(b => console.log(`- [${b.id}] ${b.name}`));

    // Attempt delete
    const { error } = await supabase
        .from('branches')
        .delete()
        .gt('id', 10);

    if (error) {
        console.error('Error deleting branches:', error);
        if (error.code === '23503') {
            console.log('Foreign Key Constraint Violation: These branches have related data (users, orders, etc.) and cannot be hard deleted easily.');
            console.log('Please instruct if checking/clearing related data is required.');
        }
    } else {
        console.log('Successfully deleted extra branches.');
    }
}

main();
