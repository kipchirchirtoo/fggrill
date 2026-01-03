
import { pool } from './src/config/pg';

async function inspectBranches() {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'branches'
    `);
        console.log('Branches Table Schema:');
        console.table(res.rows);
    } catch (err) {
        console.error('Error inspecting branches:', err);
    } finally {
        await pool.end();
    }
}

inspectBranches();
