
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspect() {
    try {
        const res = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid)
      FROM pg_constraint
      WHERE conrelid = 'forecasts'::regclass
      AND contype = 'c';
    `);
        console.log('Check Constraints on forecasts table:');
        res.rows.forEach(row => {
            console.log(`${row.conname}: ${row.pg_get_constraintdef}`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

inspect();
