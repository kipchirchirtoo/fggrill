const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixMissingItemNames() {
  console.log('=== Fixing Missing Item Names ===\n');

  const itemsToFix = [
    { sku: 'FGH-BEV-SODA-0001', name: 'Soda 500ml', category: 'Beverages' },
    { sku: 'FGH-BEV-TUSKER-0001', name: 'Tusker Beer 500ml', category: 'Beverages' },
    { sku: 'FGH-BAR-TUSKER-0001', name: 'Tusker Beer (Bar)', category: 'Bar Items' },
    { sku: 'FGH-BEV-WATER-0001', name: 'Bottled Water 500ml', category: 'Beverages' }
  ];

  try {
    for (const item of itemsToFix) {
      console.log(`\nProcessing ${item.sku}...`);

      // Check if item exists
      const { data: existing, error: checkError } = await supabase
        .from('simple_items')
        .select('sku, item_name, category')
        .eq('sku', item.sku)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error(`  Error checking item:`, checkError);
        continue;
      }

      if (existing) {
        // Update existing item
        console.log(`  Found existing item: "${existing.item_name}"`);
        
        if (existing.item_name === item.sku || !existing.item_name) {
          console.log(`  Updating to: "${item.name}"`);
          
          const { error: updateError } = await supabase
            .from('simple_items')
            .update({
              item_name: item.name,
              category: item.category
            })
            .eq('sku', item.sku);

          if (updateError) {
            console.error(`  Error updating:`, updateError);
          } else {
            console.log(`  ✓ Updated successfully`);
          }
        } else {
          console.log(`  Item already has a proper name, skipping`);
        }
      } else {
        // Insert new item
        console.log(`  Item doesn't exist, creating new entry...`);
        
        const { error: insertError } = await supabase
          .from('simple_items')
          .insert({
            sku: item.sku,
            item_name: item.name,
            description: item.name,
            category: item.category,
            unit_of_measure: 'units',
            retail_price: 0,
            cost_price: 0,
            is_active: true
          });

        if (insertError) {
          console.error(`  Error inserting:`, insertError);
        } else {
          console.log(`  ✓ Created successfully`);
        }
      }
    }

    console.log('\n=== Verification ===\n');
    
    // Verify the changes
    const { data: verified, error: verifyError } = await supabase
      .from('simple_items')
      .select('sku, item_name, category')
      .in('sku', itemsToFix.map(i => i.sku));

    if (verifyError) {
      console.error('Error verifying:', verifyError);
    } else {
      console.log('Updated items:');
      verified?.forEach(item => {
        console.log(`  ${item.sku}: ${item.item_name} (${item.category})`);
      });
    }

    console.log('\n✓ Done! Item names have been fixed.');
    console.log('Now restart the backend server and test the dropdown again.');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

fixMissingItemNames();
