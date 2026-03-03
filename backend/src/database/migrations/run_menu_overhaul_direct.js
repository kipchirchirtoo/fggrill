const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
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
    try {
        // console.log('🚀 Starting Menu Overhaul migration (Direct PG)...');

        const sqlPath = path.join(__dirname, '20260114_menu_overhaul.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        const statements = splitSql(sqlContent);
        // console.log(`📝 Found ${statements.length} SQL statements to execute.\n`);

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (!statement.trim()) continue;

            // console.log(`Executing statement ${i + 1}/${statements.length}...`);
            try {
                await pool.query(statement + ';');
            } catch (err) {
                console.error(`❌ Statement failed:`);
                console.error(statement.substring(0, 200) + (statement.length > 200 ? '...' : ''));
                console.error(`Error: ${err.message}`);
                // Don't throw, continue if possible unless it's a fatal error
                if (err.message.includes('already exists')) {
                    // console.log('   (Object already exists, skipping)');
                } else {
                    throw err;
                }
            }
        }

        // console.log('\n✅ Migration completed successfully!');
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
