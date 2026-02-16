const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

// Get path from Electron app
const dbPath = path.join(app.getPath('userData'), 'powersync.db');

console.log('--- Inspecting PowerSync Database (via Electron) ---');
console.log('Path:', dbPath);

const db = new Database(dbPath);

function showTable(tableName) {
    try {
        console.log(`\n[Table: ${tableName}]`);
        const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
        if (rows.length === 0) {
            console.log(' (Empty)');
        } else {
            console.table(rows);
        }
    } catch (err) {
        console.log(` Error reading ${tableName}: ${err.message}`);
    }
}

showTable('offline_orders');
showTable('sync_queue');
showTable('cached_pins');

db.close();
console.log('\n--- Inspection Complete ---');
app.quit();
