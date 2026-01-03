
import { pool } from './src/config/pg';

async function inspectBranches() {
    try {
        const res = await pool.query('SELECT * FROM branches LIMIT 0');
        console.log('Branches Table Fields:');
        res.fields.forEach(field => {
            console.log(`${field.name} (Type ID: ${field.dataTypeID})`);
        });
    } catch (err) {
        console.error('Error inspecting branches:', err);
    } finally {
        await pool.end();
    }
}

inspectBranches();
