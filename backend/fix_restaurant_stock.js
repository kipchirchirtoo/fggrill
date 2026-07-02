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
  
  const ipv4 = await new Promise((resolve, reject) => {
    dns.lookup(parsed.hostname, { family: 4 }, (err, address) => {
      if (err) reject(err);
      else resolve(address);
    });
  });

  parsed.hostname = ipv4;
  const client = new Client({
    connectionString: parsed.toString(),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // First let's find the restaurant outlets
    const outlets = await client.query(`
      SELECT id, name FROM pos_outlets 
      WHERE name ILIKE '%restaurant%' OR outlet_code ILIKE '%RESTAURANT%' OR outlet_type ILIKE '%restaurant%'
    `);
    console.log(`Found ${outlets.rows.length} restaurant outlets.`);
    
    if (outlets.rows.length === 0) {
      console.log('No restaurant outlets found!');
      return;
    }

    const outletIds = outlets.rows.map(o => o.id);
    
    // Begin transaction
    await client.query('BEGIN');

    // Update the items
    const updateResult = await client.query(`
      UPDATE pos_outlet_items
      SET current_stock = 9999,
          is_available = true,
          track_stock = false
      WHERE outlet_id = ANY($1::uuid[])
    `, [outletIds]);

    // Also update any menu_items that might be tied to restaurant categories directly just in case
    // menu_items also has is_stock_tracked, etc. 
    // Usually pos_outlet_items is what POS reads. Let's just update pos_outlet_items.

    await client.query('COMMIT');
    
    console.log(`✅ Successfully updated ${updateResult.rowCount} items across restaurant outlets to be available.`);
    
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Failed:', e);
  } finally {
    await client.end();
  }
}
run();
