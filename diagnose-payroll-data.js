const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://utsvlihpudfraxzcmtle.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY'
);

async function diagnose() {
  console.log('=== DIAGNOSING PAYROLL DATA ===\n');

  // 1. Check staff_credit_bills
  const { data: bills, error: billsErr } = await supabase
    .from('staff_credit_bills')
    .select('*')
    .limit(10);
  console.log('staff_credit_bills (first 10):');
  if (billsErr) console.log('  ERROR:', billsErr.message);
  else console.log('  count:', bills?.length, '\n  sample:', JSON.stringify(bills?.[0], null, 2));

  // 2. Check unpaid bills
  const { data: unpaid, error: unpaidErr } = await supabase
    .from('staff_credit_bills')
    .select('id, staff_id, amount, balance, is_paid, payroll_id, status')
    .eq('is_paid', false)
    .limit(10);
  console.log('\nUnpaid credit bills (is_paid=false):');
  if (unpaidErr) console.log('  ERROR:', unpaidErr.message);
  else console.log('  count:', unpaid?.length, '\n  data:', JSON.stringify(unpaid, null, 2));

  // 3. Check staff_advances
  const { data: advances, error: advErr } = await supabase
    .from('staff_advances')
    .select('id, staff_id, amount, status, payroll_id')
    .limit(10);
  console.log('\nstaff_advances (first 10):');
  if (advErr) console.log('  ERROR:', advErr.message);
  else console.log('  count:', advances?.length, '\n  data:', JSON.stringify(advances, null, 2));

  // 4. Check staff_loans
  const { data: loans, error: loansErr } = await supabase
    .from('staff_loans')
    .select('id, staff_id, monthly_installment, status')
    .limit(10);
  console.log('\nstaff_loans (first 10):');
  if (loansErr) console.log('  ERROR:', loansErr.message);
  else console.log('  count:', loans?.length, '\n  data:', JSON.stringify(loans, null, 2));

  // 5. Check unpaid_bills
  const { data: unpaidBills, error: ubErr } = await supabase
    .from('unpaid_bills')
    .select('id, waiter_id, total_amount, balance_amount, status')
    .limit(10);
  console.log('\nunpaid_bills (first 10):');
  if (ubErr) console.log('  ERROR:', ubErr.message);
  else console.log('  count:', unpaidBills?.length, '\n  data:', JSON.stringify(unpaidBills, null, 2));

  // 6. Check staff_payroll_adjustments
  const { data: adjs, error: adjErr } = await supabase
    .from('staff_payroll_adjustments')
    .select('id, staff_id, type, category, amount, status')
    .eq('status', 'pending')
    .limit(10);
  console.log('\nstaff_payroll_adjustments (pending, first 10):');
  if (adjErr) console.log('  ERROR:', adjErr.message);
  else console.log('  count:', adjs?.length, '\n  data:', JSON.stringify(adjs, null, 2));

  // 7. Check columns of staff_credit_bills
  const { data: colCheck, error: colErr } = await supabase
    .from('staff_credit_bills')
    .select('*')
    .limit(1);
  if (!colErr && colCheck?.[0]) {
    console.log('\nstaff_credit_bills columns:', Object.keys(colCheck[0]));
  }
}

diagnose().catch(console.error);
