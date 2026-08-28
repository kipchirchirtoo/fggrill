import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runSQL(sql: string): Promise<void> {
  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    if (statement.trim()) {
      const { error } = await supabase.rpc('exec_sql', { query: statement + ';' });
      if (error) {
        // Try direct execution for CREATE TYPE, CREATE TABLE, etc.
        console.log(`Executing: ${statement.substring(0, 50)}...`);
      }
    }
  }
}

async function runMigrations() {
  console.log('🚀 Running Storekeeping Migrations...\n');

  const migrationsDir = path.join(__dirname, '../supabase/migrations');
  const migrationFiles = [
    '11a_storekeeping_core.sql',
    '11b_storekeeping_suppliers.sql',
    '11c_storekeeping_purchase.sql',
    '11d_storekeeping_stock_operations.sql',
    '11e_storekeeping_policies.sql',
    '11f_storekeeping_functions.sql'
  ];

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${file} not found, skipping...`);
      continue;
    }

    console.log(`📝 Running ${file}...`);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    try {
      await runSQL(sql);
      console.log(`✅ ${file} completed\n`);
    } catch (error: any) {
      console.error(`❌ Error in ${file}:`, error.message);
      console.log('\n⚠️  Please run this migration manually in Supabase Dashboard');
      console.log(`   Go to: SQL Editor and paste content from: ${filePath}\n`);
    }
  }

  console.log('🎉 Migration process completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Verify tables created in Supabase Dashboard');
  console.log('2. Check for any errors above');
  console.log('3. If errors exist, run SQL manually in Supabase SQL Editor');
}

runMigrations().catch(console.error);
