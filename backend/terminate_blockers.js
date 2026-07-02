const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log("Connected to DB!");

  // Find all blocking PIDs that are causing other sessions to be blocked on pos_shift_orders
  const res = await client.query(`
    SELECT DISTINCT blocking_locks.pid AS pid
    FROM pg_catalog.pg_locks blocked_locks
    JOIN pg_catalog.pg_locks blocking_locks 
        ON blocking_locks.locktype = blocked_locks.locktype
        AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
        AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
        AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
        AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
        AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
        AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
        AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
        AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
        AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
        AND blocking_locks.pid != blocked_locks.pid
    WHERE NOT blocked_locks.granted;
  `);

  const pids = res.rows.map(r => r.pid);
  console.log("Found blocking PIDs:", pids);

  for (const pid of pids) {
    console.log(`Terminating backend session PID: ${pid}`);
    try {
      const termRes = await client.query(`SELECT pg_terminate_backend($1)`, [pid]);
      console.log(`- Terminate status for ${pid}:`, termRes.rows[0]);
    } catch (err) {
      console.error(`- Failed to terminate ${pid}:`, err.message);
    }
  }

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
