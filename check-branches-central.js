const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, code, is_central_warehouse, is_main_branch, status');
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('All branches:');
  console.table(data);
  const central = data?.filter(b => b.is_central_warehouse);
  console.log('Central warehouse branches:', central?.length ?? 0, central);
}

main().catch(console.error);
