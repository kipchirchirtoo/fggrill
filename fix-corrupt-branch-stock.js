const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixCorruptBranchStock() {
  console.log('=== Fixing Corrupt Branch Stock Data ===\n');

  try {
    // Find all corrupt records
    const { data: corruptRecords, error } = await supabase
      .from('branch_stock')
      .select('*')
      .or('item_sku.like.%(%)%,item_sku.like.%available%');

    if (error) {
      console.error('Error finding corrupt records:', error);
      return;
    }

    console.log(`Found ${corruptRecords?.length || 0} corrupt records\n`);

    if (corruptRecords && corruptRecords.length > 0) {
      console.log('Corrupt records:');
      corruptRecords.forEach(record => {
        console.log(`  ID: ${record.id}, SKU: "${record.item_sku}", Qty: ${record.quantity}, Branch: ${record.branch_id}`);
      });

      console.log('\n⚠️  These records have invalid SKUs and should be deleted or fixed manually.');
      console.log('\nTo delete them, run:');
      console.log('DELETE FROM branch_stock WHERE item_sku LIKE \'%(%)%\' OR item_sku LIKE \'%available%\';');
    } else {
      console.log('✓ No corrupt records found');
    }

    // Show valid records for branch 2
    console.log('\n--- Valid records for branch 2 ---');
    const { data: validRecords } = await supabase
      .from('branch_stock')
      .select(`
        id,
        item_sku,
        quantity,
        unit
      `)
      .eq('branch_id', 2)
      .not('item_sku', 'like', '%(%)%')
      .not('item_sku', 'like', '%available%')
      .gt('quantity', 0)
      .order('item_sku');

    console.log(`Found ${validRecords?.length || 0} valid records`);
    
    if (validRecords && validRecords.length > 0) {
      validRecords.slice(0, 10).forEach(record => {
        console.log(`  ${record.item_sku}: ${record.quantity} ${record.unit || 'units'}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

fixCorruptBranchStock();
