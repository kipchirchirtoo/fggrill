require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query(`
  SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%stock%' ORDER BY table_name;
`).then((res) => {
  res.rows.forEach(r => console.log(r.table_name));
  pool.end();
}).catch((err) => { console.error(err.message); pool.end(); });
