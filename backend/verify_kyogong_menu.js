const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyMenu() {
  console.log('🔍 Verifying Kyogong Restaurant Menu...\n');
  
  // Get branch info
  const { data: branch } = await supabase
    .from('branches')
    .select('id, name')
    .eq('id', 1)
    .single();

  console.log(`📍 Branch: ${branch.name} (ID: ${branch.id})\n`);

  // Get categories count
  const { data: categories, count: categoryCount } = await supabase
    .from('restaurant_menu_categories')
    .select('id, name', { count: 'exact' })
    .eq('branch_id', 1);

  console.log(`📂 Total Categories: ${categoryCount}`);
  console.log('Categories:');
  categories.forEach((cat, idx) => {
    console.log(`  ${idx + 1}. ${cat.name}`);
  });

  // Get menu items count
  const { count: itemCount } = await supabase
    .from('restaurant_menu_items')
    .select('*', { count: 'exact' })
    .eq('branch_id', 1);

  console.log(`\n🍽️  Total Menu Items: ${itemCount}`);

  // Sample items from each major category
  console.log('\n📋 Sample Items:');
  
  const sampleCategories = ['STARTERS', 'BEEF BOILED', 'CHOMAZONE', 'PIZZA', 'TEA'];
  
  for (const catName of sampleCategories) {
    const { data: category } = await supabase
      .from('restaurant_menu_categories')
      .select('id')
      .eq('name', catName)
      .eq('branch_id', 1)
      .maybeSingle();

    if (category) {
      const { data: items } = await supabase
        .from('restaurant_menu_items')
        .select('name, price')
        .eq('category_id', category.id)
        .limit(3);

      console.log(`\n  ${catName}:`);
      items.forEach(item => {
        console.log(`    • ${item.name} - KES ${item.price}`);
      });
    }
  }

  console.log('\n✅ Verification Complete!\n');
}

verifyMenu()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
