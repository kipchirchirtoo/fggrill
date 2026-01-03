import db from './src/db';

async function fixEnum() {
    console.log('Waiting for database connection...');
    while (!db.isAvailable()) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('Adding missing values to room_status enum...');
    try {
        // Check if 'reserved' exists
        const checkReserved = await db.query(`
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'room_status' AND e.enumlabel = 'reserved';
    `);

        if (checkReserved.rows.length === 0) {
            console.log('Adding "reserved" to room_status enum...');
            await db.query(`ALTER TYPE room_status ADD VALUE 'reserved';`);
            console.log('Added "reserved".');
        } else {
            console.log('"reserved" already exists.');
        }

        // Check if 'out-of-order' exists
        const checkOutOfOrder = await db.query(`
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'room_status' AND e.enumlabel = 'out-of-order';
    `);

        if (checkOutOfOrder.rows.length === 0) {
            console.log('Adding "out-of-order" to room_status enum...');
            await db.query(`ALTER TYPE room_status ADD VALUE 'out-of-order';`);
            console.log('Added "out-of-order".');
        } else {
            console.log('"out-of-order" already exists.');
        }

        console.log('Enum fix complete!');
    } catch (error) {
        console.error('Failed to fix enum:', error);
    }
}

fixEnum();
