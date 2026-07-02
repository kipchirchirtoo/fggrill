require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data, error } = await supabase.from('stock_counts').select('*').limit(1);
  if (error) { console.error(error.message); return; }
  console.log('stock_counts columns:', data[0] ? Object.keys(data[0]) : 'no rows - trying insert-shape check');

  const { data: all, error: e2 } = await supabase.from('stock_counts').select('id, branch_id, count_date, location, store_type, status, created_at, updated_at').order('created_at', {ascending:false}).limit(10);
  console.log(JSON.stringify(all, null, 2), e2?.message);
})();
