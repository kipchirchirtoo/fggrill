const { app, BrowserWindow, globalShortcut, dialog, ipcMain, session, net, protocol } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { initDatabase, get, getAll, execute, transaction } = require('./database');
const { pathToFileURL } = require('url');
// ──────────────────────────────────────────
// Hardcoded Credentials (Permanent Fix for Packaged App)
// ──────────────────────────────────────────
const HARDCODED_SUPABASE_URL = 'https://utsvlihpudfraxzcmtle.supabase.co';
const HARDCODED_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MTYzMzIsImV4cCI6MjA3OTQ5MjMzMn0.wPONqSZvgQQyrssA4wTbBfaUJO5HrV_XtA2AD7PaweA';
const HARDCODED_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY';
const HARDCODED_POWERSYNC_URL = 'https://699224f042bd91af920c6b3c.powersync.journeyapps.com';

// Force hardcoded values to ensure they're always available
process.env.VITE_SUPABASE_URL = HARDCODED_SUPABASE_URL;
process.env.VITE_SUPABASE_ANON_KEY = HARDCODED_ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = HARDCODED_SERVICE_ROLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL = HARDCODED_SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = HARDCODED_ANON_KEY;
process.env.VITE_POWERSYNC_URL = HARDCODED_POWERSYNC_URL;
process.env.NEXT_PUBLIC_POWERSYNC_URL = HARDCODED_POWERSYNC_URL;

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
    { scheme: 'pos', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, allowServiceWorkers: true } }
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
const FRONTEND_OUT_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'frontend')
    : path.join(__dirname, '../frontend/out');
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

// Direct SQLite database for offline operations
// Simpler than PowerSync, no additional dependencies needed

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
        // Try multiple endpoints to determine if we're online
        const endpoints = [
            API_BASE_URL + '/api/health',
            API_BASE_URL + '/health',
            API_BASE_URL + '/',
            'https://www.google.com' // Fallback to check general internet connectivity
        ];

        for (const testUrl of endpoints) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout per endpoint

                const response = await fetch(testUrl, {
                    method: 'GET',
                    signal: controller.signal,
                    headers: { 'Cache-Control': 'no-cache' }
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    if (!isOnline) {
                        log(`Backend is reachable at ${testUrl}, back ONLINE`);
                    }
                    return true;
                }
            } catch (endpointErr) {
                // Try next endpoint
                continue;
            }
        }

        // All endpoints failed
        if (isOnline) {
            log('All health check endpoints failed, going OFFLINE', 'WARN');
        }
        return false;
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
let autoSyncInterval = null;

