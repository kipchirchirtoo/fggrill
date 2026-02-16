const { contextBridge, ipcRenderer } = require('electron');

// ──────────────────────────────────────────
// Expose safe APIs to the renderer (Next.js)
// via window.electronAPI
// ──────────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {

    // --- Network Status ---
    isOnline: () => ipcRenderer.invoke('net:isOnline'),
    onOnlineStatus: (callback) => {
        ipcRenderer.on('online-status', (_, status) => callback(status));
    },

    // --- Database (generic CRUD) ---
    db: {
        get: (table, query) => ipcRenderer.invoke('db:get', table, query),
        upsert: (table, data) => ipcRenderer.invoke('db:upsert', table, data),
        delete: (table, query) => ipcRenderer.invoke('db:delete', table, query),
    },

    // --- PIN Cache (offline auth) ---
    cache: {
        /** Cache a PIN + user data for offline login */
        cachePin: (pin, userId, userData, branchId) =>
            ipcRenderer.invoke('cache:pin', pin, userId, userData, branchId),

        /** Verify a PIN against local cache (offline auth) */
        verifyPin: (pin) =>
            ipcRenderer.invoke('cache:verifyPin', pin),

        /** Cache menu items for a branch */
        cacheMenuItems: (branchId, items) =>
            ipcRenderer.invoke('cache:menuItems', branchId, items),

        /** Get cached menu items for a branch */
        getMenuItems: (branchId) =>
            ipcRenderer.invoke('cache:getMenuItems', branchId),

        /** Import all users from Supabase to PowerSync */
        importUsers: () =>
            ipcRenderer.invoke('import:users'),
    },

    // --- Sync Queue ---
    sync: {
        /** Add an action to the sync queue (will sync when online) */
        queue: (action, endpoint, method, body, branchId, token) =>
            ipcRenderer.invoke('sync:queue', action, endpoint, method, body, branchId, token),


        /** Get sync queue status (pending/synced/failed counts) */
        status: () => ipcRenderer.invoke('sync:status'),

        /** Manually trigger sync */
        trigger: () => ipcRenderer.invoke('sync:trigger'),
    },

    // --- App ---
    checkForUpdates: () => ipcRenderer.send('check-for-updates'),
    isElectron: true,
});

console.log('[Preload] electronAPI exposed to renderer');
