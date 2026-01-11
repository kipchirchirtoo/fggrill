const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

async function inspectSchemas() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        const tables = ['transactions', 'payments', 'receipt_items', 'cashier_shifts', 'restaurant_orders', 'bar_orders', 'inventory_items'];
        for (const table of tables) {
            const res = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = $1
                ORDER BY ordinal_position;
            `, [table]);
            console.log(`\nSchema for ${table}:`);
            res.rows.forEach(row => {
                console.log(`${row.column_name}: ${row.data_type}`);
            });
        }
    } catch (err) {
        console.error('Error inspecting schemas:', err);
    } finally {
        await client.end();
    }
}

inspectSchemas();
