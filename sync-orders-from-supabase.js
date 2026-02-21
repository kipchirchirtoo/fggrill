/**
 * Sync Restaurant Orders from Supabase to Local SQLite
 * This script fetches orders from the backend and stores them in the local database
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const https = require('https');
const fs = require('fs');

// Configuration
const BACKEND_URL = 'https://fgapi.duckdns.org/api';
const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'famous-gate-pos', 'pos-offline.db');

// Read token from .env file
const envPath = path.join(__dirname, '.env');
let AUTH_TOKEN = '';

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const tokenMatch = envContent.match(/SYNC_TOKEN=(.+)/);
    if (tokenMatch) {
        AUTH_TOKEN = tokenMatch[1].trim();
    }
}

console.log('🔄 Starting Order Sync from Supabase...\n');
console.log('📂 Database:', DB_PATH);
console.log('🌐 Backend:', BACKEND_URL);
console.log('🔑 Token:', AUTH_TOKEN ? 'Found' : 'NOT FOUND - Will try without auth');
console.log('');

// Helper function to make HTTPS requests
function makeRequest(endpoint, token) {
    return new Promise((resolve, reject) => {
        const url = `${BACKEND_URL}${endpoint}`;
        const options = {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

async function syncOrders() {
    try {
        // Open database
        const db = new Database(DB_PATH);
        console.log('✅ Database opened\n');

        // Fetch orders from backend
        console.log('📥 Fetching orders from backend...');
        const today = new Date().toISOString().split('T')[0];
        const ordersResponse = await makeRequest(`/restaurant/orders?from_date=${today}&to_date=${today}`, AUTH_TOKEN);

        if (!ordersResponse.success || !ordersResponse.data) {
            console.error('❌ Failed to fetch orders:', ordersResponse.message || 'No data');
            process.exit(1);
        }

        const orders = ordersResponse.data;
        console.log(`✅ Fetched ${orders.length} orders\n`);

        if (orders.length === 0) {
            console.log('ℹ️  No orders found for today');
            db.close();
            return;
        }

        // Prepare insert statements
        const insertOrder = db.prepare(`
            INSERT OR REPLACE INTO restaurant_orders (
                id, order_number, branch_id, table_number, room_number,
                guest_id, guest_name, order_type, status, total_amount,
                payment_status, payment_method, special_instructions,
                waiter_id, waiter_name, created_at, updated_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertItem = db.prepare(`
            INSERT OR REPLACE INTO restaurant_order_items (
                id, order_id, menu_item_id, quantity, unit_price,
                total_price, special_instructions, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Sync orders in a transaction
        const syncTransaction = db.transaction(() => {
            let orderCount = 0;
            let itemCount = 0;

            for (const order of orders) {
                // Insert order
                insertOrder.run(
                    order.id,
                    order.order_number,
                    order.branch_id,
                    order.table_number,
                    order.room_number,
                    order.guest_id,
                    order.guest_name,
                    order.order_type,
                    order.status,
                    order.total_amount || order.total,
                    order.payment_status,
                    order.payment_method,
                    order.special_instructions,
                    order.waiter_id,
                    order.waiter_name,
                    order.created_at,
                    order.updated_at,
                    order.created_by
                );
                orderCount++;

                // Insert order items if available
                if (order.items && Array.isArray(order.items)) {
                    for (const item of order.items) {
                        insertItem.run(
                            item.id,
                            order.id,
                            item.menu_item_id,
                            item.quantity,
                            item.unit_price,
                            item.total_price || (item.quantity * item.unit_price),
                            item.special_instructions,
                            item.created_at || order.created_at
                        );
                        itemCount++;
                    }
                }
            }

            console.log(`✅ Synced ${orderCount} orders`);
            console.log(`✅ Synced ${itemCount} order items`);
        });

        syncTransaction();

        // Verify sync
        const count = db.prepare('SELECT COUNT(*) as count FROM restaurant_orders').get();
        console.log(`\n📊 Total orders in database: ${count.count}`);

        // Show sample orders
        const samples = db.prepare(`
            SELECT order_number, status, waiter_name, created_by, created_at 
            FROM restaurant_orders 
            ORDER BY created_at DESC 
            LIMIT 5
        `).all();

        console.log('\n📋 Sample orders:');
        samples.forEach(o => {
            console.log(`   - Order #${o.order_number}: ${o.status}, waiter=${o.waiter_name || 'NULL'}, created_by=${o.created_by || 'NULL'}`);
        });

        db.close();
        console.log('\n✅ Sync complete!');

    } catch (error) {
        console.error('\n❌ Sync failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run sync
syncOrders();
