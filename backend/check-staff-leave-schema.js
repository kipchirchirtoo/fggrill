require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking staff_leave table schema...\n');

    // Get all columns
    const columnsQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'staff_leave'
      ORDER BY ordinal_position;
    `;
    
    const result = await client.query(columnsQuery);
    
    console.log(`📊 Found ${result.rows.length} columns in staff_leave table:\n`);
    
    const reportToDutyColumns = [
      'actual_return_date',
      'reported_to_duty',
      'reported_at',
      'reported_by',
      'report_notes'
    ];
    
    let missingColumns = [];
    
    result.rows.forEach(row => {
      const isReportColumn = reportToDutyColumns.includes(row.column_name);
      const marker = isReportColumn ? '🎯' : '  ';
      console.log(`${marker} ${row.column_name.padEnd(30)} ${row.data_type.padEnd(25)} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Check for missing report-to-duty columns
    reportToDutyColumns.forEach(col => {
      if (!result.rows.find(row => row.column_name === col)) {
        missingColumns.push(col);
      }
    });

    console.log('\n' + '='.repeat(80));
    
    if (missingColumns.length === 0) {
      console.log('✅ All report-to-duty columns are present!');
    } else {
      console.log('❌ Missing report-to-duty columns:');
      missingColumns.forEach(col => {
        console.log(`   - ${col}`);
      });
      console.log('\n💡 Run APPLY_REPORT_TO_DUTY_MIGRATION.bat to add these columns');
    }

  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the check
checkSchema()
  .then(() => {
    console.log('\n✅ Schema check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Schema check failed:', error);
    process.exit(1);
  });
