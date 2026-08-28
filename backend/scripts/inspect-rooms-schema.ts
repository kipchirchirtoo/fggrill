import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function inspectRoomsSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'rooms';
    `);
        console.log('Columns in rooms table:');
        console.table(res.rows);
    } catch (err) {
        console.error('Error inspecting schema:', err);
    } finally {
        await client.end();
    }
}

inspectRoomsSchema();
