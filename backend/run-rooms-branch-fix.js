#!/usr/bin/env node
/**
 * Room Branch Isolation Migration Runner
 * 
 * This script applies the room branch isolation fix using environment variables.
 * Required env vars: DATABASE_URL or SUPABASE_PROJECT_URL + SUPABASE_SERVICE_ROLE_KEY
 * 
 * Usage:
 *   cd backend && node run-rooms-branch-fix.js
 *   OR
 *   DATABASE_URL=postgresql://... node run-rooms-branch-fix.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env from backend directory
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Get database connection from env
const getDatabaseUrl = () => {
  // Priority: explicit DATABASE_URL > construct from Supabase URL
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  // Try to construct from Supabase project URL
  const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
  if (supabaseUrl) {
    // Convert Supabase URL format to PostgreSQL connection string
    // From: https://xxxx.supabase.co
    // To: postgresql://postgres:[password]@db.xxxx.supabase.co:5432/postgres
    console.log('⚠️  DATABASE_URL not found, trying to use Supabase URL...');
    console.log('   Please set DATABASE_URL in your .env file for best results');
    console.log('   Format: postgresql://user:password@host:port/database');
    return null;
  }
  
  return null;
};

const dbUrl = getDatabaseUrl();

if (!dbUrl) {
  console.error('❌ Missing DATABASE_URL environment variable');
  console.error('\n📋 Required environment variables:');
  console.error('   DATABASE_URL=postgresql://user:password@host:port/database');
  console.error('\n📝 Example .env entry:');
  console.error('   DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres');
  console.error('\n💡 You can get this from your Supabase Dashboard → Settings → Database → Connection string');
  process.exit(1);
}

// Migration file path
const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '20260523_fix_rooms_branch_isolation.sql');

if (!fs.existsSync(migrationPath)) {
  console.error('❌ Migration file not found:', migrationPath);
  process.exit(1);
}

const migrationSql = fs.readFileSync(migrationPath, 'utf8');

async function runMigration() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('supabase.co') ? { rejectUnauthorized: false } : false
  });

  console.log('🔌 Connecting to database...');
  
  try {
    await client.connect();
    console.log('✅ Connected successfully\n');
    
    console.log('📄 Migration file:', path.basename(migrationPath));
    console.log(`📏 Size: ${(migrationSql.length / 1024).toFixed(2)} KB\n`);
    
    console.log('⚙️  Executing migration...\n');
    console.log('─'.repeat(60));
    
    // Execute the SQL
    await client.query(migrationSql);
    
    console.log('─'.repeat(60));
    console.log('\n✅ Migration completed successfully!\n');
    
    // Verify the fix
    console.log('🔍 Verifying rooms branch assignment...');
    const { rows: stats } = await client.query(`
      SELECT 
        COUNT(*) as total_rooms,
        COUNT(branch_id) as rooms_with_branch,
        COUNT(*) - COUNT(branch_id) as rooms_without_branch,
        COUNT(DISTINCT branch_id) as unique_branches
      FROM rooms
    `);
    
    const s = stats[0];
    console.log('\n📊 Room Statistics:');
    console.log(`   Total rooms:        ${s.total_rooms}`);
    console.log(`   With branch_id:     ${s.rooms_with_branch}`);
    console.log(`   Without branch_id:  ${s.rooms_without_branch}`);
    console.log(`   Unique branches:    ${s.unique_branches}`);
    
    if (parseInt(s.rooms_without_branch) > 0) {
      console.warn('\n⚠️  WARNING: Some rooms still have no branch assigned!');
    } else {
      console.log('\n✅ All rooms now have branch isolation enabled');
    }
    
    console.log('\n🎉 Branch isolation fix is complete!');
    console.log('\n📋 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Refresh the Reception Dashboard');
    console.log('   3. Verify rooms are filtered by branch');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    
    if (error.message.includes('password authentication failed')) {
      console.error('\n💡 Tip: Check your DATABASE_URL password is correct');
    }
    if (error.message.includes('does not exist')) {
      console.error('\n💡 Tip: Check the database name in your connection string');
    }
    if (error.message.includes('ENOTFOUND')) {
      console.error('\n💡 Tip: Check the hostname in your connection string');
    }
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the migration
console.log('╔'.repeat(60));
console.log('║  ROOM BRANCH ISOLATION FIX');
console.log('╚'.repeat(60) + '\n');

runMigration();
