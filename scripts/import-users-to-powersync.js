const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const os = require('os');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

console.log('=== Importing Users from Supabase to PowerSync ===\n');

// Supabase setup
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Supabase credentials not found in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Database path
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'fggrill-central');
const dbPath = path.join(userDataPath, 'powersync.db');

console.log('Database:', dbPath);

if (!fs.existsSync(dbPath)) {
    console.error('ERROR: PowerSync database not found. Please run the Electron app first.');
    process.exit(1);
}

// Use better-sqlite3 directly (loaded by Electron already)
let Database;
try {
    Database = require('better-sqlite3');
} catch (e) {
    console.error('ERROR: better-sqlite3 not available. Installing...');
    require('child_process').execSync('npm install better-sqlite3', { stdio: 'inherit' });
    Database = require('better-sqlite3');
}

async function importUsers() {
    const db = new Database(dbPath);

    try {
        console.log('Fetching users from Supabase...');
        const { data: users, error } = await supabase
            .from('users')
            .select('id, email, first_name, last_name, role, branch_id, pos_pin, status')
            .not('pos_pin', 'is', null);

        if (error) throw error;

        if (!users || users.length === 0) {
            console.log('No users with PINs found.');
            db.close();
            return;
        }

        console.log(`Found ${users.length} users with PINs\n`);

        // Clear existing
        console.log('Clearing existing cached PINs...');
        db.prepare('DELETE FROM cached_pins').run();

        // Insert
        const stmt = db.prepare(`
            INSERT INTO cached_pins (id, user_id, user_data, branch_id, cached_at)
            VALUES (?, ?, ?, ?, ?)
        `);

        let success = 0;
        let errors = 0;

        console.log('Importing users...\n');
        for (const user of users) {
            try {
                const userData = JSON.stringify({
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    role: user.role,
                    branch_id: user.branch_id,
                    status: user.status
                });

                stmt.run(
                    user.pos_pin,
                    user.id,
                    userData,
                    user.branch_id || null,
                    new Date().toISOString()
                );

                console.log(`✓ ${user.pos_pin} - ${user.first_name} ${user.last_name} (${user.role})`);
                success++;
            } catch (err) {
                console.error(`✗ ${user.pos_pin}: ${err.message}`);
                errors++;
            }
        }

        console.log(`\n=== Import Complete ===`);
        console.log(`Success: ${success}`);
        console.log(`Errors: ${errors}`);
        console.log(`Total: ${users.length}`);

        // Verify
        const count = db.prepare('SELECT COUNT(*) as count FROM cached_pins').get();
        console.log(`\nCached PINs in database: ${count.count}`);

    } catch (error) {
        console.error('ERROR:', error.message);
        process.exit(1);
    } finally {
        db.close();
    }
}

importUsers();