const performUserSync = async () => {
    try {
        console.log('[Auto-Sync] Checking for new users...');

        const { createClient } = require('@supabase/supabase-js');
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error('[Auto-Sync] Supabase credentials not found');
            return { success: false, error: 'Missing credentials' };
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        if (!db) {
            console.error('[Auto-Sync] Database not initialized');
            return { success: false, error: 'Database not initialized' };
        }

        // Get existing user IDs from cache
        const existingUsers = getAll('SELECT user_id FROM cached_pins');
        const existingUserIds = new Set(existingUsers.map(u => u.user_id));

        // Fetch all users from Supabase
        const { data: users, error } = await supabase
            .from('users')
            .select('id, first_name, last_name, email, role, pos_pin, branch_id')
            .not('pos_pin', 'is', null);

        if (error) {
            console.error('[Auto-Sync] Error fetching users:', error);
            return { success: false, error: error.message };
        }

        // Filter for new users only
        const newUsers = users.filter(u => !existingUserIds.has(u.id));

        if (newUsers.length === 0) {
            console.log('[Auto-Sync] No new users found');
            return { success: true, newCount: 0, totalCount: users.length };
        }

        console.log(`[Auto-Sync] Found ${newUsers.length} new user(s), syncing...`);

        // Insert new users
        for (const user of newUsers) {
            execute(
                `INSERT OR REPLACE INTO cached_pins (id, user_id, user_data, branch_id, cached_at)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    user.pos_pin,
                    user.id,
                    JSON.stringify({
                        id: user.id,
                        firstName: user.first_name,
                        first_name: user.first_name,
                        lastName: user.last_name,
                        last_name: user.last_name,
                        email: user.email,
                        role: user.role,
                        pos_pin: user.pos_pin,
                        branch_id: user.branch_id
                    }),
                    user.branch_id || 0,
                    new Date().toISOString()
                ]
            );
        }

        console.log(`[Auto-Sync] ✓ Synced ${newUsers.length} new user(s) successfully`);
        return { success: true, newCount: newUsers.length, totalCount: users.length };
    } catch (err) {
        console.error('[Auto-Sync] Sync failed:', err);
        return { success: false, error: err.message };
    }
};

const performMenuSync = async (branchId = null) => {
    try {
        console.log('[Menu Auto-Sync] Starting menu sync...');

        const { createClient } = require('@supabase/supabase-js');
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error('[Menu Auto-Sync] Supabase credentials not found');
            return { success: false, error: 'Missing credentials', categoriesCount: 0, itemsCount: 0 };
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        if (!db) {
            console.error('[Menu Auto-Sync] Database not initialized');
            return { success: false, error: 'Database not initialized', categoriesCount: 0, itemsCount: 0 };
        }

        // Phase 1: Fetch and cache categories
        console.log('[Menu Auto-Sync] Fetching categories...');
        const { data: categories, error: categoriesError } = await supabase
            .from('restaurant_menu_categories')
            .select('id, name, description, sort_order, is_active, is_bar');

        if (categoriesError) {
            console.error('[Menu Auto-Sync] Error fetching categories:', categoriesError);
            return { success: false, error: categoriesError.message, categoriesCount: 0, itemsCount: 0 };
        }

        console.log(`[Menu Auto-Sync] Found ${categories?.length || 0} categories`);

        // Cache categories using transaction
        let categoriesCached = 0;
        if (categories && categories.length > 0) {
            try {
                transaction(() => {
                    for (const category of categories) {
                        try {
                            execute(
                                `INSERT OR REPLACE INTO restaurant_menu_categories (id, name, description, sort_order, is_active, is_bar)
                                 VALUES (?, ?, ?, ?, ?, ?)`,
                                [
                                    category.id,
                                    category.name,
                                    category.description || null,
                                    category.sort_order || 0,
                                    category.is_active ? 1 : 0,
                                    category.is_bar ? 1 : 0
                                ]
                            );
                            categoriesCached++;
                        } catch (err) {
                            console.error(`[Menu Auto-Sync] Failed to cache category ${category.id}:`, err.message);
                        }
                    }
                });
                console.log(`[Menu Auto-Sync] ✓ Cached ${categoriesCached} categories`);
            } catch (err) {
                console.error('[Menu Auto-Sync] Transaction error for categories:', err.message);
            }
        }

        // Phase 2: Fetch and cache menu items
        console.log('[Menu Auto-Sync] Fetching menu items...');
        let itemsQuery = supabase
            .from('restaurant_menu_items')
            .select('id, category_id, branch_id, name, description, price, image_url, is_available, is_vegetarian, is_spicy, preparation_time, created_at, updated_at');

        // Apply branch filter if provided (include null branch_id items for all branches)
        if (branchId !== null) {
            itemsQuery = itemsQuery.or(`branch_id.eq.${branchId},branch_id.is.null`);
        }

        const { data: items, error: itemsError } = await itemsQuery;

        if (itemsError) {
            console.error('[Menu Auto-Sync] Error fetching menu items:', itemsError);
            return { success: false, error: itemsError.message, categoriesCount: categoriesCached, itemsCount: 0 };
        }

        console.log(`[Menu Auto-Sync] Found ${items?.length || 0} menu items`);

        // Cache menu items using transaction
        let itemsCached = 0;
        if (items && items.length > 0) {
            try {
                transaction(() => {
                    for (const item of items) {
                        try {
                            execute(
                                `INSERT OR REPLACE INTO restaurant_menu_items (id, category_id, branch_id, name, description, price, image_url, is_available, is_vegetarian, is_spicy, preparation_time, created_at, updated_at)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    item.id,
                                    item.category_id || null,
                                    item.branch_id || null,
                                    item.name,
                                    item.description || null,
                                    item.price || 0,
                                    item.image_url || null,
                                    item.is_available ? 1 : 0,
                                    item.is_vegetarian ? 1 : 0,
                                    item.is_spicy ? 1 : 0,
                                    item.preparation_time || null,
                                    item.created_at || new Date().toISOString(),
                                    item.updated_at || new Date().toISOString()
                                ]
                            );
                            itemsCached++;
                        } catch (err) {
                            console.error(`[Menu Auto-Sync] Failed to cache item ${item.id}:`, err.message);
                        }
                    }
                });
                console.log(`[Menu Auto-Sync] ✓ Cached ${itemsCached} menu items`);
            } catch (err) {
                console.error('[Menu Auto-Sync] Transaction error for items:', err.message);
            }
        }

        console.log(`[Menu Auto-Sync] ✓ Sync complete - ${categoriesCached} categories, ${itemsCached} items`);
        return { success: true, categoriesCount: categoriesCached, itemsCount: itemsCached };
    } catch (err) {
        console.error('[Menu Auto-Sync] Sync failed:', err);
        return { success: false, error: err.message, categoriesCount: 0, itemsCount: 0 };
    }
};

