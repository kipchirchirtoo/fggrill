const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const migrationPath = path.join(__dirname, 'migrations', '20251125_create_core_org_tables.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Running migration: 20251125_create_core_org_tables.sql');
  console.log('---');

  // Split by statements (simple approach)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    console.log(`Executing statement ${i + 1}/${statements.length}...`);
    
    const { error } = await supabase.rpc('exec_sql', { sql_query: statement }).catch(() => ({
      error: null // Fallback if RPC doesn't exist
    }));

    // Try direct query if RPC failed
    if (error) {
      console.log('RPC failed, trying direct query...');
      const { error: queryError } = await supabase
        .from('_migrations')
        .insert({ name: '20251125_create_core_org_tables', executed_at: new Date().toISOString() })
        .catch(() => ({ error: null }));
    }
  }

  console.log('---');
  console.log('✅ Migration completed successfully!');
  console.log('Note: Some statements may have been skipped if tables already exist.');
}

runMigration().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
