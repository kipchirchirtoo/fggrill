#!/usr/bin/env node

/**
 * Fix Maintenance Tasks Schema Cache
 * 
 * This script refreshes the PostgREST schema cache to recognize
 * the relationships between maintenance_tasks and users tables.
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

async function fixMaintenanceSchemaCache() {
  console.log('🔧 Fixing Maintenance Tasks Schema Cache...\n');

  try {
    // Step 1: Verify the maintenance_tasks table exists
    console.log('1️⃣ Checking if maintenance_tasks table exists...');
    const { data: tables, error: tablesError } = await supabase
      .from('maintenance_tasks')
      .select('id')
      .limit(1);

    if (tablesError) {
      console.error('❌ maintenance_tasks table does not exist or is not accessible');
      console.error('Error:', tablesError.message);
      console.log('\n💡 You need to run the maintenance schema migration first:');
      console.log('   backend/migrations/versions/20251226_create_maintenance_schema.sql');
      return;
    }

    console.log('✅ maintenance_tasks table exists\n');

    // Step 2: Verify foreign key constraints exist
    console.log('2️⃣ Verifying foreign key constraints...');
    const { data: constraints, error: constraintsError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'maintenance_tasks'
          AND ccu.table_name = 'users';
      `
    });

    if (constraintsError) {
      console.log('⚠️  Could not verify constraints (this is okay)');
    } else if (constraints && constraints.length > 0) {
      console.log('✅ Found foreign key constraints:');
      constraints.forEach(c => {
        console.log(`   - ${c.column_name} → ${c.foreign_table_name}.${c.foreign_column_name}`);
      });
    }

    console.log('');

    // Step 3: Reload the schema cache
    console.log('3️⃣ Reloading PostgREST schema cache...');
    
    // Method 1: Use the PostgREST admin endpoint to reload schema
    const reloadUrl = `${supabaseUrl}/rest/v1/`;
    const response = await fetch(reloadUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'schema-reload'
      }
    });

    if (response.ok) {
      console.log('✅ Schema cache reload requested\n');
    } else {
      console.log('⚠️  Schema cache reload request returned:', response.status);
      console.log('   This is okay - the cache will refresh automatically\n');
    }

    // Step 4: Test the relationship query
    console.log('4️⃣ Testing relationship query...');
    const { data: testData, error: testError } = await supabase
      .from('maintenance_tasks')
      .select(`
        id,
        title,
        status,
        assigned_to:users!assigned_to_id (id, full_name, email),
        reported_by:users!reported_by_id (id, full_name, email)
      `)
      .limit(1);

    if (testError) {
      console.error('❌ Relationship query still failing:', testError.message);
      console.log('\n💡 Alternative solution: Modify the controller to use simpler queries');
      console.log('   See the fix below...\n');
      return false;
    }

    console.log('✅ Relationship query works!\n');
    
    if (testData && testData.length > 0) {
      console.log('Sample data:', JSON.stringify(testData[0], null, 2));
    }

    console.log('\n✅ Schema cache fixed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function main() {
  const success = await fixMaintenanceSchemaCache();
  
  if (!success) {
    console.log('\n📝 ALTERNATIVE FIX:');
    console.log('If the schema cache issue persists, update the controller to fetch user data separately:');
    console.log('');
    console.log('// In backend/src/controllers/maintenance.controller.ts');
    console.log('// Replace the complex select with:');
    console.log(`
const { data: tasks, error } = await supabase
  .from('maintenance_tasks')
  .select('*')
  .order('created_at', { ascending: false });

if (error) throw error;

// Fetch related users separately
const userIds = new Set();
tasks.forEach(task => {
  if (task.assigned_to_id) userIds.add(task.assigned_to_id);
  if (task.reported_by_id) userIds.add(task.reported_by_id);
  if (task.verified_by_id) userIds.add(task.verified_by_id);
});

const { data: users } = await supabase
  .from('users')
  .select('id, full_name, email')
  .in('id', Array.from(userIds));

const usersMap = new Map(users?.map(u => [u.id, u]) || []);

// Attach user data to tasks
const enrichedTasks = tasks.map(task => ({
  ...task,
  assigned_to: task.assigned_to_id ? usersMap.get(task.assigned_to_id) : null,
  reported_by: task.reported_by_id ? usersMap.get(task.reported_by_id) : null,
  verified_by: task.verified_by_id ? usersMap.get(task.verified_by_id) : null
}));
    `);
  }
  
  process.exit(success ? 0 : 1);
}

main();
