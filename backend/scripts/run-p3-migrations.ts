import { pool } from '../src/config/pg';
import fs from 'fs';
import path from 'path';

async function runSQL(sql: string, fileName: string) {
    console.log(`Executing ${fileName}...`);
    try {
        await pool.query(sql);
        console.log(`✅ Passed: ${fileName}`);
    } catch (err) {
        console.error(`❌ Failed: ${fileName}`);
        console.error(err.message);
        // We continue to other files even if one fails, or should we stop?
        // Usually, financial migrations are better stopped if one fails.
        throw err;
    }
}

async function start() {
    const migrationsDir = path.join(__dirname, '../supabase/migrations');
    const files = [
        '20260106_add_branch_accountant_role.sql.txt',
        '20260107_coa_journals.sql.txt',
        '20260107_stock_management.sql.txt',
        '20260107_expense_accounting.sql.txt',
        '20260107_banking_payments.sql.txt',
        '20260107_credit_management.sql.txt',
        '20260107_invoicing_auditor.sql.txt'
    ];

    for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        if (fs.existsSync(filePath)) {
            const sql = fs.readFileSync(filePath, 'utf8');
            await runSQL(sql, file);
        } else {
            console.warn(`⚠️ File not found: ${file}`);
        }
    }

    console.log('All attempted migrations completed.');
    process.exit(0);
}

start().catch(err => {
    console.error('Migration process aborted:', err);
    process.exit(1);
});
