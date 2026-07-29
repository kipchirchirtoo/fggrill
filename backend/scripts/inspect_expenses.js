const { supabase } = require('../dist/config/supabase');

async function inspectExpenses() {
  const { data, error } = await supabase
    .from('shift_reconciliation_expenses')
    .select('*, recorded_by_user:users!recorded_by(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching expenses:', error);
    return;
  }
  console.log('Total expenses retrieved:', data ? data.length : 0);
  console.log('Sample expenses:', JSON.stringify(data, null, 2));
}

inspectExpenses();
