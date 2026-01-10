import { pool } from '../src/config/pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function runSQL(sql: string, fileName: string) {
    console.log(`Executing ${fileName}...`);
    try {
        await pool.query(sql);
        console.log(`✅ Passed: ${fileName}`);
    } catch (err: any) {
        console.error(`❌ Failed: ${fileName}`);
        console.error(err.message);
        throw err;
    }
}

async function start() {
    const migrationsDir = path.join(__dirname, '../supabase/migrations');
    const files = [
        '20260113_advanced_features.sql'
    ];

    console.log('🚀 Starting advanced features migration...\n');

    for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        if (fs.existsSync(filePath)) {
            const sql = fs.readFileSync(filePath, 'utf8');
            await runSQL(sql, file);
        } else {
            console.warn(`⚠️ File not found: ${file}`);
        }
    }

    console.log('\n🎉 Migration completed successfully.');
    process.exit(0);
}

start().catch(err => {
    console.error('\n❌ Migration process aborted:', err);
    process.exit(1);
});
