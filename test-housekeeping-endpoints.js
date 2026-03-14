#!/usr/bin/env node

/**
 * Test Housekeeping Endpoints
 * 
 * This script tests the housekeeping endpoints to verify data structure
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

async function testHousekeepingEndpoints() {
  console.log('🧪 Testing Housekeeping Endpoints...\n');

  try {
    // Test 1: Check if rooms table exists and has data
    console.log('1️⃣ Testing rooms table...');
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, room_number, floor, hk_status, branch_id')
      .limit(5);

    if (roomsError) {
      console.error('❌ Rooms table error:', roomsError.message);
    } else {
      console.log(`✅ Found ${rooms?.length || 0} rooms`);
      if (rooms && rooms.length > 0) {
        console.log('Sample room:', JSON.stringify(rooms[0], null, 2));
      }
    }
    console.log('');

    // Test 2: Check if hk_tasks table exists and has data
    console.log('2️⃣ Testing hk_tasks table...');
    const { data: tasks, error: tasksError } = await supabase
      .from('hk_tasks')
      .select('id, room_id, task_type, status, priority, branch_id')
      .limit(5);

    if (tasksError) {
      console.error('❌ HK tasks table error:', tasksError.message);
      console.log('   This table might not exist yet');
    } else {
      console.log(`✅ Found ${tasks?.length || 0} housekeeping tasks`);
      if (tasks && tasks.length > 0) {
        console.log('Sample task:', JSON.stringify(tasks[0], null, 2));
      }
    }
    console.log('');

    // Test 3: Check branches
    console.log('3️⃣ Testing branches...');
    const { data: branches, error: branchesError } = await supabase
      .from('branches')
      .select('id, name')
      .limit(5);

    if (branchesError) {
      console.error('❌ Branches error:', branchesError.message);
    } else {
      console.log(`✅ Found ${branches?.length || 0} branches`);
      if (branches && branches.length > 0) {
        branches.forEach(b => console.log(`   - Branch ${b.id}: ${b.name}`));
      }
    }
    console.log('');

    // Test 4: Check if hk_staff_profiles exists
    console.log('4️⃣ Testing hk_staff_profiles table...');
    const { data: staff, error: staffError } = await supabase
      .from('hk_staff_profiles')
      .select('id, staff_code, user_id')
      .limit(5);

    if (staffError) {
      console.error('❌ HK staff profiles error:', staffError.message);
      console.log('   This table might not exist yet');
    } else {
      console.log(`✅ Found ${staff?.length || 0} housekeeping staff profiles`);
    }
    console.log('');

    // Test 5: Simulate room grid query
    console.log('5️⃣ Simulating room grid query...');
    if (branches && branches.length > 0) {
      const branchId = branches[0].id;
      const { data: roomGrid, error: gridError } = await supabase
        .from('rooms')
        .select(`
          id, room_number, floor, room_type, hk_status, cleaning_priority,
          last_cleaned_at, expected_checkout
        `)
        .eq('branch_id', branchId)
        .order('floor', { ascending: true })
        .order('room_number', { ascending: true })
        .limit(10);

      if (gridError) {
        console.error('❌ Room grid query error:', gridError.message);
      } else {
        console.log(`✅ Room grid query successful - ${roomGrid?.length || 0} rooms`);
        if (roomGrid && roomGrid.length > 0) {
          console.log('Sample room grid data:', JSON.stringify(roomGrid[0], null, 2));
        }
      }
    }
    console.log('');

    // Summary
    console.log('📊 Summary:');
    console.log('─────────────────────────────────────');
    
    if (!roomsError && rooms && rooms.length > 0) {
      console.log('✅ Rooms table: OK');
    } else {
      console.log('❌ Rooms table: MISSING DATA');
    }

    if (!tasksError) {
      console.log('✅ HK tasks table: EXISTS');
    } else {
      console.log('⚠️  HK tasks table: MISSING (needs migration)');
    }

    if (!staffError) {
      console.log('✅ HK staff profiles: EXISTS');
    } else {
      console.log('⚠️  HK staff profiles: MISSING (needs migration)');
    }

    console.log('');
    console.log('💡 Next Steps:');
    
    if (tasksError || staffError) {
      console.log('1. Run housekeeping schema migration');
      console.log('2. Check backend/migrations/ for housekeeping migrations');
      console.log('3. Apply missing migrations to Supabase');
    } else if (!rooms || rooms.length === 0) {
      console.log('1. Add rooms to your database');
      console.log('2. Ensure rooms have branch_id set correctly');
    } else {
      console.log('1. Restart your backend server');
      console.log('2. Test the housekeeping page in the frontend');
      console.log('3. Check browser console for any API errors');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function main() {
  await testHousekeepingEndpoints();
  process.exit(0);
}

main();
