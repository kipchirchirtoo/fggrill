const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'fggrill-central');
const dbPath = path.join(userDataPath, 'powersync.db');

console.log('=== Checking PowerSync Database ===');
console.log('Path:', dbPath);

try {
    const db = new Database(dbPath, { readonly: true });

    // Check cached_pins count
    const count = db.prepare('SELECT COUNT(*) as count FROM cached_pins').get();
    console.log(`\nCached PINs: ${count.count}`);

    if (count.count > 0) {
        console.log('\n✅ Users have been imported successfully!');
        console.log('\nSample cached PINs:');
        const sample = db.prepare('SELECT id, user_id, branch_id FROM cached_pins LIMIT 10').all();
        console.table(sample);
    } else {
        console.log('\n❌ No cached PINs found. Import may have failed.');
    }

    db.close();
} catch (error) {
    console.error('Error:', error.message);
}
