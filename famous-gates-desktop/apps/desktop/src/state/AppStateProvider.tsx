'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { bridge } from '../bridge';

export interface SessionState {
  user_id: string;
  email: string;
  role: string;
  branch_id: number | null;
  branch_name: string | null;
  token: string;
  expires_at: number;
}

export interface NetworkState {
  is_online: boolean;
  node_api: boolean;
  python_api: boolean;
}

export interface SyncState {
  outbox_count: number;
  is_syncing: boolean;
  last_sync_at: number | null;
  last_error: string | null;
}

interface AppStateContextType {
  session: SessionState | null;
  network: NetworkState;
  sync: SyncState;
  isLoading: boolean;
  setSession: (s: SessionState | null) => void;
  refreshNetwork: () => Promise<void>;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [network, setNetwork] = useState<NetworkState>({
    is_online: false,
    node_api: false,
    python_api: false,
  });
  const [sync, setSync] = useState<SyncState>({
    outbox_count: 0,
    is_syncing: false,
    last_sync_at: null,
    last_error: null,
  });

  // Restore session from Rust on mount
  useEffect(() => {
    bridge.auth.getSession()
      .then((s) => setSession(s))
      .catch(() => setSession(null))
      .finally(() => setIsLoading(false));
  }, []);

  // Listen to Rust events
  useEffect(() => {
    const unlisten: Array<() => void> = [];

    listen<any>('sync:complete', (e) => {
      setSync((prev) => ({
        ...prev,
        is_syncing: false,
        last_sync_at: Date.now(),
        outbox_count: Math.max(0, prev.outbox_count - (e.payload?.synced ?? 0)),
        last_error: null,
      }));
    }).then((fn) => unlisten.push(fn));

    listen<string>('sync:error', (e) => {
      setSync((prev) => ({ ...prev, is_syncing: false, last_error: e.payload }));
    }).then((fn) => unlisten.push(fn));

    listen<any>('network:change', (e) => {
      setNetwork(e.payload);
    }).then((fn) => unlisten.push(fn));

    listen<void>('auth:session-expired', () => {
      setSession(null);
    }).then((fn) => unlisten.push(fn));

    return () => unlisten.forEach((fn) => fn());
  }, []);

  const refreshNetwork = useCallback(async () => {
    const status = await bridge.network.getStatus();
    setNetwork({
      is_online: status.is_online,
      node_api: status.node_api,
      python_api: status.python_api,
    });
  }, []);

  return (
    <AppStateContext.Provider
      value={{ session, network, sync, isLoading, setSession, refreshNetwork }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
