const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const parsedUrl = new URL(process.env.DATABASE_URL.replace(':6543', ':5432'));
  parsedUrl.hostname = '34.241.16.247';
  const connectionString = parsedUrl.toString();
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();

    console.log('--- Top 10 queries by average execution time ---');
    const result = await client.query(`
      SELECT query, calls, total_exec_time, mean_exec_time, rows
      FROM pg_stat_statements
      ORDER BY mean_exec_time DESC
      LIMIT 10;
    `);
    
    for (const row of result.rows) {
      console.log(`Mean: ${Math.round(row.mean_exec_time)}ms | Calls: ${row.calls} | Rows: ${row.rows}`);
      console.log(`${row.query.substring(0, 150).replace(/\n/g, ' ')}...`);
      console.log('---');
    }

    console.log('\n--- Missing Indexes (Sequential Scans vs Index Scans) ---');
    const missingIndexes = await client.query(`
      SELECT relname AS table_name,
             seq_scan, seq_tup_read,
             idx_scan, idx_tup_fetch
      FROM pg_stat_user_tables
      WHERE seq_scan > 0
      ORDER BY seq_tup_read DESC
      LIMIT 10;
    `);

    console.table(missingIndexes.rows);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await client.end();
  }
}
run();
