require('dotenv').config({ path: '/home/allansamuel/Desktop/fggrill/backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  let res1 = await supabase.from('branch_stock').select('*').limit(1);
  console.log("branch_stock", res1.data);
  let res2 = await supabase.from('branch_stock_movements').select('*').limit(1);
  console.log("branch_stock_movements", res2.data);
}
run();
