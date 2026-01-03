import db from './src/db';

async function inspectFoliosSchema() {
    console.log('Waiting for database connection...');
    while (!db.isAvailable()) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('Inspecting folios table schema...');
    try {
        const result = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'folios'
      ORDER BY ordinal_position;
    `);

        console.log('Columns:', JSON.stringify(result.rows, null, 2));
    } catch (error) {
        console.error('Failed to inspect folios schema:', error);
    }
}

inspectFoliosSchema();
