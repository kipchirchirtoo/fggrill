// Quick script to check if there are cached PINs in PowerSync
const path = require('path');
const { app } = require('electron');

// We need to simulate the app path
const userDataPath = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + "/.local/share");
const dbPath = path.join(userDataPath, 'fggrill-central', 'powersync.db');

console.log('Checking PowerSync database at:', dbPath);

try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);
    
    // Check if cached_pins table exists
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cached_pins'").all();
    
    if (tables.length === 0) {
        console.log('❌ cached_pins table does not exist!');
        console.log('   The database needs to be initialized.');
        process.exit(1);
    }
    
    console.log('✅ cached_pins table exists');
    
    // Check how many PINs are cached
    const count = db.prepare('SELECT COUNT(*) as count FROM cached_pins').get();
    console.log(`\n📊 Cached PINs: ${count.count}`);
    
    if (count.count === 0) {
        console.log('\n❌ No PINs cached!');
        console.log('   You need to cache some users first.');
        console.log('   The app will try to auto-import on startup.');
    } else {
        // Show the cached PINs
        const pins = db.prepare('SELECT id, user_id, user_data, branch_id FROM cached_pins').all();
        console.log('\n✅ Cached PINs found:');
        pins.forEach(pin => {
            try {
                const userData = JSON.parse(pin.user_data);
                console.log(`   PIN: ${pin.id} - User: ${userData.first_name} ${userData.last_name} (${userData.role})`);
            } catch (e) {
                console.log(`   PIN: ${pin.id} - User ID: ${pin.user_id}`);
            }
        });
    }
    
    db.close();
} catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nThe database might not exist yet.');
    console.log('Start the Electron app once to initialize it.');
}
