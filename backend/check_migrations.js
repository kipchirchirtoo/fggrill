const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL.replace(':6543/', ':5432/');

const run = async () => {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    
    // Check if _migrations table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '_migrations'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      const { rows } = await client.query('SELECT name FROM public._migrations ORDER BY name');
      console.log('Applied migrations:');
      rows.forEach(r => console.log(`- ${r.name}`));
    } else {
      console.log('_migrations table does not exist.');
    }
    
    // Also list all tables in public schema
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('\nAll tables in public schema:');
    tables.rows.forEach(r => console.log(`- ${r.table_name}`));

    client.release();
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
};

run();
