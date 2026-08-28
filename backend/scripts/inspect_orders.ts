
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

async function inspectOrders() {
  console.log('Inspecting recent orders...');

  // Fetch last 10 orders
  const { data: orders, error } = await supabase
    .from('restaurant_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }

  console.log(`Found ${orders.length} recent orders:`);
  orders.forEach(order => {
    console.log(`Order #${order.order_number}:`);
    console.log(`  ID: ${order.id}`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Branch ID: ${order.branch_id}`);
    console.log(`  Created: ${order.created_at}`);
    console.log(`  Updated: ${order.updated_at}`);
    console.log('---');
  });
}

inspectOrders();
