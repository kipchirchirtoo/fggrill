#!/usr/bin/env node

/**
 * Base Schema Migration Script
 * Creates the foundational tables required before running branch enhancement scripts
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
});

// Migration file path
const MIGRATION_FILE = './backend/migrations/versions/20251203_create_base_schema.sql';

async function runMigration() {
  console.log('🔄 Starting base schema migration...');

  const client = await pool.connect();
  try {
    // Begin transaction
    await client.query('BEGIN');

    // Read and execute migration file
    console.log(`📄 Reading migration file: ${MIGRATION_FILE}`);
    const migration = fs.readFileSync(path.resolve(MIGRATION_FILE), 'utf8');
    
    console.log('🔧 Executing migration...');
    await client.query(migration);
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Base schema migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

// Run the migration
runMigration().then(() => {
  console.log('🎉 Base schema migration completed!');
  process.exit(0);
}).catch(err => {
  console.error('Migration failed with error:', err);
  process.exit(1);
})
