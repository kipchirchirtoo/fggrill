require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🚀 Starting storekeeping migration...\n');

  const migrations = [
    '11a_storekeeping_core.sql',
    '11b_storekeeping_suppliers.sql',
    '11c_storekeeping_purchase.sql',
    '11d_storekeeping_stock_operations.sql',
    '11e_storekeeping_policies.sql',
    '11f_storekeeping_functions.sql'
  ];

  for (const migrationFile of migrations) {
    const filePath = path.join(__dirname, '../supabase/migrations', migrationFile);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping ${migrationFile} - file not found`);
      continue;
    }

    console.log(`📝 Running ${migrationFile}...`);
    
    const sql = fs.readFileSync(filePath, 'utf8');
    
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
      
      if (error) {
        console.error(`❌ Error in ${migrationFile}:`, error.message);
        process.exit(1);
      }
      
      console.log(`✅ ${migrationFile} completed successfully\n`);
    } catch (err) {
      console.error(`❌ Failed to run ${migrationFile}:`, err.message);
      process.exit(1);
    }
  }

  console.log('🎉 All migrations completed successfully!');
}

runMigration().catch(console.error);
