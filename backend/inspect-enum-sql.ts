import db from './src/db';

async function inspectEnum() {
    console.log('Waiting for database connection...');
    while (!db.isAvailable()) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('Inspecting room_status enum via raw SQL...');
    try {
        const result = await db.query(`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'room_status';
    `);

        console.log('Enum values:', result.rows.map(r => r.enumlabel));
    } catch (error) {
        console.error('Failed to inspect enum:', error);
    }
}

inspectEnum();
