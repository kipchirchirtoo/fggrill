// Test script to debug the "Served by" issue
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'electron', 'hotel.db');
const db = new Database(dbPath);

console.log('\n========== DEBUGGING SERVED BY ISSUE ==========\n');

// 1. Check if waiter columns exist in restaurant_orders
console.log('1. Checking restaurant_orders schema:');
const ordersSchema = db.prepare("PRAGMA table_info(restaurant_orders)").all();
const hasWaiterId = ordersSchema.find(col => col.name === 'waiter_id');
const hasWaiterName = ordersSchema.find(col => col.name === 'waiter_name');
console.log('   - waiter_id column exists:', !!hasWaiterId);
console.log('   - waiter_name column exists:', !!hasWaiterName);

// 2. Check recent orders
console.log('\n2. Recent orders (last 5):');
const recentOrders = db.prepare(`
  SELECT id, order_number, waiter_id, waiter_name, created_at 
  FROM restaurant_orders 
  ORDER BY created_at DESC 
  LIMIT 5
`).all();

if (recentOrders.length === 0) {
  console.log('   No orders found in database');
} else {
  recentOrders.forEach(order => {
    console.log(`   Order ${order.order_number}:`);
    console.log(`     - waiter_id: ${order.waiter_id || 'NULL'}`);
    console.log(`     - waiter_name: ${order.waiter_name || 'NULL'}`);
    console.log(`     - created_at: ${order.created_at}`);
  });
}

// 3. Check staff table for waiters
console.log('\n3. Available waiters in staff table:');
const waiters = db.prepare(`
  SELECT id, first_name, last_name, role, status 
  FROM staff 
  WHERE role IN ('waiter', 'waitress', 'head_waiter')
  AND status = 'active'
`).all();

if (waiters.length === 0) {
  console.log('   No active waiters found in staff table');
} else {
  waiters.forEach(waiter => {
    console.log(`   ${waiter.first_name} ${waiter.last_name} (${waiter.role}) - ID: ${waiter.id}`);
  });
}

// 4. Check users table for POS login users
console.log('\n4. Users with POS roles:');
const posUsers = db.prepare(`
  SELECT id, first_name, last_name, role, pin 
  FROM users 
  WHERE role IN ('waiter', 'waitress', 'head_waiter', 'pos_kitchen', 'restaurant')
`).all();

if (posUsers.length === 0) {
  console.log('   No POS users found');
} else {
  posUsers.forEach(user => {
    console.log(`   ${user.first_name} ${user.last_name} (${user.role}) - PIN: ${user.pin ? 'SET' : 'NOT SET'}`);
  });
}

console.log('\n========== RECOMMENDATIONS ==========\n');

if (!hasWaiterId || !hasWaiterName) {
  console.log('❌ ISSUE: waiter_id or waiter_name columns are missing!');
  console.log('   Solution: Restart the Electron app to run the migration.');
}

if (waiters.length === 0 && posUsers.length === 0) {
  console.log('❌ ISSUE: No waiters or POS users found in database!');
  console.log('   Solution: Add staff members with waiter roles.');
}

if (recentOrders.length > 0) {
  const ordersWithoutWaiter = recentOrders.filter(o => !o.waiter_name);
  if (ordersWithoutWaiter.length > 0) {
