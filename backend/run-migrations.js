const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
});

/**
 * Robustly split SQL by semicolons, ignoring those inside $$ blocks and single quotes.
 */
function splitSql(sql) {
    const statements = [];
    let current = '';
    let inQuote = false;
    let inDollarBlock = false;

    for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        const nextChar = sql[i + 1];

        if (char === "'" && !inDollarBlock) {
            inQuote = !inQuote;
        } else if (char === '$' && nextChar === '$' && !inQuote) {
            inDollarBlock = !inDollarBlock;
            current += char;
            i++; // skip next $
            current += '$';
            continue;
        }

        if (char === ';' && !inQuote && !inDollarBlock) {
            statements.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    if (current.trim()) {
        statements.push(current.trim());
    }

    return statements;
}

async function runSQLStatement(statement, fileName) {
    const trimmed = statement.trim();
    if (!trimmed) return;

    try {
        await client.query(trimmed + ';');
    } catch (err) {
        // Skip common existing object errors
        const skipCodes = ['42P07', '42710', '23505', '42712', '42P11', '42P15', '42701', '42723'];
        if (skipCodes.includes(err.code) || err.message.includes('already exists')) {
            return;
        }
        console.error(`❌ Statement failed in ${fileName}:`);
        console.error(trimmed.substring(0, 200) + (trimmed.length > 200 ? '...' : ''));
        console.error(`Error code: ${err.code}`);
        console.error(`Error message: ${err.message}`);
        throw err;
    }
}

async function runFile(filePath, fileName) {
    console.log(`Executing ${fileName}...`);
    const sql = fs.readFileSync(filePath, 'utf8');

    const statements = splitSql(sql);
    let count = 0;
    for (const statement of statements) {
        try {
            await runSQLStatement(statement, fileName);
            count++;
        } catch (err) {
            console.error(`Stopping migration process at ${fileName} due to error.`);
            throw err;
        }
    }
    console.log(`✅ Passed: ${fileName} (${count} statements)`);
}

async function start() {
    const migrationsDir = path.join(__dirname, 'supabase/migrations');

    let files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql') || f.endsWith('.sql.txt'))
        .sort((a, b) => {
            const aNum = parseInt(a);
            const bNum = parseInt(b);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            if (!isNaN(aNum)) return -1;
            if (!isNaN(bNum)) return 1;
            return a.localeCompare(b);
        });

    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected.');

    // Prep fixes
    const prepPath = path.join(migrationsDir, '000_phase3_prep.sql.txt');
    if (fs.existsSync(prepPath)) {
        await runFile(prepPath, '000_phase3_prep.sql.txt');
    }

    for (const file of files) {
        if (file === '000_phase3_prep.sql.txt') continue;
        const filePath = path.join(migrationsDir, file);
        await runFile(filePath, file);
    }

    await client.end();
    console.log('All migrations processed successfully.');
    process.exit(0);
}

start().catch(err => {
    console.error('Migration process aborted:', err.message);
    if (client) client.end().catch(() => { });
    process.exit(1);
});
