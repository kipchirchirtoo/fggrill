const { Client } = require('pg');
require('dotenv').config();

// Use DATABASE_URL from .env
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL');
    
    const res = await client.query(
      "SELECT id, month, year, status FROM payroll_runs WHERE month = 3 AND year = 2026"
    );
    console.log('Payroll runs for March 2026:', res.rows);
    
    const drafts = await client.query(
      "SELECT id, month, year, status FROM payroll_runs WHERE status = 'draft' LIMIT 10"
    );
    console.log('Recent drafts:', drafts.rows);

  } catch (err) {
    console.error('Database query failed:', err);
  } finally {
    await client.end();
  }
}

check();
