const { Client } = require('pg');

const urls = [
  "postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@aws-0-eu-west-1.pooler.supabase.com:5432/postgres",
  "postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@db.rvoaowhxyweswwuxbrzm.supabase.co:5432/postgres",
  "postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
];

async function test(url) {
  console.log(`Testing: ${url.replace(/:[^:@]+@/, ':***@')}`);
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    console.log("-> SUCCESS!");
    const res = await client.query("SELECT 1 as connected");
    console.log("Query response:", res.rows);
    await client.end();
    return true;
  } catch (err) {
    console.log("-> FAILED:", err.message);
    return false;
  }
}

async function main() {
  for (const url of urls) {
    const ok = await test(url);
    if (ok) {
      console.log("Found working connection string!");
      process.exit(0);
    }
  }
  console.log("All connection attempts failed.");
  process.exit(1);
}

main();
