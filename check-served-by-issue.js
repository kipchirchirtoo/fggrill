const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Path to the database
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'fggrill-central', 'pos-offline.db');

console.log('Database path:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });
  
  // Check if waiter_id and waiter_name columns exist
  console.log('\n=== Checking restaurant_orders schema ===');
  const tableInfo = db.prepare("PRAGMA table_info(restaurant_orders)").all();
  console.log('Columns:', tableInfo.map(col => col.name).join(', '));
  
  const hasWaiterId = tableInfo.some(col => col.name === 'waiter_id');
  const hasWaiterName = tableInfo.some(col => col.name === 'waiter_name');
  
  console.log('\nwaiter_id column exists:', hasWaiterId);
  console.log('waiter_name column exists:', hasWaiterName);
  
  // Get the most recent order
  console.log('\n=== Most Recent Order ===');
  const recentOrder = db.prepare(`
    SELECT id, order_number, waiter_id, waiter_name, created_at 
    FROM restaurant_orders 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get();
  
  if (recentOrder) {
    console.log('Order:', JSON.stringify(recentOrder, null, 2));
  } else {
    console.log('No orders found');
  }
  
  // Check cached users
  console.log('\n=== Cached Users ===');
  const users = db.prepare('SELECT id, first_name, last_name, role FROM cached_users').all();
  console.log('Users:', JSON.stringify(users, null, 2));
  
  db.close();
} catch (error) {
  console.error('Error:', error.message);
}
