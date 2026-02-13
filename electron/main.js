const { app, BrowserWindow, globalShortcut, dialog, ipcMain, session, net, protocol } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const isDev = !app.isPackaged;

// ──────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────
const DOMAIN_URL = isDev ? 'http://localhost:3001' : 'https://fggrill.vercel.app';
const TERMINAL_PATH = '/terminal';
const CACHE_DIR = path.join(app.getPath('userData'), 'page-cache');
const DB_PATH = path.join(app.getPath('userData'), 'pos.db');

let mainWindow;
let backendProcess;
let isOnline = true;
let db = null;

// ──────────────────────────────────────────
// SQLite Database
// ──────────────────────────────────────────
function initDatabase() {
    try {
        const Database = require('better-sqlite3');
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL'); // Better concurrent read performance

        db.exec(`
            CREATE TABLE IF NOT EXISTS cached_pins (
                pin TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                user_data TEXT NOT NULL,
                branch_id INTEGER,
                cached_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS menu_items (
                id TEXT PRIMARY KEY,
                branch_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                category TEXT,
                price REAL NOT NULL,
                data TEXT NOT NULL,
                cached_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                branch_id INTEGER,
                name TEXT NOT NULL,
                data TEXT NOT NULL,
                cached_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS offline_orders (
                id TEXT PRIMARY KEY,
                branch_id INTEGER NOT NULL,
                order_data TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TEXT NOT NULL,
                synced_at TEXT
            );

            CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                method TEXT DEFAULT 'POST',
                token TEXT,
                body TEXT,
                branch_id INTEGER,
                status TEXT DEFAULT 'pending',
                attempts INTEGER DEFAULT 0,
                max_attempts INTEGER DEFAULT 10,
                created_at TEXT NOT NULL,
                last_attempt TEXT,
                error TEXT
            );

            CREATE TABLE IF NOT EXISTS cache_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        `);

        console.log('[DB] SQLite database initialized at:', DB_PATH);
        return db;
    } catch (err) {
        console.error('[DB] Failed to initialize SQLite:', err);
        return null;
    }
}

// ──────────────────────────────────────────
// Page Cache (offline page serving)
// ──────────────────────────────────────────
function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}

