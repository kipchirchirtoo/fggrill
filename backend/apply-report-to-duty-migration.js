require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function applyMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting Report to Duty migration...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_report_to_duty_to_staff_leave.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');
    console.log('🔧 Applying migration to database...\n');

    // Execute the migration
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');

    console.log('✅ Migration applied successfully!\n');

    // Verify the columns exist
    console.log('🔍 Verifying new columns...\n');
    const verifyQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'staff_leave'
      AND column_name IN ('actual_return_date', 'reported_to_duty', 'reported_at', 'reported_by', 'report_notes')
      ORDER BY column_name;
    `;
    
    const result = await client.query(verifyQuery);
    
    if (result.rows.length === 5) {
      console.log('✅ All columns verified:');
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log('⚠️  Warning: Expected 5 columns, found', result.rows.length);
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
    }

    console.log('\n✅ Report to Duty migration completed successfully!');
    console.log('📊 The following features are now available:');
    console.log('   - Track actual return dates');
    console.log('   - Mark employees as reported to duty');
    console.log('   - Record who confirmed the return');
    console.log('   - Add notes about the return to duty');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
applyMigration()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
