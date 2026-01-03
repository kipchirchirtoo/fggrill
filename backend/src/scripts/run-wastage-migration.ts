/**
 * Wastage Recording Migration Script
 * Uses DATABASE_URL from .env to create wastage_records table
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

console.log('🔌 Connecting to database...');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('✅ Connected to database');
    
    // Create wastage_records table
    console.log('📦 Creating wastage_records table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS wastage_records (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        branch_id INTEGER,
        item_name VARCHAR(255) NOT NULL,
        item_id VARCHAR(100),
        item_type VARCHAR(50),
        quantity DECIMAL(10, 3) NOT NULL,
        unit VARCHAR(50) NOT NULL DEFAULT 'portion',
        reason VARCHAR(50) NOT NULL DEFAULT 'other',
        cost_impact DECIMAL(10, 2) DEFAULT 0,
        description TEXT,
        logged_by UUID,
        logged_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Table created/verified');

    // Create indexes
    console.log('📊 Creating indexes...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wastage_branch ON wastage_records(branch_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wastage_reason ON wastage_records(reason);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wastage_logged_at ON wastage_records(logged_at);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wastage_item_name ON wastage_records(item_name);
    `);
    console.log('✅ Indexes created');

    // Enable RLS
    console.log('🔒 Setting up Row Level Security...');
    
    await client.query(`
      ALTER TABLE wastage_records ENABLE ROW LEVEL SECURITY;
    `);
    
    // Drop existing policy if exists and create new one
    await client.query(`
      DROP POLICY IF EXISTS wastage_allow_all ON wastage_records;
    `);
    await client.query(`
      CREATE POLICY wastage_allow_all ON wastage_records FOR ALL USING (true);
    `);
    console.log('✅ RLS policies set');

    // Grant permissions
    console.log('🔑 Granting permissions...');
    
    await client.query(`
      GRANT ALL ON wastage_records TO authenticated;
    `);
    await client.query(`
      GRANT ALL ON wastage_records TO anon;
    `);
    console.log('✅ Permissions granted');

    // Verify table exists
    const result = await client.query(`
      SELECT COUNT(*) as count FROM wastage_records;
    `);
    console.log(`📋 Current records in table: ${result.rows[0].count}`);

    // Insert a test record to verify everything works
    console.log('🧪 Testing insert...');
    
    const testResult = await client.query(`
      INSERT INTO wastage_records (branch_id, item_name, quantity, unit, reason, cost_impact, description)
      VALUES (1, 'Migration Test Item', 1, 'unit', 'other', 0, 'Test record from migration script')
      RETURNING id, item_name;
    `);
    console.log(`✅ Test insert successful: ${testResult.rows[0].item_name} (${testResult.rows[0].id})`);

    // Delete test record
    await client.query(`
      DELETE FROM wastage_records WHERE description = 'Test record from migration script';
    `);
    console.log('🧹 Test record cleaned up');

    console.log('');
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('Table: wastage_records');
    console.log('Columns: id, branch_id, item_name, item_id, item_type, quantity, unit, reason, cost_impact, description, logged_by, logged_at, created_at, updated_at');
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('');
    console.log('✨ Done! You can now use the wastage recording feature.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  });
