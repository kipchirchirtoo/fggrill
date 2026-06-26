const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected to DB');

  const shiftId = 'f9bba97e-1288-468e-90c2-5509b552ef2a';

  const res = await client.query(`
    UPDATE pos_outlet_shifts 
    SET opening_float = 0.00 
    WHERE id = $1
    RETURNING id, opening_float, status
  `, [shiftId]);

  console.log('\n--- Updated Shift Details ---');
  console.log(res.rows);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
