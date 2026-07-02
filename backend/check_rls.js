const { Client } = require('pg');
const url = require('url');
require('dotenv').config();

async function run() {
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No DATABASE_URL found in .env');
    process.exit(1);
  }

  connectionString = connectionString.replace(':6543', ':5432');
  const parsed = new url.URL(connectionString);
  const ipv4 = '34.241.16.247';
  parsed.hostname = ipv4;
  
  const client = new Client({
    connectionString: parsed.toString(),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Check if RLS is enabled and there are no policies for any tables
    const rlsQuery = `
      SELECT t.tablename, t.rowsecurity
      FROM pg_tables t
      WHERE t.schemaname = 'public'
        AND t.rowsecurity = true
        AND NOT EXISTS (
          SELECT 1 
          FROM pg_policies p 
          WHERE p.schemaname = 'public' 
            AND p.tablename = t.tablename
        );
    `;
    const rlsRes = await client.query(rlsQuery);
    console.log('Tables with RLS enabled but NO policies:', rlsRes.rows);

  } catch (e) {
    console.error('Failed:', e);
  } finally {
    await client.end();
  }
}
run();
