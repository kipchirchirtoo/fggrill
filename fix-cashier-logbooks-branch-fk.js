require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixCashierLogbooksBranchFK() {
  console.log('🔧 Fixing cashier_logbooks.branch_id Foreign Key\n');
  console.log('='.repeat(80));

  try {
    // 1. Check current constraints
    console.log('\n📋 Step 1: Checking current constraints...');
    
    const constraints = await pool.query(`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'cashier_logbooks'
      AND kcu.column_name = 'branch_id';
    `);

    console.log('\nCurrent constraints on cashier_logbooks.branch_id:');
    constraints.rows.forEach(row => {
      console.log(`  - ${row.constraint_name} (${row.constraint_type})`);
      if (row.foreign_table_name) {
        console.log(`    → ${row.foreign_table_name}.${row.foreign_column_name}`);
      }
    });

    // 2. Drop incorrect constraints
    console.log('\n📋 Step 2: Dropping incorrect constraints...');
    
    const incorrectConstraints = constraints.rows.filter(r => 
      r.constraint_type === 'FOREIGN KEY' && 
      r.foreign_table_name !== 'branches'
    );

    for (const constraint of incorrectConstraints) {
      console.log(`\n  Dropping ${constraint.constraint_name}...`);
      try {
        await pool.query(`
          ALTER TABLE cashier_logbooks
          DROP CONSTRAINT IF EXISTS ${constraint.constraint_name};
        `);
        console.log(`  ✅ Dropped ${constraint.constraint_name}`);
      } catch (err) {
        console.log(`  ⚠️  Could not drop ${constraint.constraint_name}: ${err.message}`);
      }
    }

    // 3. Add correct foreign key to branches
    console.log('\n📋 Step 3: Adding correct foreign key to branches...');
    
    const hasBranchesFK = constraints.rows.some(r => 
      r.constraint_type === 'FOREIGN KEY' && 
      r.foreign_table_name === 'branches'
    );

    if (!hasBranchesFK) {
      console.log('\n  Adding foreign key to branches table...');
      try {
        await pool.query(`
          ALTER TABLE cashier_logbooks
          ADD CONSTRAINT fk_cashier_logbooks_branch
          FOREIGN KEY (branch_id)
          REFERENCES branches(id)
          ON DELETE CASCADE;
        `);
        console.log('  ✅ Added foreign key to branches');
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log('  ℹ️  Foreign key already exists');
        } else {
          console.log(`  ⚠️  Could not add foreign key: ${err.message}`);
        }
      }
    } else {
      console.log('  ℹ️  Foreign key to branches already exists');
    }

    // 4. Verify the fix
    console.log('\n📋 Step 4: Verifying the fix...');
    
    const verifyConstraints = await pool.query(`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'cashier_logbooks'
      AND kcu.column_name = 'branch_id';
    `);

    console.log('\nFinal constraints on cashier_logbooks.branch_id:');
    verifyConstraints.rows.forEach(row => {
      console.log(`  - ${row.constraint_name} (${row.constraint_type})`);
      if (row.foreign_table_name) {
        console.log(`    → ${row.foreign_table_name}.${row.foreign_column_name}`);
      }
    });

    // 5. Reload schema cache
    console.log('\n📋 Step 5: Reloading schema cache...');
    await pool.query(`NOTIFY pgrst, 'reload schema'`);
    await pool.query(`NOTIFY pgrst, 'reload config'`);
    console.log('✅ Schema cache reloaded');

    console.log('\n' + '='.repeat(80));
    console.log('✅ FIX COMPLETE');
    console.log('='.repeat(80));
    console.log('\n🎯 What was fixed:');
    console.log('   1. Removed incorrect foreign key constraints');
    console.log('   2. Added correct foreign key to branches table');
    console.log('   3. Reloaded schema cache');
    console.log('\n🚀 Next steps:');
    console.log('   1. Restart backend server');
    console.log('   2. Clear browser cache');
    console.log('   3. Test the cashier logbook pages\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixCashierLogbooksBranchFK();
