/**
 * Test script to check cached user data structure
 * Run this to see what user data is stored in the cache
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Get the database path (same as Electron app)
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'famous-gate-pos');
const dbPath = path.join(userDataPath, 'pos-offline.db');

console.log('Database path:', dbPath);

try {
    const db = new Database(dbPath, { readonly: true });
    
    // Get all cached PINs
    const users = db.prepare('SELECT * FROM cached_pins').all();
    
    console.log(`\nFound ${users.length} cached users:\n`);
    
    users.forEach((row, index) => {
        console.log(`User ${index + 1}:`);
        console.log('  PIN:', row.id);
        console.log('  User ID:', row.user_id);
        console.log('  Branch ID:', row.branch_id);
        console.log('  Cached At:', row.cached_at);
        
        try {
            const userData = JSON.parse(row.user_data);
            console.log('  User Data:');
            console.log('    - id:', userData.id);
            console.log('    - email:', userData.email);
            console.log('    - first_name:', userData.first_name);
            console.log('    - last_name:', userData.last_name);
            console.log('    - role:', userData.role);
            console.log('    - branch_id:', userData.branch_id);
            console.log('    - status:', userData.status);
        } catch (e) {
            console.log('  Error parsing user_data:', e.message);
        }
        console.log('');
    });
    
    db.close();
} catch (error) {
    console.error('Error:', error.message);
    console.log('\nMake sure the Electron app has been run at least once to create the database.');
}
