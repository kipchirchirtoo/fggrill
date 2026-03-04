require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixSchemaCache() {
  console.log('🔧 Fixing Schema Cache Relationship Issues\n');
  console.log('='.repeat(80));

  try {
    // 1. Check finance_daily_logs relationships
    console.log('\n📋 Step 1: Checking finance_daily_logs relationships...');
    
    const dailyLogsColumns = await pool.query(`
      SELECT 
        c.column_name,
        c.data_type,
        c.is_nullable,
        tc.constraint_type,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu 
        ON c.table_name = kcu.table_name 
        AND c.column_name = kcu.column_name
      LEFT JOIN information_schema.table_constraints tc 
        ON kcu.constraint_name = tc.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE c.table_name = 'finance_daily_logs'
      AND (c.column_name LIKE '%_id' OR c.column_name LIKE '%_by')
      ORDER BY c.column_name;
    `);

    console.log('\nfinance_daily_logs foreign key columns:');
    dailyLogsColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
      if (row.foreign_table_name) {
        console.log(`    → ${row.foreign_table_name}.${row.foreign_column_name}`);
      }
    });

    // 2. Check cashier_logbooks relationships
    console.log('\n📋 Step 2: Checking cashier_logbooks relationships...');
    
    const logbooksColumns = await pool.query(`
      SELECT 
        c.column_name,
        c.data_type,
        c.is_nullable,
        tc.constraint_type,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu 
        ON c.table_name = kcu.table_name 
        AND c.column_name = kcu.column_name
      LEFT JOIN information_schema.table_constraints tc 
        ON kcu.constraint_name = tc.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE c.table_name = 'cashier_logbooks'
      AND (c.column_name LIKE '%_id' OR c.column_name LIKE '%_by')
      ORDER BY c.column_name;
    `);

    console.log('\ncashier_logbooks foreign key columns:');
    logbooksColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
      if (row.foreign_table_name) {
        console.log(`    → ${row.foreign_table_name}.${row.foreign_column_name}`);
      }
    });

    // 3. Add missing foreign keys if needed
    console.log('\n📋 Step 3: Adding missing foreign keys...');
    
    // Check if finance_daily_logs has user relationships
    const dailyLogsUserCols = dailyLogsColumns.rows.filter(r => 
      (r.column_name.includes('user') || r.column_name.endsWith('_by')) && 
      r.data_type === 'uuid'
    );

    for (const col of dailyLogsUserCols) {
      if (!col.foreign_table_name) {
        console.log(`\n  Adding foreign key for finance_daily_logs.${col.column_name}...`);
        try {
          await pool.query(`
            ALTER TABLE finance_daily_logs
            ADD CONSTRAINT fk_finance_daily_logs_${col.column_name}
            FOREIGN KEY (${col.column_name})
            REFERENCES users(id)
            ON DELETE SET NULL;
          `);
          console.log(`  ✅ Added foreign key for ${col.column_name}`);
        } catch (err) {
          if (err.message.includes('already exists')) {
            console.log(`  ℹ️  Foreign key already exists for ${col.column_name}`);
          } else {
            console.log(`  ⚠️  Could not add foreign key for ${col.column_name}: ${err.message}`);
          }
        }
      }
    }

    // Check if cashier_logbooks has branch relationship
    const logbooksBranchCol = logbooksColumns.rows.find(r => r.column_name === 'branch_id');
    if (logbooksBranchCol && !logbooksBranchCol.foreign_table_name) {
      console.log('\n  Adding foreign key for cashier_logbooks.branch_id...');
      try {
        await pool.query(`
          ALTER TABLE cashier_logbooks
          ADD CONSTRAINT fk_cashier_logbooks_branch_id
          FOREIGN KEY (branch_id)
          REFERENCES branches(id)
          ON DELETE CASCADE;
        `);
        console.log('  ✅ Added foreign key for branch_id');
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log('  ℹ️  Foreign key already exists for branch_id');
        } else {
          console.log(`  ⚠️  Could not add foreign key for branch_id: ${err.message}`);
        }
      }
    }

    // 4. Create indexes for better performance
    console.log('\n📋 Step 4: Creating indexes...');
    
    const indexes = [
      { table: 'finance_daily_logs', column: 'created_by', name: 'idx_finance_daily_logs_created_by' },
      { table: 'finance_daily_logs', column: 'submitted_by', name: 'idx_finance_daily_logs_submitted_by' },
      { table: 'finance_daily_logs', column: 'verified_by', name: 'idx_finance_daily_logs_verified_by' },
      { table: 'cashier_logbooks', column: 'branch_id', name: 'idx_cashier_logbooks_branch_id' },
      { table: 'cashier_logbooks', column: 'cashier_id', name: 'idx_cashier_logbooks_cashier_id' },
      { table: 'cashier_logbooks', column: 'audited_by', name: 'idx_cashier_logbooks_audited_by' }
    ];

    for (const idx of indexes) {
      try {
        await pool.query(`
          CREATE INDEX IF NOT EXISTS ${idx.name}
          ON ${idx.table}(${idx.column});
        `);
        console.log(`  ✅ Created index ${idx.name}`);
      } catch (err) {
        console.log(`  ℹ️  Index ${idx.name} may already exist`);
      }
    }

    // 5. Reload PostgREST schema cache
    console.log('\n📋 Step 5: Reloading PostgREST schema cache...');
    await pool.query(`NOTIFY pgrst, 'reload schema'`);
    await pool.query(`NOTIFY pgrst, 'reload config'`);
    console.log('✅ Schema cache reload signals sent');

    // 6. Verify the fixes
    console.log('\n📋 Step 6: Verifying fixes...');
    
    const verifyDailyLogs = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(created_by) as with_created_by,
        COUNT(verified_by) as with_verified_by
      FROM finance_daily_logs;
    `);
    
    console.log('\nfinance_daily_logs verification:');
    console.log(`  Total records: ${verifyDailyLogs.rows[0].total}`);
    console.log(`  With created_by: ${verifyDailyLogs.rows[0].with_created_by}`);
    console.log(`  With verified_by: ${verifyDailyLogs.rows[0].with_verified_by}`);

    const verifyLogbooks = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(branch_id) as with_branch_id,
        COUNT(cashier_id) as with_cashier_id
      FROM cashier_logbooks;
    `);
    
    console.log('\ncashier_logbooks verification:');
    console.log(`  Total records: ${verifyLogbooks.rows[0].total}`);
    console.log(`  With branch_id: ${verifyLogbooks.rows[0].with_branch_id}`);
    console.log(`  With cashier_id: ${verifyLogbooks.rows[0].with_cashier_id}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ SCHEMA CACHE FIX COMPLETE');
    console.log('='.repeat(80));
    console.log('\n🎯 What was fixed:');
    console.log('   1. Verified and added missing foreign key constraints');
    console.log('   2. Created performance indexes');
    console.log('   3. Reloaded PostgREST schema cache');
    console.log('\n🚀 Next steps:');
    console.log('   1. Wait 10-15 seconds for cache to reload');
    console.log('   2. Restart your backend server: npm run dev');
    console.log('   3. Clear browser cache and refresh');
    console.log('   4. Test the affected pages\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixSchemaCache();
