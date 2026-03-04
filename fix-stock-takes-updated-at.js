const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function fixUpdatedAt() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    console.log('📦 Adding updated_at column to stock_takes table...');
    await client.query(`
      ALTER TABLE stock_takes 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
    `);
    console.log('✅ Column added\n');
    
    // Verify
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'stock_takes' AND column_name = 'updated_at'
    `);
    
    console.log('✅ Verification: updated_at column exists:', result.rows.length > 0);
    
    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixUpdatedAt();
