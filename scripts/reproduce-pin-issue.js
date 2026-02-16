const path = require('path');
const fs = require('fs');

// Mock Electron app
const mockUserDataPath = path.join(__dirname, 'mock_user_data');
if (!fs.existsSync(mockUserDataPath)) {
    fs.mkdirSync(mockUserDataPath);
}

const mockApp = {
    getPath: () => mockUserDataPath
};

// Mock the electron module
const electronMock = { app: mockApp };
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (request) {
    if (request === 'electron') {
        return electronMock;
    }
    return originalRequire.apply(this, arguments);
};

// Now verify the logic in powersync.js by reading it directly and extracting schema
// We will manually test the logic since we can't easily run the electron-specific code
// in standard node due to native module mismatches.

// 1. Read powersync.js to get schema content
const powersyncPath = path.join(__dirname, '../electron/powersync.js');
const powersyncContent = fs.readFileSync(powersyncPath, 'utf8');

console.log('--- Analyzing Schema for Cached Pins ---');

// Check schema definition
const cachedPinsRegex = /name:\s*['"]cached_pins['"][\s\S]*?columns:\s*\[([\s\S]*?)\]/m;
const match = powersyncContent.match(cachedPinsRegex);

if (match) {
    console.log('Found cached_pins table definition.');
    const columnsBlock = match[1];
    console.log('Columns:', columnsBlock);

    // Verify 'id' column or lack thereof
    // In PowerSync/SQLite shim, we often use a primary key.
    // If the schema DOES NOT define an 'id' column explicitly, PowerSync might autogenerate one,
    // OR if we are using the shim in `powersync.js`, it strictly follows the schema.

    if (!columnsBlock.includes("name: 'id'")) {
        console.warn("WARNING: 'id' column is MISSING from cached_pins schema!");
        console.warn("The 'cache:pin' handler uses 'id' to store the PIN for easy lookup.");
        console.warn("If 'id' is not in the schema, the INSERT OR REPLACE might fail or not store the PIN as the key.");
    } else {
        console.log("PASS: 'id' column is present in schema.");
    }

    // Check types
    if (columnsBlock.includes("name: 'user_id'") && columnsBlock.includes("name: 'user_data'")) {
        console.log("PASS: Required columns (user_id, user_data) are present.");
    } else {
        console.warn("FAIL: Missing required columns in cached_pins.");
    }

} else {
    console.error('FAIL: Could not find cached_pins table in powersync.js');
}

console.log('\n--- Checking Logic in main.js (Simulated) ---');
// Simulating the issue:
// The `cache:pin` handler does:
// INSERT OR REPLACE INTO cached_pins (id, user_id, user_data, ...) VALUES (?, ?, ?, ...)
// It passes `pin` as the first argument for `id`.

// If the schema defined in `powersync.js` does NOT have an `id` column,
// but the shim uses `CREATE TABLE ... (id TEXT PRIMARY KEY, ...)` automatically (as seen in shim code),
// then it MIGHT work in the shim but fail in real PowerSync if the real schema doesn't have `id`.
// AND if the schema has `user_id` as the primary key or something else.

// Let's look at the shim code in powersync.js (we can read it from the file content we loaded)
const shimRegex = /class PowerSyncDatabase[\s\S]*?initShim\(\) \{[\s\S]*?CREATE TABLE IF NOT EXISTS \${table.name} \(id TEXT PRIMARY KEY, \${columns}\)/;
const shimMatch = powersyncContent.match(shimRegex);

if (shimMatch) {
    console.log("Shim detects: It forces 'id TEXT PRIMARY KEY' for every table.");
} else {
    console.log("Shim might verify schema columns directly.");
}
