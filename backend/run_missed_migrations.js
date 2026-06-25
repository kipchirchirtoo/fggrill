const fs = require('fs');
const { Client } = require('pg');
const dns = require('dns');
const url = require('url');
require('dotenv').config();

async function run() {
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No DATABASE_URL found in .env');
    process.exit(1);
  }

  // Force port 5432
  connectionString = connectionString.replace(':6543', ':5432');
  
  const parsed = new url.URL(connectionString);
  
  // Hardcode known IPv4 to bypass intermittent DNS failures
  const ipv4 = '34.241.16.247';

  parsed.hostname = ipv4;
  
  const client = new Client({
    connectionString: parsed.toString(),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const filesToRun = [
      'C:\\Users\\user\\OneDrive\\Desktop\\fggrill\\backend\\database\\migrations\\20260625_atomic_pos_stock_decrement.sql',
      'C:\\Users\\user\\OneDrive\\Desktop\\fggrill\\backend\\database\\migrations\\20260625_void_total_at_cashier_ack.sql'
    ];
    
    for (const sqlPath of filesToRun) {
      if (fs.existsSync(sqlPath)) {
        console.log('Running ' + sqlPath + ' ...');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);
      } else {
        console.log('Skipping ' + sqlPath + ' - not found.');
      }
    }
    
    console.log('Reloading PostgREST schema cache...');
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log('✅ Migrations completed & Schema reloaded.');
  } catch (e) {
    console.error('❌ Migration failed:', e);
  } finally {
    await client.end();
  }
}
run();
