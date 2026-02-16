const { app, BrowserWindow, globalShortcut, dialog, ipcMain, session, net, protocol } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { initPowerSync, getPowerSync } = require('./powersync');
const { pathToFileURL } = require('url');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

console.log('[Main] Script loaded, checking lock...');

// ──────────────────────────────────────────
// 1. Single Instance Lock
// ──────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    console.log('[Main] Failed to get lock, quitting...');
    app.quit();
    process.exit(0);
}
console.log('[Main] Lock acquired.');

// ──────────────────────────────────────────
// 2. Schemes Registration (Must be before app ready)
// ──────────────────────────────────────────
protocol.registerSchemesAsPrivileged([
    { scheme: 'pos', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

// ──────────────────────────────────────────
// 3. Configuration
// ──────────────────────────────────────────
const isDev = process.env.ELECTRON_IS_DEV === '1' || process.env.NODE_ENV === 'development' || !app.isPackaged;

if (isDev) {
    app.commandLine.appendSwitch('ignore-certificate-errors');
    app.commandLine.appendSwitch('allow-insecure-localhost');
}

const DOMAIN_URL = isDev ? 'http://127.0.0.1:3001' : 'https://famousgate.hirall.com';
const API_BASE_URL = isDev ? 'http://127.0.0.1:5000' : 'https://api.hirall.com';
const TERMINAL_PATH = '/terminal';
const CACHE_DIR = path.join(app.getPath('userData'), 'page-cache');
const DB_PATH = path.join(app.getPath('userData'), 'pos.db');
const LOG_PATH = path.join(app.getPath('userData'), 'app.log');
const FRONTEND_OUT_PATH = path.join(__dirname, '../frontend/out');
console.log('[Main] FRONTEND_OUT_PATH:', FRONTEND_OUT_PATH);

// ──────────────────────────────────────────
// 5. Shared Events
// ──────────────────────────────────────────
app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

console.log('--- App Startup ---');
console.log('isDev:', isDev);
console.log('app.isPackaged:', app.isPackaged);
console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
console.log('process.env.ELECTRON_IS_DEV:', process.env.ELECTRON_IS_DEV);
console.log('DOMAIN_URL:', DOMAIN_URL);
console.log('API_BASE_URL:', API_BASE_URL);
console.log('-------------------');

// ──────────────────────────────────────────
// Logger
// ──────────────────────────────────────────
function log(msg, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${type}] ${msg}\n`;
    console.log(line.trim());
    try { fs.appendFileSync(LOG_PATH, line); } catch (e) { }
}


let mainWindow;
let backendProcess;
let isOnline = true;
let db = null;
let powersync = null;

// PowerSync handles all database operations now.
// Legacy SQLite (pos.db) is removed.

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
/**
 * Check if the backend API is reachable
 */
async function checkOnlineStatus() {
    try {
        const testUrl = API_BASE_URL + '/api/health';

        // Use global fetch (Node 18+) instead of net.request for simplicity in health check
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(testUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: { 'Cache-Control': 'no-cache' }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            if (!isOnline) log('Backend is reachable, back ONLINE');
            return true;
        } else {
            log(`Backend health check failed: ${response.status}`, 'WARN');
            return false;
        }
    } catch (err) {
        log(`Network check failed: ${err.message}`, 'WARN');
        return false;
    }
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
    const ps = getPowerSync();
    if (!ps || !isOnline) return;

    const pending = await ps.getAll(
        `SELECT * FROM sync_queue WHERE status = 'pending' AND attempts < max_attempts ORDER BY created_at ASC LIMIT 20`
    );

    if (pending.length === 0) return;
    console.log(`[Sync] Processing ${pending.length} queued items...`);

    for (const item of pending) {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (item.token) {
                headers['Authorization'] = `Bearer ${item.token}`;
            }

            const response = await fetch(API_BASE_URL + item.endpoint, {
                method: item.method,
                headers: headers,
                body: item.body
            });

            if (response.ok) {
                await ps.execute(`UPDATE sync_queue SET status = 'synced', last_attempt = ? WHERE id = ?`, [new Date().toISOString(), item.id]);
                console.log(`[Sync] ✓ Synced: ${item.action} (${item.id})`);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (err) {
            const backoff = Math.min(60000, 1000 * Math.pow(2, item.attempts));
            await ps.execute(`UPDATE sync_queue SET attempts = attempts + 1, last_attempt = ?, error = ? WHERE id = ?`, [new Date().toISOString(), err.message, item.id]);
            console.log(`[Sync] ✗ Failed: ${item.action} (${item.id}) — retry in ${backoff / 1000}s`);
        }
    }
}

// ──────────────────────────────────────────
// IPC Handlers (exposed via preload.js)
// ──────────────────────────────────────────
function setupIPC() {
    // --- Database Operations ---
    ipcMain.handle('db:get', async (_, table, query) => {
        const ps = getPowerSync();
        if (!ps) return null;
        try {
            if (query) {
                const keys = Object.keys(query);
                const where = keys.map(k => `${k} = ?`).join(' AND ');
                return await ps.getAll(`SELECT * FROM ${table} WHERE ${where}`, Object.values(query));
            }
            return await ps.getAll(`SELECT * FROM ${table}`);
        } catch (err) { return []; }
    });

    ipcMain.handle('db:upsert', async (_, table, data) => {
        const ps = getPowerSync();
        if (!ps) return false;
        try {
            const keys = Object.keys(data);
            const placeholders = keys.map(() => '?').join(', ');
            // Note: PowerSync uses a slightly different syntax for upserts or you can use execute
            // For simplicity, we'll try an INSERT OR REPLACE if the table permits, 
            // but PowerSync handles a lot of this via sync rules.
            // Here we just execute a raw SQL for now to maintain compatibility with the old API.
            const query = `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
            await ps.execute(query, Object.values(data));
            return true;
        } catch (err) { console.error('[DB] Upsert error:', err); return false; }
    });

    ipcMain.handle('db:delete', async (_, table, query) => {
        const ps = getPowerSync();
        if (!ps) return false;
        try {
            const keys = Object.keys(query);
            const where = keys.map(k => `${k} = ?`).join(' AND ');
            await ps.execute(`DELETE FROM ${table} WHERE ${where}`, Object.values(query));
            return true;
        } catch (err) { return false; }
    });

    // --- Sync Queue ---
    ipcMain.handle('sync:queue', async (_, action, endpoint, method, body, branchId, token) => {
        const ps = getPowerSync();
        if (!ps) return false;
        try {
            await ps.execute(
                `INSERT INTO sync_queue (action, endpoint, method, body, branch_id, token, status, attempts, max_attempts, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [action, endpoint, method || 'POST', JSON.stringify(body), branchId, token, 'pending', 0, 10, new Date().toISOString()]
            );

            // If online, try to sync immediately
            if (isOnline) processSyncQueue();

            return true;
        } catch (err) { console.error('[Sync] Queue error:', err); return false; }
    });

    ipcMain.handle('sync:status', async () => {
        const ps = getPowerSync();
        if (!ps) return { pending: 0, synced: 0, failed: 0 };
        const pending = await ps.get(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`);
        const synced = await ps.get(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'synced'`);
        const failed = await ps.get(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'failed' OR attempts >= max_attempts`);
        return { pending: pending.count, synced: synced.count, failed: failed.count };
    });

    ipcMain.handle('sync:trigger', () => {
        processSyncQueue();
        return true;
    });

    // --- Cache PIN for offline auth ---
    ipcMain.handle('cache:pin', async (_, pin, userId, userData, branchId) => {
        const ps = getPowerSync();
        if (!ps) return false;
        try {
            console.log(`[Cache] Caching PIN for user ${userId} at branch ${branchId}`);
            // PIN is used as ID to ensure INSERT OR REPLACE works (one cache entry per PIN)
            await ps.execute(
                `INSERT OR REPLACE INTO cached_pins (id, user_id, user_data, branch_id, cached_at)
                 VALUES (?, ?, ?, ?, ?)`,
                [pin, userId, JSON.stringify(userData), branchId, new Date().toISOString()]
            );
            console.log(`[Cache] PIN cached successfully for ${pin}`);
            return true;
        } catch (err) {
            console.error('[Cache] PIN caching failed:', err);
            return false;
        }
    });

    ipcMain.handle('cache:verifyPin', async (_, pin) => {
        const ps = getPowerSync();
        if (!ps) return null;
        try {
            console.log(`[Cache] Verifying PIN offline...`);
            // We use 'id' because PIN was stored in the ID column for unique constraint
            const row = await ps.get(`SELECT * FROM cached_pins WHERE id = ?`, [pin]);
            if (row) {
                console.log(`[Cache] PIN verified successfully for user_id: ${row.user_id}`);
                return JSON.parse(row.user_data);
            }
            console.warn(`[Cache] PIN not found in offline cache`);
            return null;
        } catch (err) {
            console.error('[Cache] Offline PIN verification error:', err);
            return null;
        }
    });

    // --- Import Users from Supabase ---
    ipcMain.handle('import:users', async () => {
        const ps = getPowerSync();
        if (!ps) {
            console.error('[Import] PowerSync not initialized');
            return { success: false, error: 'PowerSync not initialized' };
        }

        try {
            console.log('[Import] Starting user import from Supabase...');

            // Initialize Supabase client
            const { createClient } = require('@supabase/supabase-js');
            const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
            // Use service role key to bypass RLS policies
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

            console.log('[Import] Using service role key:', supabaseKey ? 'YES (length: ' + supabaseKey.length + ')' : 'NO');
            console.log('[Import] Service role key starts with:', supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'N/A');

            if (!supabaseUrl || !supabaseKey) {
                throw new Error('Supabase credentials not found');
            }

            const supabase = createClient(supabaseUrl, supabaseKey);

            // Fetch all users with PINs
            const { data: users, error } = await supabase
                .from('users')
                .select('id, email, first_name, last_name, role, branch_id, pos_pin, status')
                .not('pos_pin', 'is', null);

            if (error) throw error;

            if (!users || users.length === 0) {
                console.log('[Import] No users with PINs found');
                return { success: true, imported: 0, message: 'No users with PINs found' };
            }

            console.log(`[Import] Found ${users.length} users with PINs`);

            // Clear existing cached PINs
            await ps.execute('DELETE FROM cached_pins');
            console.log('[Import] Cleared existing cached PINs');

            // Import each user
            let successCount = 0;
            let errorCount = 0;

            for (const user of users) {
                try {
                    const userData = {
                        id: user.id,
                        email: user.email,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        role: user.role,
                        branch_id: user.branch_id,
                        status: user.status
                    };

                    await ps.execute(
                        `INSERT OR REPLACE INTO cached_pins (id, user_id, user_data, branch_id, cached_at)
                         VALUES (?, ?, ?, ?, ?)`,
                        [
                            user.pos_pin,
                            user.id,
                            JSON.stringify(userData),
                            user.branch_id || null,
                            new Date().toISOString()
                        ]
                    );

                    console.log(`[Import] ✓ Cached: ${user.pos_pin} - ${user.first_name} ${user.last_name}`);
                    successCount++;
                } catch (err) {
                    console.error(`[Import] ✗ Failed to cache ${user.pos_pin}:`, err.message);
                    errorCount++;
                }
            }

            console.log(`[Import] Complete - Success: ${successCount}, Errors: ${errorCount}`);

            return {
                success: true,
                imported: successCount,
                errors: errorCount,
                total: users.length
            };

        } catch (err) {
            console.error('[Import] User import failed:', err);
            return { success: false, error: err.message };
        }
    });


    // --- Menu/Category Cache ---
    ipcMain.handle('cache:menuItems', async (_, branchId, items) => {
        const ps = getPowerSync();
        if (!ps) return false;
        try {
            await ps.writeTransaction(async (tx) => {
                for (const item of items) {
                    await tx.execute(
                        `INSERT OR REPLACE INTO menu_items (id, branch_id, name, category, price, data, cached_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [item.id, branchId, item.name, item.category || '', item.price || 0, JSON.stringify(item), new Date().toISOString()]
                    );
                }
            });
            return true;
        } catch (err) { console.error('[Cache] Menu cache error:', err); return false; }
    });

    ipcMain.handle('cache:getMenuItems', async (_, branchId) => {
        const ps = getPowerSync();
        if (!ps) return [];
        try {
            const rows = await ps.getAll(`SELECT data FROM menu_items WHERE branch_id = ?`, [branchId]);
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
            partition: 'persist:pos-cache',
            webSecurity: !isDev // Disable in dev for CORS flexibility
        }
    });

    // Register Escape key to toggle fullscreen
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'Escape' && mainWindow.isFullScreen()) {
            mainWindow.setFullScreen(false);
        }
    });

    // --- CORS & Security Fixes for Development ---
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
        { urls: ['*://127.0.0.1/*', '*://localhost/*'] },
        (details, callback) => {
            if (isDev) {
                // For Private Network Access (PNA) preflights
                details.requestHeaders['Access-Control-Request-Private-Network'] = 'true';
            }
            callback({ requestHeaders: details.requestHeaders });
        }
    );

    mainWindow.webContents.session.webRequest.onHeadersReceived(
        { urls: ['*://127.0.0.1/*', '*://localhost/*'] },
        (details, callback) => {
            if (isDev && details.responseHeaders) {
                details.responseHeaders['Access-Control-Allow-Private-Network'] = ['true'];
                details.responseHeaders['Access-Control-Allow-Origin'] = ['*'];
                details.responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS, PUT, PATCH, DELETE'];
                details.responseHeaders['Access-Control-Allow-Headers'] = ['*'];
            }
            callback({ responseHeaders: details.responseHeaders });
        }
    );

    mainWindow.webContents.session.webRequest.onCompleted(
        { urls: ['*://*/*'] },
        (details) => {
            // Only cache successful GET requests for pages, scripts, and styles
            if (details.method === 'GET' && details.statusCode === 200) {
                const ct = (details.responseHeaders?.['content-type'] || [''])[0];
                if (ct.includes('text/html') || ct.includes('javascript') || ct.includes('text/css') || ct.includes('application/json')) {
                    // Mark this URL as cacheable (the actual content is cached by Electron session)
                    if (powersync) {
                        powersync.execute(`INSERT OR REPLACE INTO cache_meta (key, value, updated_at) VALUES (?, ?, ?)`, [`cached:${details.url}`, 'true', new Date().toISOString()]);
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

    // Handle load failures gracefully
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.warn(`[App] Failed to load URL: ${validatedURL} (${errorCode}: ${errorDescription})`);
        // Only trigger offline page for main domain failures
        if (validatedURL.startsWith(DOMAIN_URL)) {
            loadOfflinePage();
        }
    });

    // Handle protocol navigation failures (e.g. missing file in local build)
    mainWindow.webContents.on('did-fail-provisional-load', (event, errorCode, errorDescription, validatedURL) => {
        if (validatedURL.startsWith('pos://')) {
            console.error(`[App] Local UI load failed: ${validatedURL} (${errorCode}: ${errorDescription})`);
            // Fallback to minimal data URL if even the local file fails
            mainWindow.loadURL(`data:text/html,<h1>Local UI Missing</h1><p>Please check frontend/out directory.</p>`).catch(() => { });
        }
    });
}

function loadOfflinePage() {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const url = 'pos://terminal.html';
    console.log(`[App] Switching to local offline UI: ${url}`);
    mainWindow.loadURL(url).catch(err => {
        console.error(`[App] Failed to load ${url}: ${err.message} (code: ${err.code})`);

        // Final fallback to static offline.html if protocol fails
        const offlinePath = path.join(__dirname, 'offline.html');
        if (fs.existsSync(offlinePath)) {
            console.log('[App] Falling back to static offline.html');
            mainWindow.loadFile(offlinePath).catch(() => { });
        }
    });
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
    // Register custom protocol on the specific session used by the window
    const ses = session.fromPartition('persist:pos-cache');
    ses.protocol.registerFileProtocol('pos', (request, callback) => {
        try {
            console.log(`[Protocol] Request: ${request.url}`);
            const url = new URL(request.url);
            let pathname = url.pathname;

            // If pos://terminal.html, host is terminal.html and pathname is /
            if (pathname === '/' || !pathname) {
                pathname = url.hostname || 'terminal.html';
            }
            if (pathname.startsWith('/')) pathname = pathname.substring(1);

            const filePath = path.join(FRONTEND_OUT_PATH, pathname.replace(/\//g, path.sep));

            let finalPath = filePath;
            if (!fs.existsSync(finalPath) && fs.existsSync(finalPath + '.html')) {
                finalPath += '.html';
            }

            console.log(`[Protocol] Serving: ${finalPath}`);
            callback({ path: finalPath });
        } catch (err) {
            console.error(`[Protocol] Error:`, err);
            callback({ error: -2 }); // ERR_FAILED
        }
    });

    // Initialize PowerSync
    powersync = initPowerSync();

    // Set up IPC handlers
    setupIPC();

    // Auto-import users on startup if cache is empty
    setTimeout(async () => {
        try {
            const ps = getPowerSync();
            if (!ps) return;

            const count = await ps.get('SELECT COUNT(*) as count FROM cached_pins');
            if (count && count.count === 0) {
                console.log('[Auto-Import] No cached PINs found, importing users from Supabase...');

                const { createClient } = require('@supabase/supabase-js');
                const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
                // Use service role key to bypass RLS policies
                const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

                console.log('[Auto-Import] Service role key available:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
                console.log('[Auto-Import] Using key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON');
                console.log('[Auto-Import] Key length:', supabaseKey ? supabaseKey.length : 0);

                if (supabaseUrl && supabaseKey) {
                    const supabase = createClient(supabaseUrl, supabaseKey);
                    const { data: users, error } = await supabase
                        .from('users')
                        .select('id, email, first_name, last_name, role, branch_id, pos_pin, status')
                        .not('pos_pin', 'is', null);

                    if (!error && users && users.length > 0) {
                        console.log(`[Auto-Import] Found ${users.length} users, caching...`);

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

                                await ps.execute(
                                    `INSERT OR REPLACE INTO cached_pins (id, user_id, user_data, branch_id, cached_at)
                                     VALUES (?, ?, ?, ?, ?)`,
                                    [user.pos_pin, user.id, userData, user.branch_id || null, new Date().toISOString()]
                                );
                            } catch (err) {
                                console.error(`[Auto-Import] Failed to cache ${user.pos_pin}:`, err.message);
                            }
                        }

                        const newCount = await ps.get('SELECT COUNT(*) as count FROM cached_pins');
                        console.log(`[Auto-Import] ✓ Imported ${newCount.count} users successfully`);
                    }
                }
            } else {
                console.log(`[Auto-Import] Found ${count.count} cached PINs, skipping import`);
            }
        } catch (err) {
            console.error('[Auto-Import] Error:', err.message);
        }
    }, 2000); // Wait 2 seconds after app starts

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
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) createWindow();
});


// End of file
