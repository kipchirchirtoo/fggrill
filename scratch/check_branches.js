require('dotenv').config({ path: '/home/allansamuel/Desktop/fggrill/backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('branches').select('*');
  console.log(data);
}
run();
