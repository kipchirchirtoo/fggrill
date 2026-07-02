// Read-only connectivity test against the CURRENT production project
// (matching .env's SUPABASE_URL project ref), reusing the connection
// string already present in query_sales_direct.js rather than retyping it.
const fs = require('fs');
const { Client } = require('pg');

const src = fs.readFileSync('query_sales_direct.js', 'utf8');
const match = src.match(/connectionString\s*=\s*'([^']+)'/);
if (!match) {
  console.error('could not find connectionString in query_sales_direct.js');
  process.exit(1);
}
const connectionString = match[1];

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  await client.connect();
  console.log((await client.query('SELECT now() AS t, current_database() AS db;')).rows);
  await client.end();
  console.log('OK - direct pg connection works against the live project.');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
