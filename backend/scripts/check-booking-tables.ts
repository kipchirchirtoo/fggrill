import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkTables() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();

        // Check if 'bookings' table exists
        const bookingsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'bookings'
      );
    `);
        console.log('bookings table exists:', bookingsCheck.rows[0].exists);

        // Check if 'reservations' table exists
        const reservationsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'reservations'
      );
    `);
        console.log('reservations table exists:', reservationsCheck.rows[0].exists);

        // Count records in each
        if (bookingsCheck.rows[0].exists) {
            const bookingsCount = await client.query('SELECT COUNT(*) FROM bookings');
            console.log('bookings count:', bookingsCount.rows[0].count);
        }

        if (reservationsCheck.rows[0].exists) {
            const reservationsCount = await client.query('SELECT COUNT(*) FROM reservations');
            console.log('reservations count:', reservationsCount.rows[0].count);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkTables();
