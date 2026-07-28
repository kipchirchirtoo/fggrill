require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Connected to DB');

  const sqlFile = path.join(__dirname, '../../database/migrations/20260727_pos_master_bills.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  await client.query(sql);
  console.log('Migration executed successfully.');

  // Reload PostgREST schema cache!
  await client.query("NOTIFY pgrst, 'reload schema';");
  console.log('PostgREST schema reloaded!');

  const check = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'pos_master_bills';");
  console.log('Table existence in postgres:', check.rows);

  await client.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
