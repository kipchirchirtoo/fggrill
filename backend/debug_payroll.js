const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('payroll_runs')
    .select('id, month, year, status')
    .eq('month', 3)
    .eq('year', 2026);
  
  if (error) {
    console.error('Error fetching payroll runs:', error);
    return;
  }
  
  console.log('Payroll runs for March 2026:', data);
  
  const { data: allDrafts, error: draftError } = await supabase
    .from('payroll_runs')
    .select('id, month, year, status')
    .eq('status', 'draft');
    
  console.log('All current drafts:', allDrafts);
}

check();
