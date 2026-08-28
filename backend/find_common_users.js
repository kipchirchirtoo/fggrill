const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'verify_live_shift_mode.env') });

const prodConnectionString = process.env.DATABASE_URL_PRODUCTION_POOLER_APPROVED;
const devConnectionString = process.env.DATABASE_URL_DEV_DEMO;

async function main() {
  const prodPool = new Pool({ connectionString: prodConnectionString });
  const devPool = new Pool({ connectionString: devConnectionString });

  try {
    const prodClient = await prodPool.connect();
    const devClient = await devPool.connect();

    const prodUsers = (await prodClient.query('SELECT id, email, role, branch_id FROM users')).rows;
    const devUsers = (await devClient.query('SELECT id, email, role, branch_id FROM users')).rows;

    const devEmails = new Set(devUsers.map(u => u.email.toLowerCase()));
    const common = prodUsers.filter(u => devEmails.has(u.email.toLowerCase()));

    console.log('Common users between PROD and DEV:');
    console.log(JSON.stringify(common, null, 2));

    prodClient.release();
    devClient.release();
  } catch (err) {
    console.error('Error finding common users:', err.message);
  } finally {
    await prodPool.end();
    await devPool.end();
  }
}

main();
