const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log("Connected to DB!");

  const tables = ['pos_outlet_items', 'bar_drinks', 'bar_stock', 'inventory_items', 'inventory_balances'];

  for (const table of tables) {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1
      ORDER BY ordinal_position;
    `, [table]);
    console.log(`\nColumns for table "${table}":`);
    console.log(res.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
  }

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
