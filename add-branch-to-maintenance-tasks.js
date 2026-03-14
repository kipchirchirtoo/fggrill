#!/usr/bin/env node

/**
 * Add branch_id and room_number columns to maintenance_tasks table
 * 
 * This allows filtering maintenance tasks by branch and associating
 * them with specific hotel rooms.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addBranchToMaintenanceTasks() {
  console.log('🔧 Adding branch_id and room_number to maintenance_tasks table...\n');

  try {
    // Check if maintenance_tasks table exists
    console.log('1️⃣ Checking if maintenance_tasks table exists...');
    const { data: tables, error: tablesError } = await supabase
      .from('maintenance_tasks')
      .select('id')
      .limit(1);

    if (tablesError) {
      console.error('❌ maintenance_tasks table does not exist');
      console.error('Error:', tablesError.message);
      console.log('\n💡 Run the maintenance schema migration first:');
      console.log('   backend/migrations/versions/20251226_create_maintenance_schema.sql');
      return false;
    }

    console.log('✅ maintenance_tasks table exists\n');

    // Add branch_id column if it doesn't exist
    console.log('2️⃣ Adding branch_id column...');
    const addBranchIdSQL = `
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'maintenance_tasks' 
          AND column_name = 'branch_id'
        ) THEN
          ALTER TABLE maintenance_tasks 
          ADD COLUMN branch_id INTEGER REFERENCES branches(id);
          
          CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_branch_id 
          ON maintenance_tasks(branch_id);
          
          RAISE NOTICE 'Added branch_id column';
        ELSE
          RAISE NOTICE 'branch_id column already exists';
        END IF;
      END $$;
    `;

    const { error: branchError } = await supabase.rpc('exec_sql', {
      sql: addBranchIdSQL
    });

    if (branchError) {
      // Try alternative method using direct query
      console.log('   Trying alternative method...');
      
      // Check if column exists
      const { data: columnCheck } = await supabase
        .from('maintenance_tasks')
        .select('branch_id')
        .limit(1);

      if (columnCheck === null) {
        console.log('   ⚠️  Cannot add column directly. Please run this SQL manually:');
        console.log(`
ALTER TABLE maintenance_tasks 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_branch_id 
ON maintenance_tasks(branch_id);
        `);
      } else {
        console.log('   ✅ branch_id column already exists');
      }
    } else {
      console.log('✅ branch_id column added\n');
    }

    // Add room_number column if it doesn't exist
    console.log('3️⃣ Adding room_number column...');
    const addRoomNumberSQL = `
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'maintenance_tasks' 
          AND column_name = 'room_number'
        ) THEN
          ALTER TABLE maintenance_tasks 
          ADD COLUMN room_number VARCHAR(20);
          
          CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_room_number 
          ON maintenance_tasks(room_number);
          
          RAISE NOTICE 'Added room_number column';
        ELSE
          RAISE NOTICE 'room_number column already exists';
        END IF;
      END $$;
    `;

    const { error: roomError } = await supabase.rpc('exec_sql', {
      sql: addRoomNumberSQL
    });

    if (roomError) {
      console.log('   Trying alternative method...');
      
      const { data: columnCheck } = await supabase
        .from('maintenance_tasks')
        .select('room_number')
        .limit(1);

      if (columnCheck === null) {
        console.log('   ⚠️  Cannot add column directly. Please run this SQL manually:');
        console.log(`
ALTER TABLE maintenance_tasks 
ADD COLUMN IF NOT EXISTS room_number VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_room_number 
ON maintenance_tasks(room_number);
        `);
      } else {
        console.log('   ✅ room_number column already exists');
      }
    } else {
      console.log('✅ room_number column added\n');
    }

    // Test the updated table
    console.log('4️⃣ Testing updated table structure...');
    const { data: testData, error: testError } = await supabase
      .from('maintenance_tasks')
      .select('id, branch_id, room_number, status')
      .limit(1);

    if (testError) {
      console.error('❌ Error testing table:', testError.message);
      return false;
    }

    console.log('✅ Table structure updated successfully!\n');

    if (testData && testData.length > 0) {
      console.log('Sample record:', JSON.stringify(testData[0], null, 2));
    } else {
      console.log('No records in table yet (this is okay)');
    }

    console.log('\n✅ Migration complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Restart your backend server');
    console.log('2. Test the maintenance tasks endpoint with branch_id filter');
    console.log('3. The Department Communication component should now work');

    return true;

  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function main() {
  const success = await addBranchToMaintenanceTasks();
  
  if (!success) {
    console.log('\n💡 MANUAL SQL TO RUN:');
    console.log(`
-- Add branch_id column
ALTER TABLE maintenance_tasks 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_branch_id 
ON maintenance_tasks(branch_id);

-- Add room_number column
ALTER TABLE maintenance_tasks 
ADD COLUMN IF NOT EXISTS room_number VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_room_number 
ON maintenance_tasks(room_number);
    `);
  }
  
  process.exit(success ? 0 : 1);
}

main();
