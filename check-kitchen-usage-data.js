const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkKitchenUsageData() {
  console.log('=== Kitchen Usage Data Check ===\n');

  try {
    // 1. Check branch stock
    console.log('1. Checking branch stock (items available for kitchen)...');
    const { data: branchStock, error: stockError } = await supabase
      .from('branch_stock')
      .select('*')
      .eq('branch_id', 2)  // Changed to branch 2
      .gt('quantity', 0);

    if (stockError) {
      console.error('Error fetching branch stock:', stockError);
    } else {
      console.log(`Found ${branchStock?.length || 0} items in branch stock`);
      if (branchStock && branchStock.length > 0) {
        console.log('\nSample items:');
        branchStock.slice(0, 3).forEach(item => {
          console.log(`  - SKU: ${item.item_sku}, Qty: ${item.quantity}, Unit: ${item.unit || 'N/A'}`);
        });
      } else {
        console.log('⚠️  NO ITEMS IN BRANCH STOCK - This is why dropdown is empty!');
        console.log('   Solution: Add items to branch stock first');
      }
    }

    console.log('\n---\n');

    // 2. Check simple_items for names
    if (branchStock && branchStock.length > 0) {
      console.log('2. Checking item names from simple_items...');
      const skus = branchStock.map(s => s.item_sku);
      const { data: items, error: itemsError } = await supabase
        .from('simple_items')
        .select('sku, item_name, category')
        .in('sku', skus);

      if (itemsError) {
        console.error('Error fetching items:', itemsError);
      } else {
        console.log(`Found ${items?.length || 0} item names`);
        if (items && items.length > 0) {
          items.slice(0, 3).forEach(item => {
            console.log(`  - ${item.sku}: ${item.item_name} (${item.category || 'No category'})`);
          });
        }
      }
    }

    console.log('\n---\n');

    // 3. Check kitchen usage records
    console.log('3. Checking existing kitchen usage records...');
    const { data: records, error: recordsError } = await supabase
      .from('kitchen_usage_records')
      .select('*')
      .eq('branch_id', 2)  // Changed to branch 2
      .order('created_at', { ascending: false })
      .limit(5);

    if (recordsError) {
      console.error('Error fetching records:', recordsError);
    } else {
      console.log(`Found ${records?.length || 0} kitchen usage records`);
      if (records && records.length > 0) {
        console.log('\nRecent records:');
        records.forEach(record => {
          console.log(`  - ${record.item_sku}: ${record.received_quantity} received, ${record.remaining_quantity} remaining (${record.status})`);
        });
      }
    }

    console.log('\n---\n');

    // 4. Check if user has branch_id
    console.log('4. Checking test user (KIPKEMOI)...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name, role, branch_id')
      .eq('id', '00286463-c34a-47f6-ab5b-7ca0f6146cca')
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
    } else if (user) {
      console.log(`User: ${user.first_name} ${user.last_name}`);
      console.log(`Role: ${user.role}`);
      console.log(`Branch ID: ${user.branch_id || 'NOT SET ⚠️'}`);
      
      if (!user.branch_id) {
        console.log('\n⚠️  USER HAS NO BRANCH_ID - This will cause API to fail!');
      }
    }

    console.log('\n=== Summary ===');
    console.log('✓ Backend database connection: OK');
    console.log(`✓ Branch stock items: ${branchStock?.length || 0}`);
    console.log(`✓ Kitchen usage records: ${records?.length || 0}`);
    console.log(`✓ User branch_id: ${user?.branch_id ? 'SET' : 'NOT SET'}`);

    if (!branchStock || branchStock.length === 0) {
      console.log('\n🔧 ACTION REQUIRED:');
      console.log('   1. Add items to branch_stock table for branch_id = 1');
      console.log('   2. Or dispatch items from central store to branch');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkKitchenUsageData();
