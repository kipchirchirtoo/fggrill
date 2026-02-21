// Simple check for orders in cache - uses correct database path
const fs = require('fs');
const path = require('path');

// The correct database path from the logs
const dbPath = path.join(process.env.APPDATA || process.env.HOME, 'fggrill-central', 'pos-offline.db');
console.log('Database path:', dbPath);
console.log('Database exists:', fs.existsSync(dbPath));

if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log('Database size:', (stats.size / 1024).toFixed(2), 'KB');
    console.log('Last modified:', stats.mtime);
}
