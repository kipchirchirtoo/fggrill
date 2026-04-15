const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('Connected\n');
    
    const alters = [
      `ALTER TABLE staff_advances ADD COLUMN IF NOT EXISTS deducted_in_payroll_id INTEGER`,
      `ALTER TABLE unpaid_bills ADD COLUMN IF NOT EXISTS remarks TEXT`,
      `ALTER TABLE unpaid_bills ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2)`,
      `ALTER TABLE unpaid_bills ADD COLUMN IF NOT EXISTS bill_date DATE`,
      `ALTER TABLE unpaid_bills ADD COLUMN IF NOT EXISTS staff_id INTEGER`,
      `ALTER TABLE folio_transactions ADD COLUMN IF NOT EXISTS type VARCHAR(50)`
    ];
    
    for (let i = 0; i < alters.length; i++) {
      try {
        await client.query(alters[i]);
        console.log(`✓ ${i + 1}. ${alters[i].substring(0, 60)}...`);
      } catch (error) {
        console.error(`✗ ${i + 1}. ${alters[i].substring(0, 60)}...`);
        console.error(`   Error: ${error.message}`);
        console.error(`   Where: ${error.where}`);
        break;
      }
    }
    
  } catch (error) {
    console.error('Connection error:', error.message);
  } finally {
    await client.end();
  }
}

test();
