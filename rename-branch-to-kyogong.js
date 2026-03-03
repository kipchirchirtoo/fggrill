const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function renameBranchToKyogong() {
  console.log('🏨 Renaming branch "Famous Gates Hotels" to "Kyogong"...\n');

  try {
    // First, find the branch named "Famous Gates Hotels"
    const { data: branches, error: fetchError } = await supabase
      .from('branches')
      .select('*')
      .ilike('name', '%Famous Gates Hotels%');

    if (fetchError) {
      console.error('❌ Error fetching branches:', fetchError);
      return;
    }

    if (!branches || branches.length === 0) {
      console.log('⚠️  No branch found with name "Famous Gates Hotels"');
      console.log('\n📋 Let me show you all branches:\n');
      
      const { data: allBranches } = await supabase
        .from('branches')
        .select('*')
        .order('name');
      
      if (allBranches) {
        allBranches.forEach(branch => {
          console.log(`   ID: ${branch.id} | Name: ${branch.name} | Location: ${branch.location || 'N/A'}`);
        });
      }
      return;
    }

    console.log(`✅ Found ${branches.length} branch(es) to rename:\n`);
    branches.forEach(branch => {
      console.log(`   ID: ${branch.id}`);
      console.log(`   Current Name: ${branch.name}`);
      console.log(`   Location: ${branch.location || 'N/A'}`);
      console.log(`   Is Central: ${branch.is_central ? 'Yes' : 'No'}`);
      console.log('');
    });

    // Update the branch name to "Kyogong"
    for (const branch of branches) {
      const { data: updated, error: updateError } = await supabase
        .from('branches')
        .update({ 
          name: 'Kyogong',
          updated_at: new Date().toISOString()
        })
        .eq('id', branch.id)
        .select();

      if (updateError) {
        console.error(`❌ Error updating branch ${branch.id}:`, updateError);
      } else {
        console.log(`✅ Successfully renamed branch ${branch.id} to "Kyogong"`);
      }
    }

    console.log('\n✅ Branch rename complete!');
    console.log('\n📋 Updated branches:\n');
    
    const { data: updatedBranches } = await supabase
      .from('branches')
      .select('*')
      .eq('name', 'Kyogong');
    
    if (updatedBranches) {
      updatedBranches.forEach(branch => {
        console.log(`   ID: ${branch.id} | Name: ${branch.name} | Location: ${branch.location || 'N/A'}`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

renameBranchToKyogong();
