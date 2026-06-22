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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

async function runMigration(filename) {
  try {
    const migrationPath = path.join(__dirname, 'supabase/migrations', filename);

    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log(`Running migration: ${filename}\n`);

    // For ALTER TABLE commands, we can try via REST API or use a custom function
    // Since Supabase doesn't allow arbitrary SQL via the client, we'll use postgres:// connection
    const { createPool } = require('@vercel/postgres');

    // Extract database connection from Supabase URL
    const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

    if (!dbUrl) {
      console.log('SQL to execute:');
      console.log(sql);
      console.log('\n⚠️  No DATABASE_URL found. Please run this SQL manually in Supabase SQL editor.');
      process.exit(0);
    }

    const pool = createPool({ connectionString: dbUrl });
    const client = await pool.connect();

    await client.query(sql);

    console.log(`✓ Migration ${filename} completed successfully`);

    await client.release();
    await pool.end();

  } catch (error) {
    console.error('Migration failed:', error.message);
    console.log('\nYou can run this SQL manually in Supabase SQL editor:');
    const migrationPath = path.join(__dirname, 'supabase/migrations', filename);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(sql);
    process.exit(1);
  }
}

const filename = process.argv[2];

if (!filename) {
  console.error('Usage: node run_migration_simple.js <migration_filename>');
  process.exit(1);
}

runMigration(filename);
