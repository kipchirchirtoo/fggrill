import db from './src/db';

async function fixHistoryTable() {
    console.log('Waiting for database connection...');
    while (!db.isAvailable()) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('Making changed_by nullable in room_status_history...');
    try {
        await db.query(`ALTER TABLE room_status_history ALTER COLUMN changed_by DROP NOT NULL;`);
        console.log('Successfully made changed_by nullable.');
    } catch (error) {
        console.error('Failed to alter table:', error);
    }
}

fixHistoryTable();
