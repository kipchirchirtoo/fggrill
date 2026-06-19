const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_NEW;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL or DATABASE_URL_NEW not found in .env');
  process.exit(1);
}

const migrationPath = path.join(__dirname, '../../database/migrations/20260619_branch_2_bomet_bar_initial_stock.sql');

if (!fs.existsSync(migrationPath)) {
  console.error('❌ Migration file not found:', migrationPath);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('🔗 Connecting to database...');
console.log('📄 Migration file:', migrationPath);

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('\n🚀 Running migration...\n');
    
    const result = await client.query(migrationSQL);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('📊 Result:', result);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Details:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
