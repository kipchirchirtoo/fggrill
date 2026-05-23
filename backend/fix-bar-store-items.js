#!/usr/bin/env node
/**
 * Fix Bar Store Items Classification
 * 
 * This script reclassifies items that are wrongly tagged as bar_store.
 * Only genuine bar items (alcohol, soda, water, bar mixers) should be in bar_store.
 * 
 * Usage:
 *   cd backend && node fix-bar-store-items.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: SUPABASE_PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Keywords that indicate bar items
const barKeywords = [
  // Alcohol
  'beer', 'wine', 'whiskey', 'whisky', 'vodka', 'gin', 'rum', 'brandy', 'tequila', 'cognac',
  'champagne', 'liqueur', 'schnapps', 'bourbon', 'scotch', 'soda', 'tonic', 'mixer',
  // Specific brands
  'tusker', 'guinness', 'smirnoff', 'hennessy', 'jameson', 'jack daniels', 'johnnie walker',
  'baileys', 'gilbeys', 'savanna', 'pilsner', 'whitecap', 'castle', 'klipdrift',
  // Soft drinks
  'coke', 'coca cola', 'pepsi', 'sprite', 'fanta', 'krest', 'stoney', 'novida', 'ginger ale',
  'bitter lemon', 'dry lemon', 'limca', '7up', 'mountain dew',
  // Water & mixers
  'water', 'dasani', 'aquafina', 'keringet', 'evian', 'perrier', 'soda water',
  'tonic water', 'ginger beer', 'cranberry', 'orange juice', 'pineapple juice',
  // Bar supplies
  'syrup', 'grenadine', 'bitters', 'vermouth', 'olive', 'cherry', 'lemon', 'lime',
  'ice', 'straw', 'napkin', 'coaster', 'corkscrew', 'shaker'
];

// Keywords that indicate FOOD items (should NOT be in bar_store)
const foodKeywords = [
  'flour', 'sugar', 'rice', 'salt', 'oil', 'maize', 'meal', 'beans', 'lentils',
  'beef', 'chicken', 'fish', 'meat', 'pork', 'mutton', 'goat', 'lamb',
  'potato', 'tomato', 'onion', 'garlic', 'ginger', 'vegetable', 'fruit',
  'mango', 'apple', 'banana', 'orange', 'pineapple', 'watermelon', 'grape',
  'bread', 'butter', 'egg', 'milk', 'cheese', 'yogurt', 'cream',
  'spice', 'pepper', 'cumin', 'coriander', 'turmeric', 'paprika', 'cinnamon',
  'pasta', 'noodle', 'spaghetti', 'macaroni', 'rice', 'pilau',
  'breakfast', 'lunch', 'dinner', 'snack', 'dessert'
];

function isBarItem(name, description = '') {
  const text = `${name} ${description}`.toLowerCase();
  
  // Check food keywords first - if it matches food, it's definitely NOT bar
  for (const keyword of foodKeywords) {
    if (text.includes(keyword)) {
      return false; // Food item, not bar
    }
  }
  
  // Check bar keywords
  for (const keyword of barKeywords) {
    if (text.includes(keyword)) {
      return true; // Bar item
    }
  }
  
  return false; // Default to not bar
}

async function fixBarStoreItems() {
  console.log('🔍 Fetching bar_store items...\n');
  
  const { data: items, error } = await supabase
    .from('simple_items')
    .select('sku, item_name, description, store_type, category')
    .eq('store_type', 'bar_store')
    .eq('is_active', true);
  
  if (error) {
    console.error('❌ Error fetching items:', error.message);
    process.exit(1);
  }
  
  if (!items || items.length === 0) {
    console.log('ℹ️  No bar_store items found');
    return;
  }
  
  console.log(`📦 Found ${items.length} items in bar_store\n`);
  
  const wrongItems = [];
  const correctItems = [];
  
  for (const item of items) {
    const isBar = isBarItem(item.item_name || '', item.description || '');
    if (isBar) {
      correctItems.push(item);
    } else {
      wrongItems.push(item);
    }
  }
  
  console.log('✅ Correct bar items:', correctItems.length);
  console.log('❌ Wrongly classified items:', wrongItems.length);
  console.log('');
  
  if (wrongItems.length === 0) {
    console.log('🎉 All items are correctly classified!');
    return;
  }
  
  console.log('Items being reclassified to foodstuffs:');
  console.log('─'.repeat(60));
  wrongItems.forEach(item => {
    console.log(`  • ${item.item_name || item.sku}`);
  });
  console.log('─'.repeat(60));
  console.log('');
  
  // Update wrongly classified items
  const skuList = wrongItems.map(i => i.sku);
  
  const { data: updated, error: updateError } = await supabase
    .from('simple_items')
    .update({ 
      store_type: 'foodstuffs',
      last_updated: new Date().toISOString()
    })
    .in('sku', skuList)
    .select('sku, item_name');
  
  if (updateError) {
    console.error('❌ Error updating items:', updateError.message);
    process.exit(1);
  }
  
  console.log(`✅ Successfully reclassified ${updated.length} items to foodstuffs\n`);
  
  // Summary
  console.log('📊 Summary:');
  console.log(`   Total bar_store items: ${items.length}`);
  console.log(`   Correctly classified: ${correctItems.length}`);
  console.log(`   Reclassified to foodstuffs: ${wrongItems.length}`);
  console.log(`   Current bar_store count: ${correctItems.length}\n`);
  
  // List remaining bar items
  if (correctItems.length > 0) {
    console.log('🍺 Genuine bar items remaining:');
    console.log('─'.repeat(60));
    correctItems.slice(0, 20).forEach(item => {
      console.log(`  • ${item.item_name || item.sku}`);
    });
    if (correctItems.length > 20) {
      console.log(`  ... and ${correctItems.length - 20} more`);
    }
    console.log('─'.repeat(60));
  }
  
  console.log('\n🎉 Bar store fix complete!');
  console.log('   Refresh the Central Store → Bar & Beverages page to see changes.');
}

console.log('╔'.repeat(60));
console.log('║  FIX BAR STORE ITEMS CLASSIFICATION');
console.log('╚'.repeat(60) + '\n');

fixBarStoreItems().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
