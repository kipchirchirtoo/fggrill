const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log("Connected to DB!");

  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'pos_shift_orders'
    ORDER BY ordinal_position;
  `);
  console.log("Columns of pos_shift_orders:");
  console.log(res.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
