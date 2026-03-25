const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './backend/.env' });

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected\n');

    const sql = fs.readFileSync(
      path.join(__dirname, 'backend/src/database/migrations/20260324_fix_credit_bills_schema.sql'),
      'utf8'
    );
    await client.query(sql);
    console.log('✅ Migration applied\n');

    // Verify
    const check = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name IN ('staff_credit_bills','staff_advances','staff_loans')
      AND column_name IN ('status','bill_date','deducted_in_payroll_id','advance_date','month_to_deduct','year_to_deduct','installment_amount','loan_date','start_deduction_month','start_deduction_year')
      ORDER BY table_name, column_name
    `);
    console.log('New columns confirmed:', check.rows.map(r => r.column_name).join(', '));
    console.log('\n🎉 Done!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
