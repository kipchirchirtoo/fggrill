require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixStockCountsCreatedBy() {
  console.log('🔧 Fixing stock_counts table - adding created_by column\n');

  try {
    // Check if column exists
    console.log('📋 Checking if created_by column exists...');
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'stock_counts' 
      AND column_name = 'created_by';
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ created_by column already exists');
      return;
    }

    console.log('❌ created_by column missing - adding it now...');

    // Add the column
    await pool.query(`
      ALTER TABLE stock_counts 
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
    `);

    console.log('✅ Added created_by column');

    // Add comment
    await pool.query(`
      COMMENT ON COLUMN stock_counts.created_by IS 'User who created this stock count';
    `);

    console.log('✅ Added column comment');

    // Create index for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_counts_created_by ON stock_counts(created_by);
    `);

    console.log('✅ Created index on created_by');

    // Update existing records to set created_by from stock_takes
    console.log('\n📝 Updating existing records...');
    const updateResult = await pool.query(`
      UPDATE stock_counts sc
      SET created_by = st.created_by
      FROM stock_takes st
      WHERE sc.stock_take_id = st.id
      AND sc.created_by IS NULL;
    `);

    console.log(`✅ Updated ${updateResult.rowCount} existing records`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ FIX COMPLETE');
    console.log('='.repeat(60));
    console.log('The stock_counts table now has the created_by column');
    console.log('You can now create stock takes without errors');
    console.log('\n🚀 Try creating a stock take again!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixStockCountsCreatedBy();
