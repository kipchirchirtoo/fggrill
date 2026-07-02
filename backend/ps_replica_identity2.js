const { Client } = require('pg');
const tables = ['branches','pos_outlets','pos_shift_orders','pos_shift_payments'];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const client = new Client({ connectionString: process.argv[2], ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query("SET lock_timeout = '4s'");
  await client.query("SET statement_timeout = '10s'");
  const stillFailing = [];
  for (const t of tables) {
    let done = false;
    for (let attempt = 1; attempt <= 4 && !done; attempt++) {
      try {
        await client.query(`ALTER TABLE public.${t} REPLICA IDENTITY FULL`);
        console.log('OK', t, 'on attempt', attempt);
        done = true;
      } catch (e) {
        console.log('attempt', attempt, 'failed for', t, '-', e.message);
        if (attempt < 4) await sleep(3000);
      }
    }
    if (!done) stillFailing.push(t);
  }
  console.log('STILL FAILING:', stillFailing.join(', ') || 'none');
  await client.end();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
