#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function applyMigration() {
  log('\n========================================', 'cyan');
  log('Applying Report Jobs Database Migration', 'bright');
  log('========================================\n', 'cyan');

  let connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    const host = process.env.DB_HOST || process.env.SUPABASE_DB_HOST;
    const port = process.env.DB_PORT || process.env.SUPABASE_DB_PORT || 5432;
    const database = process.env.DB_NAME || process.env.SUPABASE_DB_NAME || 'postgres';
    const user = process.env.DB_USER || process.env.SUPABASE_DB_USER || 'postgres';
    const password = process.env.DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD;

    if (!host || !password) {
      log('❌ Error: Missing database credentials', 'red');
      log('   Check backend/.env file\n', 'yellow');
      process.exit(1);
    }

    connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
  }

  log('✅ Database credentials loaded', 'green');

  const client = new Client({
    connectionString,
    ssl: process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false
  });

  try {
    log('🔌 Connecting to database...', 'blue');
    await client.connect();
    log('✅ Connected successfully\n', 'green');

    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '20260522_create_report_jobs.sql');
    
    if (!fs.existsSync(migrationPath)) {
      log(`❌ Error: Migration file not found at ${migrationPath}`, 'red');
      process.exit(1);
    }

    log('📋 Reading migration file...', 'blue');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    log('🚀 Applying migration...\n', 'green');
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    log('✅ Migration applied successfully!\n', 'green');

  } catch (error) {
    log('\n❌ Migration failed:', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    log('🔌 Database connection closed\n', 'blue');
  }
}

applyMigration();