// ──────────────────────────────────────────
// Orders Auto-Sync Function
// ──────────────────────────────────────────
const performOrdersSync = async (branchId = null, daysBack = 1) => {
    try {
        console.log('[Orders Auto-Sync] Starting orders sync...');

        const { createClient } = require('@supabase/supabase-js');
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error('[Orders Auto-Sync] Supabase credentials not found');
            return { success: false, error: 'Missing credentials', ordersCount: 0, itemsCount: 0 };
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        if (!db) {
            console.error('[Orders Auto-Sync] Database not initialized');
            return { success: false, error: 'Database not initialized', ordersCount: 0, itemsCount: 0 };
        }

        // Calculate date range (default: last 1 day)
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - daysBack);
        
        const fromDateStr = fromDate.toISOString().split('T')[0];
        const toDateStr = toDate.toISOString().split('T')[0];

        console.log(`[Orders Auto-Sync] Fetching orders from ${fromDateStr} to ${toDateStr}...`);

        // Fetch orders
        let ordersQuery = supabase
            .from('restaurant_orders')
            .select('*')
            .gte('created_at', fromDateStr)
            .lte('created_at', toDateStr + 'T23:59:59');

        // Apply branch filter if provided
        if (branchId !== null) {
            ordersQuery = ordersQuery.eq('branch_id', branchId);
        }

        const { data: orders, error: ordersError } = await ordersQuery;

        if (ordersError) {
            console.error('[Orders Auto-Sync] Error fetching orders:', ordersError);
            return { success: false, error: ordersError.message, ordersCount: 0, itemsCount: 0 };
        }

        console.log(`[Orders Auto-Sync] Found ${orders?.length || 0} orders`);

        if (!orders || orders.length === 0) {
            console.log('[Orders Auto-Sync] No orders to sync');
            return { success: true, ordersCount: 0, itemsCount: 0 };
        }

        // Fetch order items for all orders
        const orderIds = orders.map(o => o.id);
        const { data: orderItems, error: itemsError } = await supabase
            .from('restaurant_order_items')
            .select('*')
            .in('order_id', orderIds);

        if (itemsError) {
            console.error('[Orders Auto-Sync] Error fetching order items:', itemsError);
        }

        console.log(`[Orders Auto-Sync] Found ${orderItems?.length || 0} order items`);

        // Cache orders and items using transaction
        let ordersCached = 0;
        let itemsCached = 0;

        try {
            transaction(() => {
                // Cache orders
                for (const order of orders) {
                    try {
                        execute(
                            `INSERT OR REPLACE INTO restaurant_orders (
                                id, order_number, branch_id, table_number, room_number,
                                guest_id, guest_name, order_type, status, total_amount,
                                payment_status, payment_method, special_instructions,
                                waiter_id, waiter_name, created_at, updated_at, created_by
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                order.id,
                                order.order_number,
                                order.branch_id,
                                order.table_number || null,
                                order.room_number || null,
                                order.guest_id || null,
                                order.guest_name || null,
                                order.order_type,
                                order.status,
                                order.total_amount || order.total || 0,
                                order.payment_status || null,
                                order.payment_method || null,
                                order.special_instructions || null,
                                order.waiter_id || null,
                                order.waiter_name || null,
                                order.created_at,
                                order.updated_at || order.created_at,
                                order.created_by || null
                            ]
                        );
                        ordersCached++;
                    } catch (err) {
                        console.error(`[Orders Auto-Sync] Failed to cache order ${order.id}:`, err.message);
                    }
                }

                // Cache order items
                if (orderItems && orderItems.length > 0) {
                    for (const item of orderItems) {
                        try {
                            execute(
                                `INSERT OR REPLACE INTO restaurant_order_items (
                                    id, order_id, menu_item_id, quantity, unit_price,
                                    total_price, special_instructions, created_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    item.id,
                                    item.order_id,
                                    item.menu_item_id || null,
                                    item.quantity,
                                    item.unit_price || 0,
                                    item.total_price || (item.quantity * (item.unit_price || 0)),
                                    item.special_instructions || null,
                                    item.created_at
                                ]
                            );
                            itemsCached++;
                        } catch (err) {
                            console.error(`[Orders Auto-Sync] Failed to cache item ${item.id}:`, err.message);
                        }
                    }
                }
            });

            console.log(`[Orders Auto-Sync] ✓ Cached ${ordersCached} orders and ${itemsCached} items`);
        } catch (err) {
            console.error('[Orders Auto-Sync] Transaction error:', err.message);
        }

        console.log(`[Orders Auto-Sync] ✓ Sync complete - ${ordersCached} orders, ${itemsCached} items`);
        return { success: true, ordersCount: ordersCached, itemsCount: itemsCached };
    } catch (err) {
        console.error('[Orders Auto-Sync] Sync failed:', err);
        return { success: false, error: err.message, ordersCount: 0, itemsCount: 0 };
    }
};

