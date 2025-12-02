// Run restaurant enhancement migration
require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🚀 Starting restaurant enhancement migration...');
  
  try {
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'backend/supabase/migrations/12_restaurant_enhancements.sql'),
      'utf8'
    );
    
    console.log('📄 Migration file loaded, executing...');
    
    // Split into individual statements and execute
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let executed = 0;
    let errors = 0;
    
    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error && !error.message.includes('already exists')) {
          console.error(`❌ Error: ${error.message}`);
          errors++;
        } else {
          executed++;
          if (executed % 10 === 0) {
            console.log(`✅ Executed ${executed} statements...`);
          }
        }
      } catch (err) {
        console.error(`❌ Failed to execute statement: ${err.message}`);
        errors++;
      }
    }
    
    console.log(`\n✅ Migration complete!`);
    console.log(`   - Executed: ${executed} statements`);
    console.log(`   - Errors: ${errors}`);
    
    // Verify tables created
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .like('table_name', 'restaurant_%');
    
    if (!tableError && tables) {
      console.log(`\n📊 Restaurant tables in database: ${tables.length}`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
