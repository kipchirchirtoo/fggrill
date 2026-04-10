const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBranches() {
  console.log('🔍 Fetching all branches...\n');
  
  const { data: branches, error } = await supabase
    .from('branches')
    .select('id, name, location, address')
    .order('name');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📍 Available Branches:\n');
  branches.forEach((branch, index) => {
    console.log(`${index + 1}. ID: ${branch.id}`);
    console.log(`   Name: ${branch.name}`);
    console.log(`   Location: ${branch.location || 'N/A'}`);
    console.log(`   Address: ${branch.address || 'N/A'}`);
    console.log('');
  });
}

checkBranches()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
