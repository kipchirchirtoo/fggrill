const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://utsvlihpudfraxzcmtle.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY'
);

async function diagnose() {
  console.log('=== DEEP PAYROLL DIAGNOSIS ===\n');

  // 1. Check credit_bills table (cashier uses this, not staff_credit_bills)
  const { data: cb, error: cbErr } = await supabase
    .from('credit_bills')
    .select('*')
    .limit(5);
  console.log('credit_bills table:');
  if (cbErr) console.log('  ERROR:', cbErr.message);
  else {
    console.log('  count:', cb?.length);
    if (cb?.[0]) console.log('  columns:', Object.keys(cb[0]));
    console.log('  sample:', JSON.stringify(cb?.[0], null, 2));
  }

  // 2. Check staff_credit_bills with staff_id NOT null
  const { data: scb, error: scbErr } = await supabase
    .from('staff_credit_bills')
    .select('*')
    .not('staff_id', 'is', null)
    .limit(5);
  console.log('\nstaff_credit_bills with staff_id set:');
  if (scbErr) console.log('  ERROR:', scbErr.message);
  else console.log('  count:', scb?.length, '\n  data:', JSON.stringify(scb, null, 2));

  // 3. Check staff_advances with staff_id NOT null
  const { data: adv, error: advErr } = await supabase
    .from('staff_advances')
    .select('*')
    .not('staff_id', 'is', null)
    .limit(5);
  console.log('\nstaff_advances with staff_id set:');
  if (advErr) console.log('  ERROR:', advErr.message);
  else console.log('  count:', adv?.length, '\n  data:', JSON.stringify(adv, null, 2));

  // 4. Check staff_loans with staff_id NOT null
  const { data: loans, error: loansErr } = await supabase
    .from('staff_loans')
    .select('*')
    .not('staff_id', 'is', null)
    .limit(5);
  console.log('\nstaff_loans with staff_id set:');
  if (loansErr) console.log('  ERROR:', loansErr.message);
  else console.log('  count:', loans?.length, '\n  data:', JSON.stringify(loans, null, 2));

  // 5. Check staff_profiles to get actual staff IDs
  const { data: staff, error: staffErr } = await supabase
    .from('staff_profiles')
    .select('id, first_name, last_name, role, status')
    .eq('status', 'active')
    .limit(5);
  console.log('\nActive staff_profiles (first 5):');
  if (staffErr) console.log('  ERROR:', staffErr.message);
  else console.log('  count:', staff?.length, '\n  data:', JSON.stringify(staff, null, 2));

  // 6. Check existing payroll records
  const { data: payroll, error: payrollErr } = await supabase
    .from('staff_payroll')
    .select('staff_id, month, year, total_credit_bills, total_advances, loan_deduction, paye, total_deductions, net_pay')
    .order('generated_at', { ascending: false })
    .limit(5);
  console.log('\nRecent staff_payroll records:');
  if (payrollErr) console.log('  ERROR:', payrollErr.message);
  else console.log('  count:', payroll?.length, '\n  data:', JSON.stringify(payroll, null, 2));

  // 7. Check cashier_logbook_lines for credit bills
  const { data: logLines, error: llErr } = await supabase
    .from('cashier_logbook_lines')
    .select('*')
    .eq('section', 'credit_bill')
    .limit(5);
  console.log('\ncashier_logbook_lines (credit_bill section):');
  if (llErr) console.log('  ERROR:', llErr.message);
  else {
    console.log('  count:', logLines?.length);
    if (logLines?.[0]) console.log('  columns:', Object.keys(logLines[0]));
    console.log('  data:', JSON.stringify(logLines, null, 2));
  }
}

diagnose().catch(console.error);
