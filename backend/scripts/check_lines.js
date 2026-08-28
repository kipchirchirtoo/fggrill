require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query(`
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name IN ('stock_takes', 'stock_take_lines', 'stock_take_variances')
  ORDER BY table_name, ordinal_position;
`).then((res) => {
  res.rows.forEach(r => console.log(r.table_name, '|', r.column_name, '|', r.data_type));
  pool.end();
}).catch((err) => { console.error(err.message); pool.end(); });
