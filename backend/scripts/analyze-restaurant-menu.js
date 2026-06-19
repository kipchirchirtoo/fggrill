const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeRestaurantMenu() {
  console.log('='.repeat(80));
  console.log('ANALYZING RESTAURANT MENU ITEMS');
  console.log('='.repeat(80));

  // Get all menu items
  const { data: items, error } = await supabase
    .from('restaurant_menu_items')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching menu items:', error);
    return;
  }

  console.log(`\nTotal Menu Items: ${items.length}\n`);

  // Group by category
  const byCategory = items.reduce((acc, item) => {
    const cat = item.category || 'UNCATEGORIZED';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // Display by category
  for (const [category, categoryItems] of Object.entries(byCategory).sort()) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`CATEGORY: ${category} (${categoryItems.length} items)`);
    console.log('='.repeat(80));
    
    categoryItems.forEach(item => {
      console.log(`\n  Name: ${item.name}`);
      console.log(`  Price: KES ${item.price || 0}`);
      console.log(`  Available: ${item.is_available ? 'YES' : 'NO'}`);
      console.log(`  Branch: ${item.branch_id || 'ALL'}`);
      console.log(`  ID: ${item.id}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('CATEGORY SUMMARY');
  console.log('='.repeat(80));
  Object.entries(byCategory).sort().forEach(([cat, items]) => {
    console.log(`${cat}: ${items.length} items`);
  });
  
  console.log('\n' + '='.repeat(80));
}

analyzeRestaurantMenu()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
