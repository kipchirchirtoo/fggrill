require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'stock_takes'
  ORDER BY ordinal_position;
`).then((res) => {
  res.rows.forEach(r => console.log(r.column_name, r.data_type));
  pool.end();
}).catch((err) => { console.error(err.message); pool.end(); });
