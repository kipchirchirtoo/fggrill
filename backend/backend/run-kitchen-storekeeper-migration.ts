import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
    const sqlPath = path.join(__dirname, 'migrations', '20260622_kitchen_storekeeper_integration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL is not set');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    try {
        console.log('Connected. Running migration inside a single transaction...');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Migration committed successfully.');
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Migration failed — rolled back. Error:', err.message);
        if (err.position) {
            const pos = Number(err.position);
            console.error('Near:', sql.slice(Math.max(0, pos - 200), pos + 200));
        }
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

run();
