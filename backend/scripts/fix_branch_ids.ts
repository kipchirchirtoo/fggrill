
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixBranchIds() {
  console.log('Starting branch_id fix...');

  // 1. Get a default branch (ID 1 or first found)
  const { data: branches, error: branchError } = await supabase
    .from('branches')
    .select('id')
    .order('id', { ascending: true })
    .limit(1);

  if (branchError || !branches || branches.length === 0) {
    console.error('Could not find any branches:', branchError);
    return;
  }

  const defaultBranchId = branches[0].id;
  console.log(`Using default branch ID: ${defaultBranchId}`);

  // 2. Find orders with null branch_id
  const { data: nullOrders, error: findError } = await supabase
    .from('restaurant_orders')
    .select('id, order_number')
    .is('branch_id', null);

  if (findError) {
    console.error('Error finding null branch orders:', findError);
    return;
  }

  console.log(`Found ${nullOrders.length} orders with NULL branch_id`);

  if (nullOrders.length === 0) {
    console.log('No orders to fix.');
    return;
  }

  // 3. Update them
  const { error: updateError } = await supabase
    .from('restaurant_orders')
    .update({ branch_id: defaultBranchId })
    .is('branch_id', null);

  if (updateError) {
    console.error('Error updating orders:', updateError);
  } else {
    console.log(`Successfully updated ${nullOrders.length} orders to branch_id ${defaultBranchId}`);
  }
}

fixBranchIds();