function getCachePath(url) {
    // Convert URL to a safe filename
    const sanitized = url
        .replace(/^https?:\/\//, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .substring(0, 200);
    return path.join(CACHE_DIR, sanitized);
}

function cacheResponse(url, data, contentType) {
    try {
        ensureCacheDir();
        const cachePath = getCachePath(url);
        const meta = { contentType, cachedAt: new Date().toISOString(), url };
        fs.writeFileSync(cachePath, data);
        fs.writeFileSync(cachePath + '.meta', JSON.stringify(meta));
    } catch (err) {
        console.error('[Cache] Failed to cache:', url, err.message);
    }
}

function getCachedResponse(url) {
    try {
        const cachePath = getCachePath(url);
        if (fs.existsSync(cachePath) && fs.existsSync(cachePath + '.meta')) {
            const data = fs.readFileSync(cachePath);
            const meta = JSON.parse(fs.readFileSync(cachePath + '.meta', 'utf8'));
            return { data, contentType: meta.contentType };
        }
    } catch (err) {
        console.error('[Cache] Failed to read cache:', url, err.message);
    }
    return null;
}

// ──────────────────────────────────────────
// Online/Offline Detection
// ──────────────────────────────────────────
function checkOnlineStatus() {
    return new Promise((resolve) => {
        const testUrl = DOMAIN_URL + '/api/health';
        const request = net.request(testUrl);
        request.on('response', () => resolve(true));
        request.on('error', () => resolve(false));
        setTimeout(() => resolve(false), 5000);
        request.end();
    });
}

async function updateOnlineStatus() {
    const wasOnline = isOnline;
    isOnline = await checkOnlineStatus();

    if (mainWindow) {
        mainWindow.webContents.send('online-status', isOnline);
    }

    // If we just came back online, trigger sync
    if (!wasOnline && isOnline) {
        console.log('[Net] Back online — triggering sync');
        processSyncQueue();
    }

    return isOnline;
}

// ──────────────────────────────────────────
// Sync Engine
// ──────────────────────────────────────────
async function processSyncQueue() {
    if (!db || !isOnline) return;

    const pending = db.prepare(
        `SELECT * FROM sync_queue WHERE status = 'pending' AND attempts < max_attempts ORDER BY created_at ASC LIMIT 20`
    ).all();

    if (pending.length === 0) return;
    console.log(`[Sync] Processing ${pending.length} queued items...`);

    for (const item of pending) {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (item.token) {
                headers['Authorization'] = `Bearer ${item.token}`;
            }

            const response = await fetch(DOMAIN_URL + item.endpoint, {
                method: item.method,
                headers: headers,
                body: item.body
            });

            if (response.ok) {
                db.prepare(`UPDATE sync_queue SET status = 'synced', last_attempt = ? WHERE id = ?`)
                    .run(new Date().toISOString(), item.id);
                console.log(`[Sync] ✓ Synced: ${item.action} (${item.id})`);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (err) {
            const backoff = Math.min(60000, 1000 * Math.pow(2, item.attempts));
            db.prepare(`UPDATE sync_queue SET attempts = attempts + 1, last_attempt = ?, error = ? WHERE id = ?`)
                .run(new Date().toISOString(), err.message, item.id);
            console.log(`[Sync] ✗ Failed: ${item.action} (${item.id}) — retry in ${backoff / 1000}s`);
        }
    }
}

// ──────────────────────────────────────────
// IPC Handlers (exposed via preload.js)
// ──────────────────────────────────────────
function setupIPC() {
    // --- Database Operations ---
    ipcMain.handle('db:get', (_, table, query) => {
        if (!db) return null;
        try {
            if (query) {
                const keys = Object.keys(query);
                const where = keys.map(k => `${k} = ?`).join(' AND ');
                return db.prepare(`SELECT * FROM ${table} WHERE ${where}`).all(...Object.values(query));
            }
            return db.prepare(`SELECT * FROM ${table}`).all();
        } catch (err) { return []; }
    });

    ipcMain.handle('db:upsert', (_, table, data) => {
        if (!db) return false;
        try {
            const keys = Object.keys(data);
            const placeholders = keys.map(() => '?').join(', ');
            const updates = keys.map(k => `${k} = excluded.${k}`).join(', ');
            const stmt = db.prepare(
                `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})
                 ON CONFLICT(${keys[0]}) DO UPDATE SET ${updates}`
            );
            stmt.run(...Object.values(data));
            return true;
        } catch (err) { console.error('[DB] Upsert error:', err); return false; }
    });

    ipcMain.handle('db:delete', (_, table, query) => {
        if (!db) return false;
        try {
            const keys = Object.keys(query);
            const where = keys.map(k => `${k} = ?`).join(' AND ');
            db.prepare(`DELETE FROM ${table} WHERE ${where}`).run(...Object.values(query));
            return true;
        } catch (err) { return false; }
    });

    // --- Sync Queue ---
    ipcMain.handle('sync:queue', (_, action, endpoint, method, body, branchId, token) => {
        if (!db) return false;
        try {
            db.prepare(
                `INSERT INTO sync_queue (action, endpoint, method, body, branch_id, token, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(action, endpoint, method || 'POST', JSON.stringify(body), branchId, token, new Date().toISOString());

            // If online, try to sync immediately
            if (isOnline) processSyncQueue();

            return true;
        } catch (err) { console.error('[Sync] Queue error:', err); return false; }
    });

    ipcMain.handle('sync:status', () => {
        if (!db) return { pending: 0, synced: 0, failed: 0 };
        const pending = db.prepare(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`).get();
        const synced = db.prepare(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'synced'`).get();
        const failed = db.prepare(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'failed' OR attempts >= max_attempts`).get();
        return { pending: pending.count, synced: synced.count, failed: failed.count };
    });

    ipcMain.handle('sync:trigger', () => {
        processSyncQueue();
        return true;
    });

    // --- Cache PIN for offline auth ---
    ipcMain.handle('cache:pin', (_, pin, userId, userData, branchId) => {
        if (!db) return false;
        try {
            db.prepare(
                `INSERT OR REPLACE INTO cached_pins (pin, user_id, user_data, branch_id, cached_at)
                 VALUES (?, ?, ?, ?, ?)`
            ).run(pin, userId, JSON.stringify(userData), branchId, new Date().toISOString());
            return true;
        } catch (err) { return false; }
    });

    ipcMain.handle('cache:verifyPin', (_, pin) => {
        if (!db) return null;
        try {
            const row = db.prepare(`SELECT * FROM cached_pins WHERE pin = ?`).get(pin);
            if (row) return JSON.parse(row.user_data);
            return null;
        } catch (err) { return null; }
    });

    // --- Menu/Category Cache ---
    ipcMain.handle('cache:menuItems', (_, branchId, items) => {
        if (!db) return false;
        try {
            const stmt = db.prepare(
                `INSERT OR REPLACE INTO menu_items (id, branch_id, name, category, price, data, cached_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            );
            const transaction = db.transaction((items) => {
                for (const item of items) {
                    stmt.run(item.id, branchId, item.name, item.category || '', item.price || 0, JSON.stringify(item), new Date().toISOString());
                }
            });
            transaction(items);
            return true;
        } catch (err) { console.error('[Cache] Menu cache error:', err); return false; }
    });

    ipcMain.handle('cache:getMenuItems', (_, branchId) => {
        if (!db) return [];
        try {
            const rows = db.prepare(`SELECT data FROM menu_items WHERE branch_id = ?`).all(branchId);
            return rows.map(r => JSON.parse(r.data));
        } catch (err) { return []; }
    });

    // --- Network Status ---
    ipcMain.handle('net:isOnline', () => isOnline);

    // --- Auto-updater ---
    ipcMain.on('check-for-updates', () => {
        if (!isDev) autoUpdater.checkForUpdatesAndNotify();
    });
}

// ──────────────────────────────────────────
// Window Creation
// ──────────────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        fullscreen: !isDev,
        autoHideMenuBar: true,
        title: 'FG POS Terminal',
        backgroundColor: '#000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            partition: 'persist:pos-cache'
        }
    });

    // Register Escape key to toggle fullscreen
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'Escape' && mainWindow.isFullScreen()) {
            mainWindow.setFullScreen(false);
        }
    });

    // --- Page Caching: intercept responses and cache them ---
    mainWindow.webContents.session.webRequest.onCompleted(
        { urls: ['*://*/*'] },
        (details) => {
            // Only cache successful GET requests for pages, scripts, and styles
            if (details.method === 'GET' && details.statusCode === 200) {
                const ct = (details.responseHeaders?.['content-type'] || [''])[0];
                if (ct.includes('text/html') || ct.includes('javascript') || ct.includes('text/css') || ct.includes('application/json')) {
                    // Mark this URL as cacheable (the actual content is cached by Electron session)
                    if (db) {
                        db.prepare(`INSERT OR REPLACE INTO cache_meta (key, value, updated_at) VALUES (?, ?, ?)`)
                            .run(`cached:${details.url}`, 'true', new Date().toISOString());
                    }
                }
            }
        }
    );

    // Load the terminal page
    const startUrl = DOMAIN_URL + TERMINAL_PATH;

    const loadApp = async () => {
        const online = await updateOnlineStatus();

        if (online) {
            console.log('[App] Online — loading from domain:', startUrl);
            mainWindow.loadURL(startUrl).catch(err => {
                console.error('[App] Failed to load domain, showing offline page:', err.message);
                loadOfflinePage();
            });
        } else {
            console.log('[App] Offline — loading cached/offline page');
            loadOfflinePage();
        }
    };

    loadApp();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function loadOfflinePage() {
    const offlinePath = path.join(__dirname, 'offline.html');
    if (fs.existsSync(offlinePath)) {
        mainWindow.loadFile(offlinePath);
    } else {
        mainWindow.loadURL(`data:text/html,
            <html><body style="background:#111;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui">
            <div style="text-align:center">
                <h1 style="font-size:2em">📡 No Connection</h1>
                <p style="opacity:0.6">Waiting for internet to load POS terminal...</p>
                <p style="opacity:0.4;font-size:0.8em">The app will auto-reload when connected.</p>
            </div></body></html>
        `);
    }
}

// ──────────────────────────────────────────
// Auto-Updater Events
// ──────────────────────────────────────────
autoUpdater.on('checking-for-update', () => console.log('[Update] Checking...'));
autoUpdater.on('update-available', () => console.log('[Update] Available'));
autoUpdater.on('update-not-available', () => console.log('[Update] Up to date'));
autoUpdater.on('error', (err) => console.error('[Update] Error:', err));

autoUpdater.on('download-progress', (p) => {
    console.log(`[Update] ${Math.round(p.percent)}% (${p.transferred}/${p.total})`);
});

autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'A new version has been downloaded. Restart to apply the update.',
        buttons: ['Restart Now']
    }).then(() => autoUpdater.quitAndInstall());
});

// ──────────────────────────────────────────
// App Lifecycle
// ──────────────────────────────────────────
app.on('ready', () => {
    // Initialize database
    initDatabase();

    // Set up IPC handlers
    setupIPC();

    // Create window
    createWindow();

    // Periodically check online status and sync
    setInterval(async () => {
        await updateOnlineStatus();
        if (isOnline) processSyncQueue();
    }, 30000); // Every 30 seconds

    // Check for updates in production
    if (!isDev) {
        autoUpdater.checkForUpdatesAndNotify();
        setInterval(() => autoUpdater.checkForUpdates(), 8 * 60 * 60 * 1000);
    }
});

app.on('window-all-closed', () => {
    if (db) db.close();
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) createWindow();
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}
