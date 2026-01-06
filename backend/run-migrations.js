const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
});

async function runSQL(sql, fileName) {
    console.log(`Executing ${fileName}...`);
    try {
        // We use client.query(sql) which handles multiple statements if separated by ;
        await client.query(sql);
        console.log(`✅ Passed: ${fileName}`);
    } catch (err) {
        console.error(`❌ Failed: ${fileName}`);
        console.error(err.message);
        throw err;
    }
}

async function start() {
    const migrationsDir = path.join(__dirname, 'supabase/migrations');
    const files = [
        '20260106_add_branch_accountant_role.sql.txt',
        '20260107_coa_journals.sql.txt',
        '20260107_stock_management.sql.txt',
        '20260107_expense_accounting.sql.txt',
        '20260107_banking_payments.sql.txt',
        '20260107_credit_management.sql.txt',
        '20260107_invoicing_auditor.sql.txt'
    ];

    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected.');

    for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        if (fs.existsSync(filePath)) {
            const sql = fs.readFileSync(filePath, 'utf8');
            await runSQL(sql, file);
        } else {
            console.warn(`⚠️ File not found: ${file}`);
        }
    }

    await client.end();
    console.log('All attempted migrations completed.');
    process.exit(0);
}

start().catch(err => {
    console.error('Migration process aborted:', err);
    if (client) client.end().catch(() => { });
    process.exit(1);
});