async function processSyncQueue() {
    if (!db || !isOnline) return;

    const pending = getAll(
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
                execute(`UPDATE sync_queue SET status = 'synced', last_attempt = ? WHERE id = ?`, [new Date().toISOString(), item.id]);
                console.log(`[Sync] ✓ Synced: ${item.action} (${item.id})`);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (err) {
            const backoff = Math.min(60000, 1000 * Math.pow(2, item.attempts));
            execute(`UPDATE sync_queue SET attempts = attempts + 1, last_attempt = ?, error = ? WHERE id = ?`, [new Date().toISOString(), err.message, item.id]);
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
        if (!db) return null;
        try {
            // Check if query has actual keys (not just an empty object)
            if (query && Object.keys(query).length > 0) {
                const keys = Object.keys(query);
                const where = keys.map(k => `${k} = ?`).join(' AND ');
                return getAll(`SELECT * FROM ${table} WHERE ${where}`, Object.values(query));
            }
            return getAll(`SELECT * FROM ${table}`);
        } catch (err) { 
            console.error('[IPC] db:get error:', err);
            return []; 
        }
    });

    ipcMain.handle('db:upsert', async (_, table, data) => {
        if (!db) return false;
        try {
            const keys = Object.keys(data);
            const placeholders = keys.map(() => '?').join(', ');
            const query = `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
            execute(query, Object.values(data));
            return true;
        } catch (err) { 
            console.error('[IPC] db:upsert error:', err);
            return false; 
        }
    });

    ipcMain.handle('db:delete', async (_, table, query) => {
        if (!db) return false;
        try {
            const keys = Object.keys(query);
            const where = keys.map(k => `${k} = ?`).join(' AND ');
            execute(`DELETE FROM ${table} WHERE ${where}`, Object.values(query));
            return true;
        } catch (err) { 
            console.error('[IPC] db:delete error:', err);
            return false; 
        }
    });

    // --- Sync Queue ---
    ipcMain.handle('sync:queue', async (_, action, endpoint, method, body, branchId, token) => {
        if (!db) return false;
        try {
            execute(
                `INSERT INTO sync_queue (action, endpoint, method, body, branch_id, token, status, attempts, max_attempts, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [action, endpoint, method || 'POST', JSON.stringify(body), branchId, token, 'pending', 0, 10, new Date().toISOString()]
            );

            // If online, try to sync immediately
            if (isOnline) processSyncQueue();

            return true;
        } catch (err) { 
            console.error('[IPC] sync:queue error:', err);
            return false; 
        }
    });

    ipcMain.handle('sync:status', async () => {
        if (!db) return { pending: 0, synced: 0, failed: 0 };
        try {
            const pending = get(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`);
            const synced = get(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'synced'`);
            const failed = get(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'failed' OR attempts >= max_attempts`);
            return {
                pending: pending?.count || 0,
                synced: synced?.count || 0,
                failed: failed?.count || 0
            };
        } catch (err) {
            console.error('[IPC] sync:status error:', err);
            return { pending: 0, synced: 0, failed: 0 };
        }
    });

    ipcMain.handle('sync:trigger', () => {
        processSyncQueue();
        return true;
    });

    ipcMain.handle('sync:clear', async () => {
        if (!db) return { success: false, error: 'Database not initialized' };
        try {
            console.log('[Sync] Clearing sync queue...');
            execute(`DELETE FROM sync_queue WHERE status = 'pending' OR status = 'failed' OR attempts >= max_attempts`);
            const remaining = get(`SELECT COUNT(*) as count FROM sync_queue`);
            console.log(`[Sync] ✓ Cleared sync queue. Remaining: ${remaining?.count || 0}`);
            return { success: true, cleared: true, remaining: remaining?.count || 0 };
        } catch (err) {
            console.error('[Sync] Error clearing queue:', err);
            return { success: false, error: err.message };
        }
    });

    // --- Get Orders from Cache ---
    ipcMain.handle('cache:getOrders', async (_, userId, branchId, fromDate, toDate) => {
        if (!db) return [];
        try {
            console.log(`[Cache] Getting orders for user ${userId}, branch ${branchId}, from ${fromDate} to ${toDate}`);
            
            let query = `
                SELECT o.*, 
                    (SELECT json_group_array(json_object(
                        'id', i.id,
                        'order_id', i.order_id,
                        'menu_item_id', i.menu_item_id,
                        'quantity', i.quantity,
                        'unit_price', i.unit_price,
                        'total_price', i.total_price,
                        'special_instructions', i.special_instructions,
                        'created_at', i.created_at,
                        'name', m.name
                    ))
                    FROM restaurant_order_items i
                    LEFT JOIN restaurant_menu_items m ON i.menu_item_id = m.id
                    WHERE i.order_id = o.id
                    ) as items
                FROM restaurant_orders o
                WHERE 1=1
            `;
            
            const params = [];
            
            // Filter by user (created_by or waiter_id)
            if (userId) {
                query += ` AND (o.created_by = ? OR o.waiter_id = ?)`;
                params.push(userId, userId);
            }
            
            // Filter by branch
            if (branchId) {
                query += ` AND o.branch_id = ?`;
                params.push(branchId);
            }
            
            // Filter by date range
            if (fromDate) {
                query += ` AND DATE(o.created_at) >= DATE(?)`;
                params.push(fromDate);
            }
            if (toDate) {
                query += ` AND DATE(o.created_at) <= DATE(?)`;
                params.push(toDate);
            }
            
            query += ` ORDER BY o.created_at DESC`;
            
            const orders = getAll(query, params);
            
            // Parse items JSON for each order
            const ordersWithItems = orders.map(order => ({
                ...order,
                items: order.items ? JSON.parse(order.items) : [],
                total: order.total_amount || order.total || 0
            }));
            
            console.log(`[Cache] Found ${ordersWithItems.length} orders`);
            return ordersWithItems;
        } catch (err) {
            console.error('[Cache] Error getting orders:', err);
            return [];
        }
    });

    // --- Cache PIN for offline auth ---
    ipcMain.handle('cache:pin', async (_, pin, userId, userData, branchId) => {
        if (!db) return false;
        try {
            console.log(`[Cache] Caching PIN for user ${userId} at branch ${branchId}`);
            execute(
                `INSERT OR REPLACE INTO cached_pins (id, user_id, user_data, branch_id, cached_at)
                 VALUES (?, ?, ?, ?, ?)`,
                [pin, userId, JSON.stringify(userData), branchId, new Date().toISOString()]
            );
            console.log(`[Cache] ✓ PIN cached successfully for ${pin}`);
            return true;
        } catch (err) {
            console.error('[Cache] PIN caching failed:', err);
            return false;
        }
    });

    ipcMain.handle('cache:verifyPin', async (_, pin) => {
        if (!db) return null;
        try {
            console.log(`[Cache] Verifying PIN: ${pin}`);
            const row = get(`SELECT * FROM cached_pins WHERE id = ?`, [pin]);
            if (row) {
                console.log(`[Cache] ✓ PIN verified for user_id: ${row.user_id}`);
                const userData = JSON.parse(row.user_data);
                
                // Normalize user data to ensure both snake_case and camelCase name fields exist
                const normalizedUser = {
                    ...userData,
                    first_name: userData.first_name || userData.firstName || '',
                    last_name: userData.last_name || userData.lastName || '',
                    firstName: userData.firstName || userData.first_name || '',
                    lastName: userData.lastName || userData.last_name || ''
                };
                
                console.log(`[Cache] Normalized user: ${normalizedUser.firstName} ${normalizedUser.lastName}`);
                return normalizedUser;
            }
            console.warn(`[Cache] ✗ PIN not found in cache`);
            return null;
        } catch (err) {
            console.error('[Cache] Offline PIN verification error:', err);
            return null;
        }
    });

    // --- Import Users from Supabase ---
    ipcMain.handle('import:users', async () => {
        if (!db) {
            console.error('[Import] Database not initialized');
            return { success: false, error: 'Database not initialized' };
        }

        try {
            console.log('[Import] Starting user import from Supabase...');

            // Initialize Supabase client
            const { createClient } = require('@supabase/supabase-js');
            const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

            console.log('[Import] Using service role key:', supabaseKey ? 'YES (length: ' + supabaseKey.length + ')' : 'NO');

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
            execute('DELETE FROM cached_pins');
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

                    execute(
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

    // Auto-sync: Periodically check for new users and sync them

    ipcMain.handle('autosync:start', async (_, intervalMinutes = 30) => {
        try {
            console.log(`[Auto-Sync] Starting auto-sync with ${intervalMinutes} minute interval`);

            // Clear existing interval if any
            if (autoSyncInterval) {
                clearInterval(autoSyncInterval);
            }

            // Perform initial sync
            await performUserSync();

            // Set up interval for periodic sync
            autoSyncInterval = setInterval(performUserSync, intervalMinutes * 60 * 1000);

            return { success: true, interval: intervalMinutes };
        } catch (error) {
            console.error('[Auto-Sync] Failed to start:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('autosync:stop', () => {
        if (autoSyncInterval) {
            clearInterval(autoSyncInterval);
            autoSyncInterval = null;
            console.log('[Auto-Sync] Stopped');
            return { success: true };
        }
        return { success: false, error: 'No active sync' };
    });

    ipcMain.handle('autosync:syncNow', async () => {
        console.log('[Auto-Sync] Manual sync triggered');
        return await performUserSync();
    });

    ipcMain.handle('autosync:syncMenuNow', async (_, branchId = null) => {
        console.log('[Menu Auto-Sync] Manual menu sync triggered');
        return await performMenuSync(branchId);
    });

    ipcMain.handle('autosync:syncOrdersNow', async (_, branchId = null, daysBack = 1) => {
        console.log('[Orders Auto-Sync] Manual orders sync triggered');
        return await performOrdersSync(branchId, daysBack);
    });


    // --- Menu/Category Cache ---
    ipcMain.handle('cache:menuItems', async (_, branchId, items) => {
        if (!db) return false;
        try {
            transaction(() => {
                for (const item of items) {
                    execute(
                        `INSERT OR REPLACE INTO menu_items (id, branch_id, name, category, price, data, cached_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [item.id, branchId, item.name, item.category || '', item.price || 0, JSON.stringify(item), new Date().toISOString()]
                    );
                }
            });
            return true;
        } catch (err) { 
            console.error('[Cache] Menu cache error:', err);
            return false; 
        }
    });

    ipcMain.handle('cache:getMenuItems', async (_, branchId) => {
        if (!db) return [];
        try {
            const rows = getAll(`SELECT data FROM menu_items WHERE branch_id = ?`, [branchId]);
            return rows.map(r => JSON.parse(r.data));
        } catch (err) { 
            console.error('[Cache] Get menu items error:', err);
            return []; 
        }
    });

    // --- Network Status ---
    ipcMain.handle('net:isOnline', () => isOnline);

    // --- Navigation (for reliable page transitions) ---
    ipcMain.handle('navigate', async (_, url) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            console.log(`[IPC] Navigation requested: ${url}`);
            try {
                await mainWindow.loadURL(url);
                console.log(`[IPC] Navigation successful: ${url}`);
                return true;
            } catch (error) {
                console.error(`[IPC] Navigation failed: ${url}`, error);
                return false;
            }
        }
        console.warn(`[IPC] Navigation failed: window not available`);
        return false;
    });

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
            webSecurity: false // Remote origin needs cross-origin requests to api.hirall.com
        }
    });

    // Register Escape key to toggle fullscreen
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'Escape' && mainWindow.isFullScreen()) {
            mainWindow.setFullScreen(false);
        }
    });

    // --- CORS & Security Fixes ---

    const setupSessionCORS = (ses) => {
        // Intercept ALL outgoing responses and inject permissive CORS headers.
        // This covers api.hirall.com, Supabase, PowerSync, storage, and any other
        // service the live site calls — so nothing gets blocked inside Electron.
        ses.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
            const responseHeaders = { ...(details.responseHeaders || {}) };

            // Always allow the actual requesting origin
            const origin = (details.requestHeaders?.['Origin'] || details.requestHeaders?.['origin'] || '');
            if (origin) {
                responseHeaders['Access-Control-Allow-Origin'] = [origin];
                responseHeaders['Access-Control-Allow-Credentials'] = ['true'];
            } else {
                responseHeaders['Access-Control-Allow-Origin'] = ['*'];
            }
            responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, PUT, PATCH, DELETE, OPTIONS'];
            responseHeaders['Access-Control-Allow-Headers'] = [
                'Content-Type, Authorization, X-Requested-With, Accept, Origin, ' +
                'x-branch-id, apikey, x-client-info, x-supabase-api-version, ' +
                'x-powersync-token, cache-control, pragma'
            ];
            responseHeaders['Access-Control-Max-Age'] = ['86400'];

            // Remove any restrictive CSP the server sends — it breaks the app inside Electron
            delete responseHeaders['content-security-policy'];
            delete responseHeaders['Content-Security-Policy'];
            delete responseHeaders['x-frame-options'];
            delete responseHeaders['X-Frame-Options'];

            callback({ responseHeaders });
        });
    };

    // Apply to both default session and our partition session
    setupSessionCORS(session.defaultSession);
    setupSessionCORS(mainWindow.webContents.session);

    mainWindow.webContents.session.webRequest.onCompleted(
        { urls: ['*://*/*'] },
        (details) => {
            // Only cache successful GET requests for pages, scripts, and styles
            if (details.method === 'GET' && details.statusCode === 200) {
                const ct = (details.responseHeaders?.['content-type'] || [''])[0];
                if (ct.includes('text/html') || ct.includes('javascript') || ct.includes('text/css') || ct.includes('application/json')) {
                    // Mark this URL as cacheable (the actual content is cached by Electron session)
                    if (db) {
                        try {
                            execute(`INSERT OR REPLACE INTO cache_meta (key, value, updated_at) VALUES (?, ?, ?)`, [`cached:${details.url}`, 'true', new Date().toISOString()]);
                        } catch (err) {
                            console.error('[Cache] Failed to update cache_meta:', err.message);
                        }
                    }
                }
            }
        }
    );

    // Load the terminal page
    const startUrl = DOMAIN_URL + TERMINAL_PATH;

    const loadApp = async () => {
        if (isOnline || await checkOnlineStatus()) {
            // Online: load the live site directly — always up to date, no rebuild needed
            const liveUrl = DOMAIN_URL + TERMINAL_PATH;
            console.log(`[App] Loading live URL: ${liveUrl}`);
            mainWindow.loadURL(liveUrl).catch(err => {
                console.warn(`[App] Live URL failed (${err.message}), falling back to local UI`);
                loadOfflinePage();
            });
        } else {
            // Offline: fall back to local static build
            console.log('[App] Offline — loading local UI');
            loadOfflinePage();
        }
    };

    // Handle load failures gracefully
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.warn(`[App] Failed to load URL: ${validatedURL} (${errorCode}: ${errorDescription})`);
        // Only fall back to offline page if the live domain itself fails to load
        if (validatedURL.startsWith(DOMAIN_URL) && errorCode !== -3) {
            loadOfflinePage();
        }
    });

    // Log all console messages from renderer for debugging
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        const levelStr = ['VERBOSE', 'INFO', 'WARNING', 'ERROR'][level] || 'LOG';
        console.log(`[Renderer ${levelStr}] ${message} (${sourceId}:${line})`);
    });

    // Start loading AFTER setting up all listeners
    loadApp();

    // ──────────────────────────────────────────
    // Intercept Links & Force In-App Rendering
    // ──────────────────────────────────────────
    
    // 1. Handle window.open() calls — load in same window, never spawn popups
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        console.log(`[LinkHandler] window.open: ${url}`);

        // Supabase/OAuth auth popups need to open — allow as new window
        if (url.includes('supabase.co/auth') || url.includes('accounts.google.com') || url.includes('github.com/login')) {
            return { action: 'allow' };
        }

        // Everything else: navigate in the main window
        setImmediate(() => mainWindow.loadURL(url));
        return { action: 'deny' };
    });

    // 2. Allow all navigation — the live site handles its own routing
    mainWindow.webContents.on('will-navigate', (event, url) => {
        console.log(`[LinkHandler] Navigation: ${url}`);
        // Let everything through — live site, Supabase auth redirects, etc.
        // Only block truly dangerous schemes
        if (url.startsWith('javascript:') || url.startsWith('vbscript:')) {
            event.preventDefault();
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
            const url = new URL(request.url);
            let pathname = url.pathname;
            const hostname = url.hostname;

            // 1. Skip interception for API calls (let them be handled by network)
            if (pathname.startsWith('/api/')) {
                return callback({ error: -3 }); // ERR_ABORTED - let it fall through
            }

            // 2. Resolve relative path
            let relativePath = pathname;
            if (hostname === 'terminal.html') {
                relativePath = pathname.startsWith('/') ? pathname.substring(1) : pathname;
            } else if (hostname && hostname !== 'localhost') {
                relativePath = hostname + pathname;
            }

            // Clean up path (remove leading slash, etc.)
            if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);
            if (!relativePath) relativePath = 'terminal.html';

            // Convert to filesystem path
            let finalPath = path.join(FRONTEND_OUT_PATH, relativePath.replace(/\//g, path.sep));

            // 3. Resolution logic:
            // Check for exact file, then .html, then index.html
            const tryResolve = (filePath) => {
                if (fs.existsSync(filePath) && !fs.lstatSync(filePath).isDirectory()) return filePath;
                if (!filePath.endsWith('.html') && fs.existsSync(filePath + '.html')) return filePath + '.html';
                const indexPath = path.join(filePath, 'index.html');
                if (fs.existsSync(indexPath)) return indexPath;
                return null;
            };

            let resolvedPath = tryResolve(finalPath);

            // 4. SPA Fallback logic:
            // Walk up the path segments trying to find a matching HTML file
            if (!resolvedPath) {
                const parts = relativePath.split('/').filter(Boolean);
                // Try progressively shorter paths until we find a match
                for (let i = parts.length - 1; i >= 1; i--) {
                    const candidate = parts.slice(0, i).join('/');
                    resolvedPath = tryResolve(path.join(FRONTEND_OUT_PATH, candidate));
                    if (resolvedPath) break;
                }
                // Final fallback: root index.html
                if (!resolvedPath) {
                    resolvedPath = tryResolve(path.join(FRONTEND_OUT_PATH, 'index.html'));
                }
            }

            if (resolvedPath) {
                console.log(`[Protocol] ✓ Resolved: ${request.url} -> ${resolvedPath}`);
                callback({ path: resolvedPath });
            } else {
                console.error(`[Protocol] ✗ Could not resolve: ${request.url}`);
                callback({ error: -6 }); // ERR_FILE_NOT_FOUND
            }
        } catch (err) {
            console.error(`[Protocol] Error:`, err);
            callback({ error: -2 }); // ERR_FAILED
        }
    });

    // Initialize Database
    db = initDatabase();
    console.log('[Main] Database initialized');

    // Run migrations for existing databases
    try {
        console.log('[Migration] Checking for schema updates...');
        
        // Check if waiter_id column exists
        const tableInfo = getAll(`PRAGMA table_info(restaurant_orders)`);
        const hasWaiterId = tableInfo.some(col => col.name === 'waiter_id');
        const hasWaiterName = tableInfo.some(col => col.name === 'waiter_name');
        
        if (!hasWaiterId) {
            console.log('[Migration] Adding waiter_id column to restaurant_orders...');
            execute(`ALTER TABLE restaurant_orders ADD COLUMN waiter_id TEXT`);
            console.log('[Migration] ✓ Added waiter_id column');
        }
        
        if (!hasWaiterName) {
            console.log('[Migration] Adding waiter_name column to restaurant_orders...');
            execute(`ALTER TABLE restaurant_orders ADD COLUMN waiter_name TEXT`);
            console.log('[Migration] ✓ Added waiter_name column');
        }
        
        if (hasWaiterId && hasWaiterName) {
            console.log('[Migration] ✓ Schema is up to date');
        }
    } catch (err) {
        console.error('[Migration] Error:', err.message);
    }

    // Set up IPC handlers
    setupIPC();

    // Auto-import users on startup if cache is empty
    setTimeout(async () => {
        try {
            if (!db) return;

            const count = get('SELECT COUNT(*) as count FROM cached_pins');
            if (count && (count?.count || 0) === 0) {
                console.log('[Auto-Import] No cached PINs found, importing users from Supabase...');

                const { createClient } = require('@supabase/supabase-js');
                const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
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
                                    // Store both snake_case and camelCase for compatibility
                                    first_name: user.first_name,
                                    last_name: user.last_name,
                                    firstName: user.first_name,
                                    lastName: user.last_name,
                                    role: user.role,
                                    branch_id: user.branch_id,
                                    status: user.status
                                });

                                execute(
                                    `INSERT OR REPLACE INTO cached_pins (id, user_id, user_data, branch_id, cached_at)
                                     VALUES (?, ?, ?, ?, ?)`,
                                    [user.pos_pin, user.id, userData, user.branch_id || null, new Date().toISOString()]
                                );
                            } catch (err) {
                                console.error(`[Auto-Import] Failed to cache ${user.pos_pin}:`, err.message);
                            }
                        }

                        const newCount = get('SELECT COUNT(*) as count FROM cached_pins');
                        console.log(`[Auto-Import] ✓ Imported ${newCount?.count || 0} users successfully`);
                    } else if (error) {
                        console.error('[Auto-Import] Supabase error:', error.message);
                    }
                }
            } else {
                console.log(`[Auto-Import] Found ${count?.count || 0} cached PINs, skipping import`);
            }
        } catch (err) {
            console.error('[Auto-Import] Error:', err.message);
        }
    }, 2000); // Wait 2 seconds after app starts

    // Auto-import menu items on startup if cache is empty
    setTimeout(async () => {
        try {
            if (!db) return;

            const categoryCount = get('SELECT COUNT(*) as count FROM restaurant_menu_categories');
            const itemCount = get('SELECT COUNT(*) as count FROM restaurant_menu_items');

            if ((categoryCount?.count || 0) === 0 || (itemCount?.count || 0) === 0) {
                console.log('[Menu Auto-Import] Cache empty, importing from Supabase...');
                const result = await performMenuSync();

                if (result.success) {
                    console.log(`[Menu Auto-Import] ✓ Imported ${result.categoriesCount} categories and ${result.itemsCount} items`);
                } else {
                    console.error('[Menu Auto-Import] Failed:', result.error);
                }
            } else {
                console.log(`[Menu Auto-Import] Found ${categoryCount?.count} categories and ${itemCount?.count} items, skipping import`);
            }
        } catch (err) {
            console.error('[Menu Auto-Import] Error:', err.message);
        }
    }, 2500); // Wait 2.5 seconds after app starts (after user import)

    // Start background auto-sync for user data (runs every 30 mins)
    setTimeout(async () => {
        try {
            console.log('[Main] Registering background users auto-sync...');
            // Start the interval (we can call the performUserSync helper directly)
            // Initial sync (in case new users were added since app last ran)
            await performUserSync();

            // Set up interval
            autoSyncInterval = setInterval(performUserSync, 30 * 60 * 1000);
        } catch (err) {
            console.error('[Main] Failed to start background auto-sync:', err);
        }
    }, 5000); // Start background sync 5 seconds after startup

    // Start background auto-sync for menu data (runs every 30 mins)
    setTimeout(async () => {
        try {
            console.log('[Main] Registering background menu auto-sync...');
            // Initial sync (in case new menu items were added since app last ran)
            await performMenuSync();

            // Set up interval for menu sync (every 30 minutes)
            setInterval(async () => {
                console.log('[Menu Background Sync] Running scheduled sync...');
                await performMenuSync();
            }, 30 * 60 * 1000);
        } catch (err) {
            console.error('[Main] Failed to start menu background auto-sync:', err);
        }
    }, 6000); // Start menu background sync 6 seconds after startup

    // Register background orders auto-sync
    setTimeout(async () => {
        try {
            console.log('[Main] Registering background orders auto-sync...');
            // Initial sync (fetch today's orders)
            await performOrdersSync(null, 1);

            // Set up interval for orders sync (every 5 minutes)
            setInterval(async () => {
                console.log('[Orders Background Sync] Running scheduled sync...');
                await performOrdersSync(null, 1); // Sync last 1 day of orders
            }, 5 * 60 * 1000);
        } catch (err) {
            console.error('[Main] Failed to start orders background auto-sync:', err);
        }
    }, 8000); // Start orders background sync 8 seconds after startup

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
