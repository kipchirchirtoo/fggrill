require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkRemaining() {
  try {
    console.log('Checking remaining records with NULL staff_id...\n');
    
    // Credit bills
    const creditBills = await pool.query(`
      SELECT id, description, amount, date, is_paid
      FROM staff_credit_bills
      WHERE staff_id IS NULL
      ORDER BY date DESC;
    `);

    console.log(`Credit Bills with NULL staff_id (${creditBills.rows.length}):`);
    creditBills.rows.forEach((row, idx) => {
      console.log(`\n${idx + 1}. ID: ${row.id.substring(0, 8)}`);
      console.log(`   Date: ${row.date.toISOString().split('T')[0]}`);
      console.log(`   Description: ${row.description}`);
      console.log(`   Amount: ${row.amount}`);
      console.log(`   Status: ${row.is_paid ? 'Paid' : 'Unpaid'}`);
    });

    // Advances
    const advances = await pool.query(`
      SELECT id, reason, amount, request_date, status
      FROM staff_advances
      WHERE staff_id IS NULL
      ORDER BY request_date DESC;
    `);

    console.log(`\n\nAdvances with NULL staff_id (${advances.rows.length}):`);
    advances.rows.forEach((row, idx) => {
      console.log(`\n${idx + 1}. ID: ${row.id.substring(0, 8)}`);
      console.log(`   Date: ${row.request_date.toISOString().split('T')[0]}`);
      console.log(`   Reason: ${row.reason}`);
      console.log(`   Amount: ${row.amount}`);
      console.log(`   Status: ${row.status}`);
    });

    // Loans
    const loans = await pool.query(`
      SELECT id, reason, total_amount, start_date, status
      FROM staff_loans
      WHERE staff_id IS NULL
      ORDER BY start_date DESC;
    `);

    console.log(`\n\nLoans with NULL staff_id (${loans.rows.length}):`);
    loans.rows.forEach((row, idx) => {
      console.log(`\n${idx + 1}. ID: ${row.id.substring(0, 8)}`);
      console.log(`   Date: ${row.start_date.toISOString().split('T')[0]}`);
      console.log(`   Reason: ${row.reason}`);
      console.log(`   Amount: ${row.total_amount}`);
      console.log(`   Status: ${row.status}`);
    });

    console.log('\n\nThese records need manual assignment of staff_id.');
    console.log('You can update them using the admin interface or SQL:');
    console.log('\nExample SQL:');
    console.log(`UPDATE staff_credit_bills SET staff_id = '<staff_uuid>' WHERE id = '<record_id>';`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkRemaining();
