import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL is not defined');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
});

async function analyzeDatabase() {
    const client = await pool.connect();

    try {
        console.log('📊 Analyzing Real Database...\n');

        // 1. Branches
        const branches = await client.query('SELECT id, name, location, status FROM branches ORDER BY id');
        console.log('=== BRANCHES ===');
        console.table(branches.rows);

        // 2. Users (summarize roles)
        const users = await client.query(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role 
      ORDER BY count DESC
    `);
        console.log('\n=== USER ROLES ===');
        console.table(users.rows);

        // 3. Inventory Items
        const inventory = await client.query('SELECT COUNT(*) as count FROM inventory_items');
        console.log('\n=== INVENTORY ===');
        console.log(`Total Items: ${inventory.rows[0].count}`);

        // 4. Suppliers
        const suppliers = await client.query('SELECT id, name, status FROM suppliers LIMIT 10');
        console.log('\n=== SUPPLIERS ===');
        console.table(suppliers.rows);

        // 5. Budgets
        const budgets = await client.query('SELECT COUNT(*) as count FROM budgets');
        console.log('\n=== BUDGETS ===');
        console.log(`Total Budgets: ${budgets.rows[0].count}`);

        // 6. Vendor Performance
        const vendorPerf = await client.query('SELECT COUNT(*) as count FROM vendor_performance');
        console.log('\n=== VENDOR PERFORMANCE ===');
        console.log(`Total Records: ${vendorPerf.rows[0].count}`);

        // 7. Procurement Orders
        const procOrders = await client.query('SELECT COUNT(*) as count FROM procurement_orders');
        console.log('\n=== PROCUREMENT ORDERS ===');
        console.log(`Total Records: ${procOrders.rows[0].count}`);

        // 8. Stock Requests
        const stockReqs = await client.query('SELECT COUNT(*) as count FROM stock_requests');
        console.log('\n=== STOCK REQUESTS ===');
        console.log(`Total Records: ${stockReqs.rows[0].count}`);

    } catch (error: any) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

analyzeDatabase();
