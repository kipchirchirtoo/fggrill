const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('Testing RLS policies...\n');
    
    // Enable RLS
    await client.query(`ALTER TABLE staff_payroll_adjustments ENABLE ROW LEVEL SECURITY`);
    console.log('✓ Enabled RLS on staff_payroll_adjustments');
    
    await client.query(`ALTER TABLE staff_loans ENABLE ROW LEVEL SECURITY`);
    console.log('✓ Enabled RLS on staff_loans');
    
    // Create policies
    await client.query(`CREATE POLICY "staff_payroll_adjustments_select_policy" ON staff_payroll_adjustments FOR SELECT TO authenticated USING (true)`);
    console.log('✓ Created policy on staff_payroll_adjustments');
    
    await client.query(`CREATE POLICY "staff_loans_select_policy" ON staff_loans FOR SELECT TO authenticated USING (true)`);
    console.log('✓ Created policy on staff_loans');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Detail:', error.detail);
    console.error('Where:', error.where);
  } finally {
    await client.end();
  }
}

test();
