const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_NEW;
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'bar_orders'")
  .then(res => {
    console.log(res.rows.map(r => r.column_name).join(', '));
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
