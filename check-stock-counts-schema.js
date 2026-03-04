require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkStockCountsSchema() {
  console.log('🔍 Checking stock_counts table schema\n');

  try {
    // Get all columns
    const columnsResult = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'stock_counts'
      ORDER BY ordinal_position;
    `);

    console.log('📋 stock_counts columns:');
    console.log('='.repeat(80));
    columnsResult.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(25)} | ${col.data_type.padEnd(20)} | Nullable: ${col.is_nullable}`);
    });

    // Check for created_by specifically
    const createdByCheck = columnsResult.rows.find(col => col.column_name === 'created_by');
    console.log('\n' + '='.repeat(80));
    if (createdByCheck) {
      console.log('✅ created_by column EXISTS');
      console.log(`   Type: ${createdByCheck.data_type}`);
      console.log(`   Nullable: ${createdByCheck.is_nullable}`);
    } else {
      console.log('❌ created_by column MISSING');
    }

    // Check constraints
    console.log('\n📋 Constraints:');
    console.log('='.repeat(80));
    const constraintsResult = await pool.query(`
      SELECT 
        conname as constraint_name,
        contype as constraint_type
      FROM pg_constraint
      WHERE conrelid = 'stock_counts'::regclass;
    `);
    
    constraintsResult.rows.forEach(con => {
      console.log(`  ${con.constraint_name.padEnd(40)} | Type: ${con.constraint_type}`);
    });

    // Test a simple insert
    console.log('\n🧪 Testing insert with created_by...');
    const testResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'stock_counts' 
      AND column_name = 'created_by';
    `);

    if (testResult.rows.length > 0) {
      console.log('✅ Column is accessible via information_schema');
    } else {
      console.log('❌ Column NOT found in information_schema');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

checkStockCountsSchema();
