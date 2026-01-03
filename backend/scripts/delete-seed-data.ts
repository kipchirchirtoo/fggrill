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

async function deleteSeedData() {
    const client = await pool.connect();

    try {
        console.log('🗑️ Deleting Seed Data...\n');
        await client.query('BEGIN');

        // 1. Delete vendor_performance (all seeded)
        const vpResult = await client.query('DELETE FROM vendor_performance');
        console.log(`✅ Deleted ${vpResult.rowCount} vendor_performance records`);

        // 2. Delete procurement_orders (all seeded)
        const poResult = await client.query('DELETE FROM procurement_orders');
        console.log(`✅ Deleted ${poResult.rowCount} procurement_orders records`);

        // 3. Delete budgets (all seeded)
        const budgetResult = await client.query('DELETE FROM budgets');
        console.log(`✅ Deleted ${budgetResult.rowCount} budgets records`);

        // 4. Delete stock_request_items first (foreign key)
        const sriResult = await client.query('DELETE FROM stock_request_items');
        console.log(`✅ Deleted ${sriResult.rowCount} stock_request_items records`);

        // 5. Delete stock_requests (all seeded)
        const srResult = await client.query('DELETE FROM stock_requests');
        console.log(`✅ Deleted ${srResult.rowCount} stock_requests records`);

        // NOTE: NOT deleting branches, users, suppliers, inventory_items as these are real data

        await client.query('COMMIT');
        console.log('\n✅ All seed data deleted successfully!');

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

deleteSeedData();
