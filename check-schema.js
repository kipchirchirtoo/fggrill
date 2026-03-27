const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT * FROM staff_profiles LIMIT 1');
  console.log(Object.keys(res.rows[0]).join(','));
  await client.end();
}
run().catch(e => { console.error(e.message); client.end(); });
