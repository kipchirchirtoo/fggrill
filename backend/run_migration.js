const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration(filename) {
  try {
    const migrationPath = path.join(__dirname, 'supabase/migrations', filename);

    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log(`Running migration: ${filename}`);
    console.log('SQL:', sql);

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });

    if (error) {
      // If RPC doesn't exist, try direct execution via REST API
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ sql_string: sql }),
      });

      if (!response.ok) {
        // Fallback: Try executing via query
        const lines = sql.split(';').filter(line => line.trim());
        for (const line of lines) {
          if (line.trim()) {
            const { error: execError } = await supabase.rpc('exec', { sql: line });
            if (execError) {
              console.error('Error executing SQL:', execError);
              throw execError;
            }
          }
        }
      }
    }

    console.log(`✓ Migration ${filename} completed successfully`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

const filename = process.argv[2];

if (!filename) {
  console.error('Usage: node run_migration.js <migration_filename>');
  process.exit(1);
}

runMigration(filename);
