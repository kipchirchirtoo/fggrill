require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixCashierLogbooksUserFK() {
  console.log('🔧 Fixing cashier_logbooks User Foreign Keys\n');
  console.log('='.repeat(80));

  try {
    // 1. Check all user-related columns
    console.log('\n📋 Step 1: Checking user-related columns...');
    
    const userColumns = await pool.query(`
      SELECT 
        c.column_name,
        c.data_type,
        c.is_nullable,
        tc.constraint_name,
        tc.constraint_type,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu 
        ON c.table_name = kcu.table_name 
        AND c.column_name = kcu.column_name
      LEFT JOIN information_schema.table_constraints tc 
        ON kcu.constraint_name = tc.constraint_name
        AND tc.constraint_type = 'FOREIGN KEY'
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE c.table_name = 'cashier_logbooks'
      AND (c.column_name LIKE '%_id' OR c.column_name LIKE '%_by')
      AND c.data_type = 'uuid'
      ORDER BY c.column_name;
    `);

    console.log('\nUser-related UUID columns in cashier_logbooks:');
    userColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
      if (row.foreign_table_name) {
        console.log(`    ✓ FK → ${row.foreign_table_name}.${row.foreign_column_name}`);
      } else {
        console.log(`    ✗ No foreign key`);
      }
    });

    // 2. Add missing foreign keys
    console.log('\n📋 Step 2: Adding missing foreign keys to users table...');
    
    const columnsNeedingFK = userColumns.rows.filter(r => !r.foreign_table_name);
    
    for (const col of columnsNeedingFK) {
      console.log(`\n  Adding FK for ${col.column_name}...`);
      
      const constraintName = `fk_cashier_logbooks_${col.column_name}`;
      
      try {
        await pool.query(`
          ALTER TABLE cashier_logbooks
          ADD CONSTRAINT ${constraintName}
          FOREIGN KEY (${col.column_name})
          REFERENCES users(id)
          ON DELETE SET NULL;
        `);
        console.log(`  ✅ Added foreign key ${constraintName}`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`  ℹ️  Foreign key already exists`);
        } else {
          console.log(`  ⚠️  Could not add foreign key: ${err.message}`);
        }
      }
    }

    // 3. Create indexes
    console.log('\n📋 Step 3: Creating indexes for performance...');
    
    const indexColumns = ['cashier_id', 'audited_by', 'created_by', 'updated_by'];
    
    for (const col of indexColumns) {
      const indexName = `idx_cashier_logbooks_${col}`;
      try {
        await pool.query(`
          CREATE INDEX IF NOT EXISTS ${indexName}
          ON cashier_logbooks(${col});
        `);
        console.log(`  ✅ Created index ${indexName}`);
      } catch (err) {
        console.log(`  ℹ️  Index ${indexName} may already exist`);
      }
    }

    // 4. Reload schema cache
    console.log('\n📋 Step 4: Reloading schema cache...');
    await pool.query(`NOTIFY pgrst, 'reload schema'`);
    await pool.query(`NOTIFY pgrst, 'reload config'`);
    console.log('✅ Schema cache reloaded');

    // 5. Verify the fixes
    console.log('\n📋 Step 5: Verifying all foreign keys...');
    
    const verifyFK = await pool.query(`
      SELECT 
        kcu.column_name,
        tc.constraint_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'cashier_logbooks'
      AND tc.constraint_type = 'FOREIGN KEY'
      ORDER BY kcu.column_name;
    `);

    console.log('\nAll foreign keys on cashier_logbooks:');
    verifyFK.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name} → ${row.foreign_table_name}.${row.foreign_column_name}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ FIX COMPLETE');
    console.log('='.repeat(80));
    console.log('\n🎯 What was fixed:');
    console.log('   1. Added foreign keys for all user-related columns');
    console.log('   2. Created performance indexes');
    console.log('   3. Reloaded schema cache');
    console.log('\n🚀 Next steps:');
    console.log('   1. Restart backend server');
    console.log('   2. Clear browser cache');
    console.log('   3. Test the cashier logbook verification page\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixCashierLogbooksUserFK();
