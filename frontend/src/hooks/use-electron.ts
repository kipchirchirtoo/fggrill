/**
 * useElectron — React hook for Electron POS offline capabilities
 * 
 * Detects if running inside Electron and provides access to:
 * - Offline status
 * - SQLite database operations
 * - PIN caching for offline auth
 * - Menu item caching
 * - Sync queue for offline orders
 * 
 * When not in Electron (regular browser), all methods are no-ops / return defaults.
 */

import { useState, useEffect, useCallback } from 'react';

interface SyncStatus {
    pending: number;
    synced: number;
    failed: number;
}

interface ElectronAPI {
    isElectron: boolean;
    isOnline: () => Promise<boolean>;
    onOnlineStatus: (callback: (status: boolean) => void) => void;
    db: {
        get: (table: string, query?: Record<string, any>) => Promise<any[]>;
        upsert: (table: string, data: Record<string, any>) => Promise<boolean>;
        delete: (table: string, query: Record<string, any>) => Promise<boolean>;
    };
    cache: {
        cachePin: (pin: string, userId: string, userData: any, branchId: number) => Promise<boolean>;
        verifyPin: (pin: string) => Promise<any | null>;
        cacheMenuItems: (branchId: number, items: any[]) => Promise<boolean>;
        getMenuItems: (branchId: number) => Promise<any[]>;
    };
    sync: {
        /** Add an action to the sync queue (will sync when online) */
        queue: (action: string, endpoint: string, method: string, body: any, branchId: number, token: string) => Promise<boolean>;
        status: () => Promise<SyncStatus>;
        trigger: () => Promise<boolean>;
    };
    checkForUpdates: () => void;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

export function useElectron() {
    const [isElectron, setIsElectron] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>({ pending: 0, synced: 0, failed: 0 });

    useEffect(() => {
        // Check for Electron OR C# WebView2 (which also injects electronAPI)
        const checkApi = () => {
            if (window.electronAPI) {
                setIsElectron(true);

                // Get initial online status
                window.electronAPI.isOnline().then(setIsOnline);

                // Listen for status changes
                window.electronAPI.onOnlineStatus((status) => {
                    setIsOnline(status);
                });

                // Poll sync status every 30s
                const interval = setInterval(() => {
                    window.electronAPI?.sync.status().then(setSyncStatus);
                }, 30000);

                // Initial sync status
                window.electronAPI.sync.status().then(setSyncStatus);

                return () => clearInterval(interval);
            }
        };

        // Retry a few times in case C# injection is slightly delayed
        const timer = setInterval(() => {
            if (window.electronAPI) {
                clearInterval(timer);
                checkApi();
            }
        }, 100);

        // Stop checking after 5 seconds
        setTimeout(() => clearInterval(timer), 5000);

        return () => clearInterval(timer);
    }, []);

    // --- PIN Auth ---
    const cachePin = useCallback(async (pin: string, userId: string, userData: any, branchId: number) => {
        if (!window.electronAPI) return false;
        return window.electronAPI.cache.cachePin(pin, userId, userData, branchId);
    }, []);

    const verifyPinOffline = useCallback(async (pin: string) => {
        if (!window.electronAPI) return null;
        return window.electronAPI.cache.verifyPin(pin);
    }, []);

    // --- Menu Cache ---
    const cacheMenuItems = useCallback(async (branchId: number, items: any[]) => {
        if (!window.electronAPI) return false;
        return window.electronAPI.cache.cacheMenuItems(branchId, items);
    }, []);

    const getCachedMenuItems = useCallback(async (branchId: number) => {
        if (!window.electronAPI) return [];
        return window.electronAPI.cache.getMenuItems(branchId);
    }, []);

    // --- Sync Queue ---
    const queueForSync = useCallback(async (
        action: string,
        endpoint: string,
        method: string = 'POST',
        body: any = null,
        branchId: number = 0,
        token: string = ''
    ) => {
        if (!window.electronAPI) return false;
        return window.electronAPI.sync.queue(action, endpoint, method, body, branchId, token);
    }, []);

    const triggerSync = useCallback(async () => {
        if (!window.electronAPI) return false;
        return window.electronAPI.sync.trigger();
    }, []);

    return {
        isElectron,
        isOnline,
        syncStatus,
        // PIN auth
        cachePin,
        verifyPinOffline,
        // Menu cache
        cacheMenuItems,
        getCachedMenuItems,
        // Sync
        queueForSync,
        triggerSync,
    };
}

/**
 * Quick check if running in Electron (no hook needed)
 */
export function isRunningInElectron(): boolean {
    return typeof window !== 'undefined' && window.electronAPI?.isElectron === true;
}
