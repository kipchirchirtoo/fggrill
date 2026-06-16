require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  try {
    console.log('Testing stock_takes query...');
    const { data, error } = await supabase
      .from('stock_takes')
      .select('*')
      .eq('branch_id', 2)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Query error:', error.message, error.code);
      return;
    }
    console.log('Success:', data.length, 'records');
    
    if (data.length > 0) {
      const branchIds = [...new Set(data.map(s => s.branch_id).filter(Boolean))];
      const { data: branches, error: bErr } = await supabase
        .from('branches')
        .select('id, name')
        .in('id', branchIds);
      if (bErr) console.error('Branches error:', bErr.message);
      else console.log('Branches fetched:', branches.length);
    }
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

test();
