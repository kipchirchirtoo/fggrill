const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/allansamuel/Desktop/fggrill/backend/.env' });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStock() {
  const { data: centralBranch, error: err } = await supabase.from('branches').select('id, name').eq('is_central_warehouse', true).single();
  console.log("Central:", centralBranch);

  const { data: branchStock } = await supabase.from('branch_stock').select('*').eq('branch_id', centralBranch?.id).limit(2);
  console.log("Branch Stock (Central):", branchStock);
  
  const { data: simpleItems } = await supabase.from('simple_items').select('sku, quantity').limit(2);
  console.log("Simple Items (Central?):", simpleItems);
}

checkStock();
