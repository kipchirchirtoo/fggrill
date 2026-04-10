const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOMET_TOWN_BRANCH_ID = 2;
const KYOGONG_BRANCH_ID = 1;

async function fixMenu() {
  console.log('🔧 Fixing Kyogong Menu...\n');

  try {
    // Step 1: Delete wrong items from Bomet Town (branch 2)
    console.log('🗑️  Step 1: Removing incorrectly added items from BOMET TOWN (Branch 2)...');
    
    // Get categories that were created for branch 2
    const { data: wrongCategories } = await supabase
      .from('restaurant_menu_categories')
      .select('id, name')
      .eq('branch_id', BOMET_TOWN_BRANCH_ID);

    if (wrongCategories && wrongCategories.length > 0) {
      console.log(`   Found ${wrongCategories.length} categories to remove from Bomet Town`);
      
      // Delete items in these categories
      for (const cat of wrongCategories) {
        const { error: itemsError } = await supabase
          .from('restaurant_menu_items')
          .delete()
          .eq('category_id', cat.id);
        
        if (!itemsError) {
          console.log(`   ✓ Deleted items from category: ${cat.name}`);
        }
      }

      // Delete the categories
      const { error: catError } = await supabase
        .from('restaurant_menu_categories')
        .delete()
        .eq('branch_id', BOMET_TOWN_BRANCH_ID);

      if (!catError) {
        console.log(`   ✓ Deleted ${wrongCategories.length} categories from Bomet Town`);
      }
    } else {
      console.log('   ℹ️  No items found in Bomet Town to remove');
    }

    console.log('\n✅ Cleanup complete!\n');
    console.log('📝 Now run: node populate_kyogong_menu.js');
    console.log('   This will populate the menu for Kyogong (Branch 1)\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

fixMenu()
  .then(() => {
    console.log('✨ Fix completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fix failed:', error);
    process.exit(1);
  });
