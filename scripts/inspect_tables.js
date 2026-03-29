const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const tables = process.argv.slice(2);
if (tables.length === 0) {
  console.error('Please provide table names as arguments');
  process.exit(1);
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    for (const table of tables) {
      console.log(`\nTABLE: ${table}`);
      const res = await client.query(`
        SELECT 
          column_name, 
          data_type, 
          is_nullable, 
          column_default 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1 
        ORDER BY ordinal_position
      `, [table]);
      
      if (res.rows.length === 0) {
        console.log('  No columns found (table might not exist)');
      } else {
        res.rows.forEach(r => {
          console.log(`  - ${r.column_name} (${r.data_type}, ${r.is_nullable}, default: ${r.column_default})`);
        });
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
