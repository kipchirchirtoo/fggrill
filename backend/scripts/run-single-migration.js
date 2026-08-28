const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env from backend
dotenv.config({ path: path.join(__dirname, '../.env') });

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

async function runMigration() {
    const migrationFile = path.join(__dirname, '../supabase/migrations/45_payroll_engine_rework.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected. Running migration...');

    try {
        await client.query('BEGIN');
        const statements = splitSql(sql);
        for (const statement of statements) {
            if (statement.trim()) {
                await client.query(statement + ';');
            }
        }
        await client.query('COMMIT');
        console.log('✅ Migration applied successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
