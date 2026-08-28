
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugConstraint() {
    console.log('Checking for orphan user_ids...');

    const { data: orphans, error: orphanError } = await supabase
        .rpc('run_dynamic_query', {
            query: `
        SELECT count(*) as orphan_count 
        FROM hk_staff_profiles 
        WHERE user_id IS NOT NULL 
        AND user_id NOT IN (SELECT id FROM users)
      `
        });

    if (orphanError) {
        console.error('Error checking orphans:', orphanError);
    } else {
        console.log('Orphan count:', JSON.stringify(orphans, null, 2));
    }

    console.log('Attempting to add constraint directly...');

    const { data: constraintResult, error: constraintError } = await supabase
        .rpc('run_dynamic_query', {
            query: `
        ALTER TABLE hk_staff_profiles 
        ADD CONSTRAINT housekeeping_staff_user_relationship 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      `
        });

    if (constraintError) {
        console.error('Error adding constraint:', constraintError);
    } else {
        console.log('Constraint added successfully!');
    }
}

debugConstraint();
