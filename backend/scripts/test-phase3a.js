const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client } = require('pg');

async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('Connected');
    
    // Check if branches table exists
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'branches'
      )
    `);
    
    console.log('Branches table exists:', result.rows[0].exists);
    
    if (result.rows[0].exists) {
      const cols = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'branches'
      `);
      console.log('Columns:', cols.rows.map(r => r.column_name));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

test();
