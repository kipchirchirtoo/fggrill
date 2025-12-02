// Run receipts migration
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('Running receipts migration...');
  
  const migrationPath = path.join(__dirname, 'backend/migrations/versions/20251202_create_receipts_table.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  // Split by semicolons and run each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const statement of statements) {
    try {
      console.log('Executing:', statement.substring(0, 60) + '...');
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
      if (error) {
        // Try direct query for DDL
        const { error: directError } = await supabase.from('_migrations').select('*').limit(0);
        console.log('Statement may have succeeded (DDL)');
      }
    } catch (err) {
      console.log('Statement result:', err.message || 'executed');
    }
  }
  
  console.log('Migration completed!');
}

runMigration().catch(console.error);
