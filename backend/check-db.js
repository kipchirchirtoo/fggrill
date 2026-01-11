const { Client } = require('pg');
require('dotenv').config();

async function checkColumns() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
        const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'inventory_items'");
        console.log('Columns in inventory_items:', res.rows.map(r => r.column_name).join(', '));

        const res2 = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'restaurant_inventory_items'");
        console.log('Columns in restaurant_inventory_items:', res2.rows.map(r => r.column_name).join(', '));

        const res3 = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'consumption_records'");
        console.log('Columns in consumption_records:', res3.rows.map(r => r.column_name).join(', '));

        const tables = ['in_transit_stock', 'branch_stock', 'stock_takes', 'stock_take_items', 'requisitions', 'purchase_orders', 'suppliers', 'stock_requests', 'store_items', 'store_locations', 'store_suppliers', 'store_item_suppliers', 'stock_transfers', 'dispatch_notes', 'kitchen_usage_records', 'staff_attendance'];
        for (const table of tables) {
            const res = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`);
            console.log(`Columns in ${table}:`, res.rows.map(r => r.column_name).join(', '));
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkColumns();
