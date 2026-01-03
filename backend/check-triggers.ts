import db from './src/db';

async function checkTriggers() {
    console.log('Waiting for database connection...');
    while (!db.isAvailable()) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('Checking triggers on reservations table...');
    try {
        const result = await db.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'reservations';
    `);

        console.log('Triggers:', JSON.stringify(result.rows, null, 2));
    } catch (error) {
        console.error('Failed to check triggers:', error);
    }
}

checkTriggers();
