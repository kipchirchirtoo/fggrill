// Check what's in the sync queue
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.env.APPDATA || process.env.HOME, 'fggrill-central', 'pos-offline.db');
console.log('Database path:', dbPath);

try {
    const db = new Database(dbPath);
    
    console.log('\n========== SYNC QUEUE STATUS ==========\n');
    
    // Get pending syncs
    const pending = db.prepare(`SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at DESC`).all();
    console.log('Pending syncs:', pending.length);
    
    if (pending.length > 0) {
        console.log('\nPending items:');
        pending.forEach((item, i) => {
            console.log(`\n${i + 1}. Action: ${item.action}`);
            console.log(`   Endpoint: ${item.endpoint}`);
            console.log(`   Method: ${item.method}`);
            console.log(`   Attempts: ${item.attempts}/${item.max_attempts}`);
            console.log(`   Created: ${item.created_at}`);
            console.log(`   Error: ${item.error || 'None'}`);
        });
    }
    
    // Get failed syncs
    const failed = db.prepare(`SELECT * FROM sync_queue WHERE status = 'failed' OR attempts >= max_attempts`).all();
    console.log('\n\nFailed syncs:', failed.length);
    
    // Get synced
    const synced = db.prepare(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'synced'`).get();
    console.log('Synced items:', synced.count);
    
    db.close();
    console.log('\n========== END ==========\n');
} catch (err) {
    console.error('Error:', err.message);
}
