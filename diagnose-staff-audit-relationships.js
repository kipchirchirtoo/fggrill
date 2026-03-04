require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function diagnoseStaffAudit() {
  console.log('🔍 Diagnosing Staff Audit Relationships\n');
  console.log('='.repeat(80));

  try {
    // 1. Check staff_credit_bills structure
    console.log('\n📋 Step 1: Checking staff_credit_bills...');
    
    const creditBillsColumns = await pool.query(`
      SELECT 
        c.column_name,
        c.data_type,
        tc.constraint_name,
        tc.constraint_type,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu 
        ON c.table_name = kcu.table_name 
        AND c.column_name = kcu.column_name
      LEFT JOIN information_schema.table_constraints tc 
        ON kcu.constraint_name = tc.constraint_name
        AND tc.constraint_type = 'FOREIGN KEY'
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE c.table_name = 'staff_credit_bills'
      AND (c.column_name LIKE '%staff%' OR c.column_name LIKE '%user%')
      ORDER BY c.column_name;
    `);

    console.log('\nstaff_credit_bills columns:');
    creditBillsColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
      if (row.foreign_table) {
        console.log(`    → ${row.foreign_table}.${row.foreign_column}`);
      } else {
        console.log(`    ✗ No FK`);
      }
    });

    // 2. Check staff_advances structure
    console.log('\n📋 Step 2: Checking staff_advances...');
    
    const advancesColumns = await pool.query(`
      SELECT 
        c.column_name,
        c.data_type,
        tc.constraint_name,
        tc.constraint_type,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu 
        ON c.table_name = kcu.table_name 
        AND c.column_name = kcu.column_name
      LEFT JOIN information_schema.table_constraints tc 
        ON kcu.constraint_name = tc.constraint_name
        AND tc.constraint_type = 'FOREIGN KEY'
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE c.table_name = 'staff_advances'
      AND (c.column_name LIKE '%staff%' OR c.column_name LIKE '%user%')
      ORDER BY c.column_name;
    `);

    console.log('\nstaff_advances columns:');
    advancesColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
      if (row.foreign_table) {
        console.log(`    → ${row.foreign_table}.${row.foreign_column}`);
      } else {
        console.log(`    ✗ No FK`);
      }
    });

    // 3. Check staff_loans structure
    console.log('\n📋 Step 3: Checking staff_loans...');
    
    const loansColumns = await pool.query(`
      SELECT 
        c.column_name,
        c.data_type,
        tc.constraint_name,
        tc.constraint_type,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu 
        ON c.table_name = kcu.table_name 
        AND c.column_name = kcu.column_name
      LEFT JOIN information_schema.table_constraints tc 
        ON kcu.constraint_name = tc.constraint_name
        AND tc.constraint_type = 'FOREIGN KEY'
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE c.table_name = 'staff_loans'
      AND (c.column_name LIKE '%staff%' OR c.column_name LIKE '%user%')
      ORDER BY c.column_name;
    `);

    console.log('\nstaff_loans columns:');
    loansColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
      if (row.foreign_table) {
        console.log(`    → ${row.foreign_table}.${row.foreign_column}`);
      } else {
        console.log(`    ✗ No FK`);
      }
    });

    // 4. Check if staff_profiles exists and its structure
    console.log('\n📋 Step 4: Checking staff_profiles table...');
    
    const staffProfilesExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'staff_profiles'
      );
    `);

    if (staffProfilesExists.rows[0].exists) {
      console.log('✓ staff_profiles table exists');
      
      const profilesColumns = await pool.query(`
        SELECT 
          c.column_name,
          c.data_type,
          tc.constraint_name,
          tc.constraint_type,
          ccu.table_name AS foreign_table,
          ccu.column_name AS foreign_column
        FROM information_schema.columns c
        LEFT JOIN information_schema.key_column_usage kcu 
          ON c.table_name = kcu.table_name 
          AND c.column_name = kcu.column_name
        LEFT JOIN information_schema.table_constraints tc 
          ON kcu.constraint_name = tc.constraint_name
          AND tc.constraint_type = 'FOREIGN KEY'
        LEFT JOIN information_schema.constraint_column_usage ccu 
          ON tc.constraint_name = ccu.constraint_name
        WHERE c.table_name = 'staff_profiles'
        ORDER BY c.column_name;
      `);

      console.log('\nstaff_profiles columns:');
      profilesColumns.rows.forEach(row => {
        console.log(`  - ${row.column_name} (${row.data_type})`);
        if (row.foreign_table) {
          console.log(`    → ${row.foreign_table}.${row.foreign_column}`);
        }
      });
    } else {
      console.log('✗ staff_profiles table does NOT exist');
    }

    // 5. Sample data check
    console.log('\n📋 Step 5: Checking sample data...');
    
    const sampleCredit = await pool.query(`
      SELECT id, staff_id, amount, description, is_paid
      FROM staff_credit_bills
      LIMIT 3;
    `);

    console.log('\nSample staff_credit_bills:');
    sampleCredit.rows.forEach(row => {
      console.log(`  ID: ${row.id.substring(0, 8)}, Staff: ${row.staff_id ? row.staff_id.substring(0, 8) : 'NULL'}, Amount: ${row.amount}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ DIAGNOSIS COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

diagnoseStaffAudit();
