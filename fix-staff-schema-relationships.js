const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixStaffRelationships() {
  console.log('Fixing staff schema relationships...\n');

  try {
    // Check staff_leave table structure
    console.log('1. Checking staff_leave table...');
    const { data: leaveData, error: leaveError } = await supabase
      .from('staff_leave')
      .select('*')
      .limit(1);
    
    if (leaveError) {
      console.error('Error querying staff_leave:', leaveError.message);
    } else {
      console.log('staff_leave columns:', Object.keys(leaveData[0] || {}));
    }

    // Check staff_attendance table structure
    console.log('\n2. Checking staff_attendance table...');
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('staff_attendance')
      .select('*')
      .limit(1);
    
    if (attendanceError) {
      console.error('Error querying staff_attendance:', attendanceError.message);
    } else {
      console.log('staff_attendance columns:', Object.keys(attendanceData[0] || {}));
    }

    // Check if we need to add foreign key constraints
    console.log('\n3. Checking foreign key constraints...');
    
    const { data: constraints, error: constraintsError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
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
          AND tc.table_name IN ('staff_leave', 'staff_attendance');
      `
    });

    if (constraintsError) {
      console.error('Error checking constraints:', constraintsError.message);
    } else {
      console.log('Existing foreign keys:', constraints);
    }

    console.log('\n✅ Schema check complete');
    console.log('\nTo fix this issue, you need to:');
    console.log('1. Ensure staff_leave has a user_id column that references users(id)');
    console.log('2. Ensure staff_attendance has a staff_id column that references staff_profiles(id)');
    console.log('\nRun the backend server restart to refresh the schema cache.');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

fixStaffRelationships();
