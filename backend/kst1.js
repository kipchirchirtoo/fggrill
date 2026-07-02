require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data, error } = await supabase
    .from('kitchen_stocktake_shifts')
    .select('id, branch_id, stocktake_date, shift, status, submitted_at, created_at')
    .order('stocktake_date', { ascending: false })
    .limit(15);
  if (error) { console.error('kitchen_stocktake_shifts error:', error.message); return; }
  console.log(JSON.stringify(data, null, 2));
})();
