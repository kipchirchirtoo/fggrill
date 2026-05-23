const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/allansamuel/Desktop/fggrill/backend/.env' });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getKyogongBranch() {
  const { data, error } = await supabase.from('branches').select('*').ilike('name', '%Kyogong%');
  console.log(data, error);
}

getKyogongBranch();
