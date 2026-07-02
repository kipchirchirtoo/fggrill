const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const file = '20260626_kitchen_pos_consumption_and_alerts.sql';
const MIGRATIONS_DIR = path.join(__dirname, '..', 'database', 'migrations');
const DATABASE_URL = process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(':6543/', ':5432/') : null;

const run = async () => {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  
  console.log('Connecting to database:', DATABASE_URL.replace(/:([^@:]+)@/, ':***@'));
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  const filePath = path.join(MIGRATIONS_DIR, file);
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`Running migration: ${file}`);
  
  try {
    const client = await pool.connect();
    await client.query(sql);
    console.log(`✓ ${file} completed successfully.`);
    client.release();
  } catch (err) {
    console.error(`✗ ${file} failed:`, err.message);
  } finally {
    await pool.end();
  }
};

run();
