import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function inspectRoomStatusEnum() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        const res = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'room_status'
      );
    `);
        console.log('Valid room_status enum values:');
        res.rows.forEach(row => console.log(`  - ${row.enumlabel}`));
    } catch (err) {
        console.error('Error inspecting enum:', err);
    } finally {
        await client.end();
    }
}

inspectRoomStatusEnum();
