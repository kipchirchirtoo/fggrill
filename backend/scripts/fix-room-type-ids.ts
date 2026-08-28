import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function fixRoomTypeIds() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();

        // First, check current state
        const checkRes = await client.query(`
      SELECT id, room_number, room_type_id, type_id 
      FROM rooms 
      LIMIT 10;
    `);
        console.log('Current room data:');
        console.table(checkRes.rows);

        // If type_id exists but room_type_id is null, copy it over
        const updateRes = await client.query(`
      UPDATE rooms 
      SET room_type_id = type_id 
      WHERE room_type_id IS NULL AND type_id IS NOT NULL;
    `);
        console.log(`\nUpdated ${updateRes.rowCount} rooms with room_type_id from type_id`);

        // Check after update
        const afterRes = await client.query(`
      SELECT id, room_number, room_type_id, type_id 
      FROM rooms 
      LIMIT 10;
    `);
        console.log('\nRoom data after update:');
        console.table(afterRes.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

fixRoomTypeIds();
