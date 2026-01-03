import 'dotenv/config';
import { Client } from 'pg';

async function inspectSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'restaurant_orders';
    `);

        if (res.rows.length === 0) {
            console.log('❌ Table restaurant_orders does not exist.');
        } else {
            console.log('✅ Table restaurant_orders exists with columns:');
            console.table(res.rows);
        }

    } catch (error) {
        console.error('❌ Inspection failed:', error);
    } finally {
        await client.end();
    }
}

inspectSchema();
