import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function cleanupTestData() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();

        console.log('Starting cleanup of test data...\n');

        // 1. Delete test bookings
        const deleteBookings = await client.query(`
      DELETE FROM bookings 
      WHERE guest_id IN (
        SELECT id FROM guests 
        WHERE email LIKE '%test%' OR email LIKE '%example.com%'
      )
      RETURNING id;
    `);
        console.log(`✓ Deleted ${deleteBookings.rowCount} test bookings`);

        // 2. Delete test reservations
        const deleteReservations = await client.query(`
      DELETE FROM reservations 
      WHERE guest_id IN (
        SELECT id FROM guests 
        WHERE email LIKE '%test%' OR email LIKE '%example.com%'
      )
      RETURNING id;
    `);
        console.log(`✓ Deleted ${deleteReservations.rowCount} test reservations`);

        // 3. Delete test guests
        const deleteGuests = await client.query(`
      DELETE FROM guests 
      WHERE email LIKE '%test%' OR email LIKE '%example.com%'
      RETURNING id, first_name, last_name, email;
    `);
        console.log(`✓ Deleted ${deleteGuests.rowCount} test guests`);
        if (deleteGuests.rows.length > 0) {
            deleteGuests.rows.forEach(g => {
                console.log(`  - ${g.first_name} ${g.last_name} (${g.email})`);
            });
        }

        // 4. Show remaining counts
        const bookingsCount = await client.query('SELECT COUNT(*) FROM bookings');
        const reservationsCount = await client.query('SELECT COUNT(*) FROM reservations');
        const guestsCount = await client.query('SELECT COUNT(*) FROM guests');

        console.log('\n📊 Remaining records:');
        console.log(`  - Bookings: ${bookingsCount.rows[0].count}`);
        console.log(`  - Reservations: ${reservationsCount.rows[0].count}`);
        console.log(`  - Guests: ${guestsCount.rows[0].count}`);

        console.log('\n✅ Cleanup completed successfully!');

    } catch (err) {
        console.error('❌ Error during cleanup:', err);
    } finally {
        await client.end();
    }
}

cleanupTestData();
