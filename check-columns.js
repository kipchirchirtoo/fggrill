#!/usr/bin/env node

const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function checkColumns() {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const tables = ['bookings', 'restaurant_orders', 'finance_transactions', 'rooms', 'payments'];
  
  console.log('\nChecking branch_id column existence:\n');
  
  for (const table of tables) {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'branch_id'
      ) as has_branch_id
    `, [table]);
    
    const has = result.rows[0].has_branch_id;
    console.log(`${table.padEnd(25)} ${has ? '✅ HAS branch_id' : '❌ NO branch_id'}`);
  }

  await client.end();
}

checkColumns().catch(console.error);
