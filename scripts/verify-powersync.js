const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('--- PowerSync Integration Verification ---');

// Note: In a real environment, we'd run this via Electron's main process context
// Since we can't easily do that here, we'll check if the files exist and have correct content

const mainJsPath = path.join(__dirname, '../electron/main.js');
const powersyncJsPath = path.join(__dirname, '../electron/powersync.js');

if (fs.existsSync(mainJsPath)) {
    const mainJs = fs.readFileSync(mainJsPath, 'utf8');
    if (mainJs.includes('initDatabase()')) {
        console.error('FAIL: initDatabase() still exists in main.js');
    } else {
        console.log('PASS: initDatabase() removed from main.js');
    }

    if (mainJs.includes('const ps = getPowerSync();')) {
        console.log('PASS: main.js uses getPowerSync()');
    } else {
        console.warn('WARN: Could not find "getPowerSync()" usage in main.js');
    }
}

if (fs.existsSync(powersyncJsPath)) {
    const powersyncJs = fs.readFileSync(powersyncJsPath, 'utf8');
    if (powersyncJs.includes('sync_queue')) {
        console.log('PASS: sync_queue table added to powersync.js schema');
    } else {
        console.error('FAIL: sync_queue table missing from powersync.js schema');
    }

    const requiredTables = [
        'payments', 'pos_transactions', 'cashier_transactions',
        'restaurant_orders', 'restaurant_order_items',
        'bar_orders', 'bar_order_items',
        'restaurant_menu_items', 'restaurant_menu_categories'
    ];

    let missingTables = [];
    requiredTables.forEach(table => {
        if (!powersyncJs.includes(`name: '${table}'`)) {
            missingTables.push(table);
        }
    });

    if (missingTables.length === 0) {
        console.log('PASS: All required POS/Cashier tables present in powersync.js');
    } else {
        console.error('FAIL: Missing tables in powersync.js:', missingTables.join(', '));
    }
}

console.log('--- Verification Complete ---');
