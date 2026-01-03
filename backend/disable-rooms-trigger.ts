import db from './src/db';

async function disableTrigger() {
    console.log('Waiting for database connection...');
    while (!db.isAvailable()) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('Disabling trigger on_room_status_change on rooms table...');
    try {
        await db.query(`
      DROP TRIGGER IF EXISTS on_room_status_change ON rooms;
    `);
        console.log('Trigger disabled successfully');
    } catch (error) {
        console.error('Failed to disable trigger:', error);
    } finally {
        process.exit();
    }
}

disableTrigger();
