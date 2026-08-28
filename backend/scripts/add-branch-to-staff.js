const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('URL:', supabaseUrl ? 'Found' : 'Missing');
  console.error('Key:', supabaseKey ? 'Found' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('Adding branch_id column to staff_profiles...');
  
  try {
    // Add branch_id column
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE staff_profiles 
        ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
        
        CREATE INDEX IF NOT EXISTS idx_staff_profiles_branch_id ON staff_profiles(branch_id);
      `
    });
    
    if (alterError) {
      console.error('Error adding column:', alterError);
      // Try alternative approach using raw query
      console.log('Trying alternative approach...');
      
      // Check if column exists
      const { data: columns } = await supabase
        .from('staff_profiles')
        .select('*')
        .limit(1);
      
      console.log('Current staff_profiles structure:', columns ? Object.keys(columns[0] || {}) : 'No data');
      console.log('\nPlease run this SQL manually in Supabase SQL Editor:');
      console.log(`
ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_branch_id ON staff_profiles(branch_id);

UPDATE staff_profiles 
SET branch_id = 1 
WHERE branch_id IS NULL 
AND EXISTS (SELECT 1 FROM branches WHERE id = 1);
      `);
    } else {
      console.log('✓ Column added successfully');
      
      // Update existing records
      console.log('Updating existing staff profiles...');
      const { error: updateError } = await supabase
        .from('staff_profiles')
        .update({ branch_id: 1 })
        .is('branch_id', null);
      
      if (updateError) {
        console.error('Error updating records:', updateError);
      } else {
        console.log('✓ Migration completed successfully');
      }
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
