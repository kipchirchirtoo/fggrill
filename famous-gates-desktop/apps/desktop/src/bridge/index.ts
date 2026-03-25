// Frontend-to-Rust bridge — wraps all Tauri invoke() calls
// The rest of the app never calls invoke() directly

import { invoke } from '@tauri-apps/api/core';

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authBridge = {
  login: (email: string, password: string) =>
    invoke<AuthResponse>('cmd_login', { email, password }),

  posLogin: (pin: string, branchId?: number) =>
    invoke<AuthResponse>('cmd_pos_login', { pin, branchId }),

  logout: () => invoke<void>('cmd_logout'),

  getSession: () => invoke<SessionState | null>('cmd_get_session'),

  refreshToken: () => invoke<boolean>('cmd_refresh_token'),
};

// ── Network ───────────────────────────────────────────────────────────────────
export const networkBridge = {
  getStatus: () => invoke<NetworkStatus>('cmd_get_network_status'),
  ping: () => invoke<boolean>('cmd_ping_api'),
};

// ── Sync ──────────────────────────────────────────────────────────────────────
export const syncBridge = {
  forceSync: () => invoke<SyncResult>('cmd_force_sync'),
  getOutboxCount: () => invoke<number>('cmd_get_outbox_count'),
  clearOutbox: () => invoke<void>('cmd_clear_outbox'),
};

// ── Data ──────────────────────────────────────────────────────────────────────
export const dataBridge = {
  queryLocal: (entity: string, key?: string) =>
    invoke<unknown | null>('cmd_query_local', { entity, key }),

  getCached: (cacheKey: string) =>
    invoke<string | null>('cmd_get_cached', { cacheKey }),

  mutate: (params: MutateParams) =>
    invoke<MutateResult>('cmd_mutate', params),
};

// ── Security ──────────────────────────────────────────────────────────────────
export const securityBridge = {
  storeToken: (key: string, value: string) =>
    invoke<void>('cmd_store_token', { key, value }),

  getToken: (key: string) =>
    invoke<string | null>('cmd_get_token', { key }),

  deleteToken: (key: string) =>
    invoke<void>('cmd_delete_token', { key }),
};

// ── App ───────────────────────────────────────────────────────────────────────
export const appBridge = {
  getInfo: () => invoke<AppInfo>('cmd_get_app_info'),
  openPosWindow: () => invoke<void>('cmd_open_pos_window'),
  getBranchConfig: () => invoke<BranchConfig>('cmd_get_branch_config'),
};

// ── Unified export ────────────────────────────────────────────────────────────
export const bridge = {
  auth: authBridge,
  network: networkBridge,
  sync: syncBridge,
  data: dataBridge,
  security: securityBridge,
  app: appBridge,
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AuthResponse {
  success: boolean;
  data?: AuthData;
  message?: string;
}

export interface AuthData {
  user: UserProfile;
  session: SessionData;
}

export interface SessionData {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  branch_id?: number;
  branch_name?: string;
  is_central?: boolean;
  status?: string;
}

export interface SessionState {
  user_id: string;
  email: string;
  role: string;
  branch_id: number | null;
  branch_name: string | null;
  token: string;
  expires_at: number;
}

export interface NetworkStatus {
  is_online: boolean;
  node_api: boolean;
  python_api: boolean;
  checked_at: number;
}

export interface SyncResult {
  synced: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export interface MutateParams {
  [key: string]: unknown;
  entity: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: unknown;
}

export interface MutateResult {
  success: boolean;
  offline?: boolean;
  queued_id?: string;
  message?: string;
  data?: unknown;
}

export interface AppInfo {
  name: string;
  version: string;
  tauri_version: string;
}

export interface BranchConfig {
  branch_id: number;
  branch_name: string;
  is_central: boolean;
  node_api_url: string;
  python_api_url: string;
}
