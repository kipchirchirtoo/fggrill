const { Client } = require('pg');
const d = require('dotenv');
const path = require('path');
d.config({ path: path.join(__dirname, '.env') });
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(() => c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'staff_profiles'").then(r => console.log(r.rows.map(row => row.column_name).join(', '))).finally(() => c.end()))
