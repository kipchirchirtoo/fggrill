const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const connectionString = process.env.DATABASE_URL.replace(':6543', ':5432');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    
    console.log('Checking active/idle transactions...');
    const result = await client.query(`
      SELECT pid, usename, state, query_start, query 
      FROM pg_stat_activity 
      WHERE state IN ('active', 'idle in transaction') 
        AND pid <> pg_backend_pid();
    `);
    
    console.log(`Found ${result.rows.length} active/idle transactions.`);
    for (const row of result.rows) {
      console.log(`- PID: ${row.pid} | State: ${row.state} | Start: ${row.query_start}`);
      console.log(`  Query: ${row.query.substring(0, 100)}...`);
    }

    // Kill idle in transaction queries
    const idleQuery = await client.query(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE state = 'idle in transaction' 
        AND pid <> pg_backend_pid();
    `);
    console.log(`Killed ${idleQuery.rowCount} idle in transaction backends.`);

    // Check blocking locks
    const locks = await client.query(`
      SELECT blocked_locks.pid AS blocked_pid,
             blocked_activity.usename AS blocked_user,
             blocking_locks.pid AS blocking_pid,
             blocking_activity.usename AS blocking_user,
             blocked_activity.query AS blocked_statement,
             blocking_activity.query AS current_statement_in_blocking_process
      FROM pg_catalog.pg_locks blocked_locks
      JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
      JOIN pg_catalog.pg_locks blocking_locks 
        ON blocking_locks.locktype = blocked_locks.locktype
        AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
        AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
        AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
        AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
        AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
        AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
        AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
        AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
        AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
        AND blocking_locks.pid != blocked_locks.pid
      JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
      WHERE NOT blocked_locks.granted;
    `);

    console.log(`Found ${locks.rows.length} blocked locks.`);
    for (const row of locks.rows) {
      console.log(`- Blocked PID: ${row.blocked_pid} | Blocking PID: ${row.blocking_pid}`);
      console.log(`  Blocking Query: ${row.current_statement_in_blocking_process.substring(0, 100)}...`);
      // Kill the blocking query
      await client.query(`SELECT pg_terminate_backend(${row.blocking_pid});`);
      console.log(`  Killed blocking PID ${row.blocking_pid}`);
    }

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await client.end();
  }
}
run();
