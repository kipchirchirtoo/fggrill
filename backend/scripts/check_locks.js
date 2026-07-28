require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const active = await client.query(`
    SELECT pid, usename, state, query_start, query 
    FROM pg_stat_activity 
    WHERE state != 'idle';
  `);
  console.log('Active queries:', active.rows);

  const locks = await client.query(`
    SELECT pid, relation::regclass, mode, granted 
    FROM pg_locks 
    WHERE NOT granted;
  `);
  console.log('Waiting locks:', locks.rows);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
