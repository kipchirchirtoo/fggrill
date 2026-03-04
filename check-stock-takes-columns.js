const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function checkColumns() {
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'stock_takes' 
      ORDER BY ordinal_position
    `);
    
    console.log('Stock-takes table columns:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name} (${row.data_type})`);
    });
    
    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkColumns();
