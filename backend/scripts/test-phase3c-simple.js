const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('Connected');
    
    // Try creating just the tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_payroll_adjustments (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER NOT NULL,
        branch_id INTEGER NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    console.log('✓ staff_payroll_adjustments created');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_loans (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER NOT NULL,
        branch_id INTEGER NOT NULL,
        loan_number VARCHAR(50) UNIQUE NOT NULL,
        principal_amount NUMERIC(12, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    console.log('✓ staff_loans created');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Detail:', error.detail);
    console.error('Hint:', error.hint);
  } finally {
    await client.end();
  }
}

test();
