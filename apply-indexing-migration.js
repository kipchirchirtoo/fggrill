#!/usr/bin/env node

/**
 * Apply Comprehensive Indexing Migration
 * Connects directly to PostgreSQL and applies the migration
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

// Colors for console output
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
  log('Comprehensive Database Indexing Migration', 'bright');
  log('========================================\n', 'cyan');

  // Parse DATABASE_URL or construct from individual vars
  let connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    const host = process.env.DB_HOST || process.env.SUPABASE_DB_HOST;
    const port = process.env.DB_PORT || process.env.SUPABASE_DB_PORT || 5432;
    const database = process.env.DB_NAME || process.env.SUPABASE_DB_NAME || 'postgres';
    const user = process.env.DB_USER || process.env.SUPABASE_DB_USER || 'postgres';
    const password = process.env.DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD;

    if (!host || !password) {
      log('❌ Error: Missing database credentials', 'red');
      log('   Required: DATABASE_URL or DB_HOST, DB_PASSWORD', 'yellow');
      log('   Check backend/.env file\n', 'yellow');
      process.exit(1);
    }

    connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
  }

  log('✅ Database credentials loaded', 'green');

  // Create PostgreSQL client
  const client = new Client({
    connectionString,
    ssl: process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false
  });

  try {
    log('🔌 Connecting to database...', 'blue');
    await client.connect();
    log('✅ Connected successfully\n', 'green');

    // Read migration file
    const migrationPath = path.join(__dirname, 'backend', 'supabase', 'migrations', '70_comprehensive_indexing.sql');
    
    if (!fs.existsSync(migrationPath)) {
      log(`❌ Error: Migration file not found at ${migrationPath}`, 'red');
      process.exit(1);
    }

    log('📋 Reading migration file...', 'blue');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    const lines = migrationSQL.split('\n').length;
    log(`   File: 70_comprehensive_indexing.sql`, 'cyan');
    log(`   Lines: ${lines}\n`, 'cyan');

    log('📊 Migration Summary:', 'bright');
    log('   - 100+ indexes across critical tables', 'cyan');
    log('   - Conditional indexes (only if columns exist)', 'cyan');
    log('   - Partial indexes for performance', 'cyan');
    log('   - Composite indexes for common queries\n', 'cyan');

    log('⚠️  This will create many indexes. This may take a few minutes.\n', 'yellow');

    // Apply migration as a single transaction
    log('🚀 Applying migration...\n', 'green');

    const startTime = Date.now();

    try {
      await client.query('BEGIN');
      await client.query(migrationSQL);
      await client.query('COMMIT');
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      log(`\n✅ Migration applied successfully in ${duration}s\n`, 'green');
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Try to identify which part failed
      log('\n❌ Migration failed. Trying to identify the problematic statement...', 'yellow');
      
      // Extract line number from error if available
      if (error.position) {
        const position = parseInt(error.position);
        const lines = migrationSQL.substring(0, position).split('\n');
        const lineNumber = lines.length;
        const columnNumber = lines[lines.length - 1].length;
        
        log(`   Error at line ${lineNumber}, column ${columnNumber}`, 'yellow');
        log(`   Context:`, 'yellow');
        
        const allLines = migrationSQL.split('\n');
        const start = Math.max(0, lineNumber - 3);
        const end = Math.min(allLines.length, lineNumber + 2);
        
        for (let i = start; i < end; i++) {
          const marker = i === lineNumber - 1 ? '>>>' : '   ';
          log(`   ${marker} ${i + 1}: ${allLines[i]}`, i === lineNumber - 1 ? 'red' : 'cyan');
        }
      }
      
      throw error;
    }

    // Run ANALYZE
    log('📊 Running ANALYZE to update statistics...', 'blue');
    await client.query('ANALYZE');
    log('✅ ANALYZE complete\n', 'green');

    // Get index count
    const result = await client.query(`
      SELECT COUNT(*) as index_count
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname LIKE 'idx_%'
    `);

    const indexCount = result.rows[0].index_count;

    log('========================================', 'cyan');
    log('Migration Complete!', 'bright');
    log('========================================\n', 'cyan');

    log(`✅ Total indexes created: ${indexCount}`, 'green');

    log('\n📈 Next Steps:', 'bright');
    log('   1. Monitor query performance improvements', 'cyan');
    log('   2. Check index usage statistics', 'cyan');
    log('   3. Schedule weekly REINDEX and VACUUM\n', 'cyan');

    log('📊 Check index usage:', 'bright');
    log('   SELECT schemaname, tablename, indexname, idx_scan', 'cyan');
    log('   FROM pg_stat_user_indexes', 'cyan');
    log('   WHERE schemaname = \'public\' AND indexname LIKE \'idx_%\'', 'cyan');
    log('   ORDER BY idx_scan DESC LIMIT 20;\n', 'cyan');

    log('🔍 Find unused indexes:', 'bright');
    log('   SELECT schemaname, tablename, indexname', 'cyan');
    log('   FROM pg_stat_user_indexes', 'cyan');
    log('   WHERE schemaname = \'public\' AND idx_scan = 0', 'cyan');
    log('   AND indexname LIKE \'idx_%\';\n', 'cyan');

  } catch (error) {
    log('\n❌ Migration failed:', 'red');
    log(`   ${error.message}\n`, 'red');
    
    if (error.position) {
      log(`   Error at position: ${error.position}`, 'yellow');
    }
    
    if (error.detail) {
      log(`   Detail: ${error.detail}`, 'yellow');
    }
    
    if (error.hint) {
      log(`   Hint: ${error.hint}\n`, 'yellow');
    }
    
    throw error;
  } finally {
    await client.end();
    log('🔌 Database connection closed\n', 'blue');
  }
}

// Run migration
applyMigration()
  .then(() => {
    log('✅ Script completed successfully\n', 'green');
    process.exit(0);
  })
  .catch((error) => {
    log('❌ Script failed\n', 'red');
    process.exit(1);
  });
