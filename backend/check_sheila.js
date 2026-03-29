const { Client } = require('pg');

async function checkSheila() {
  const client = new Client({
    connectionString: "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const res = await client.query("SELECT id, first_name, last_name, email, role, branch_id FROM users WHERE first_name ILIKE '%Sheila%' OR last_name ILIKE '%Chepkemoi%'");
    console.table(res.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkSheila();
