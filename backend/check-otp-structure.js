const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkStructure() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'dispatch_otps'
      ORDER BY ordinal_position
    `);
    
    console.log('dispatch_otps table structure:');
    console.log('');
    res.rows.forEach(r => {
      console.log(`  ${r.column_name}:`);
      console.log(`    Type: ${r.data_type}${r.character_maximum_length ? `(${r.character_maximum_length})` : ''}`);
      console.log(`    Nullable: ${r.is_nullable}`);
      console.log(`    Default: ${r.column_default || 'none'}`);
      console.log('');
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkStructure();
