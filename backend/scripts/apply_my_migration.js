const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  const migrationFile = '43_shift_reconciliation_system.sql';
  const filePath = path.join(__dirname, '../supabase/migrations', migrationFile);
  
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Applying ${migrationFile} directly...`);
    
    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query('INSERT INTO public._migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [migrationFile]);
    await pool.query('COMMIT');
    
    console.log(`Successfully applied and registered ${migrationFile}`);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

applyMigration();
