/**
 * core.ts — Unified fetch engine for FamousGateHotels
 * Single source of truth for all HTTP calls.
 */

import { API_URL, PYTHON_API_URL, REPORTS_SERVICE_URL, PYTHON_SERVICE_URL } from '../config';

// ─── Backend URL Constants ────────────────────────────────────────────────────
export { API_URL, PYTHON_API_URL, REPORTS_SERVICE_URL, PYTHON_SERVICE_URL };

// ─── Auth Headers ────────────────────────────────────────────────────────────

export const getHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// ─── Retry Config ────────────────────────────────────────────────────────────

const MAX_RETRIES = 2;
const backoff = (n: number) => Math.min(1000 * 2 ** n, 5000);

// ─── Query Builder ───────────────────────────────────────────────────────────

type QueryValue = string | number | boolean | undefined | null | string[];

/**
 * buildQuery({ branch_id: 1, status: 'active' }) → '?branch_id=1&status=active'
 * Skips undefined/null/empty values automatically.
 */
export function buildQuery(params?: Record<string, QueryValue>): string {
  if (!params) return '';
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      if (Array.isArray(v)) {
        v.forEach(val => q.append(k, String(val)));
      } else {
        q.append(k, String(v));
      }
    }
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ─── Fetch Options ───────────────────────────────────────────────────────────

import { ApiResponse } from './types';

// ─── Fetch Options ───────────────────────────────────────────────────────────

export interface FetchOptions extends RequestInit {
  showToast?: boolean;
  responseType?: 'json' | 'blob';
}

// ─── Core Fetch ──────────────────────────────────────────────────────────────

/**
 * Universal fetch wrapper for BOTH backends.
 * Enforces ApiResponse<T> shape and handles centralized Auth/Branch headers.
 */
export async function fetchAPI<T>(
  endpoint: string,
  options?: FetchOptions,
  baseUrl: string = API_URL,
): Promise<ApiResponse<T>> {
  const isPython = baseUrl === PYTHON_API_URL;
  const showToast = options?.showToast ?? false;

  // ── Offline guard ──────────────────────────────────────────────────────────
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token === 'offline-bridge-token') {
      const isAuth = endpoint.includes('/auth/login') || endpoint.includes('/auth/pos-login');
      if (isPython) return { success: false, data: null as any, message: 'Offline mode – Python API unavailable' };
      if (!isAuth) return { success: true, data: null as any, message: 'Offline mode – no API call made' };
    }
  }

  let retries = 0;
  let lastError: Error | null = null;

  while (retries <= MAX_RETRIES) {
    try {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, backoff(retries - 1)));
      }

      // ── Header Injection (BRANCH + AUTH) ──────────────────────────────────
      const branchHeaders: Record<string, string> = {};
      if (typeof window !== 'undefined') {
        const bid = localStorage.getItem('activeBranchId');
        if (bid) branchHeaders['x-branch-id'] = bid;
      }

      const mergedHeaders: Record<string, string> = {
        ...getHeaders(),
        ...branchHeaders,
        ...((options?.headers as Record<string, string>) || {}),
      };

      // ── Electron C# proxy (Node API only) ─────────────────────────────────
      if (!isPython && typeof window !== 'undefined' && (window as any).electronAPI?.invoke) {
        try {
          const result = await (window as any).electronAPI.invoke('http:proxy', {
            url: `${baseUrl}/api${endpoint}`,
            method: options?.method ?? 'GET',
            headers: mergedHeaders,
            body: options?.body,
          });
          return result as ApiResponse<T>;
        } catch {
          // Fall through to direct fetch
        }
      }

      // ── Direct fetch ───────────────────────────────────────────────────────
      const response = await fetch(`${baseUrl}/api${endpoint}`, {
        ...options,
        cache: isPython ? undefined : 'no-store',
        headers: {
          ...mergedHeaders,
          ...(isPython ? {} : { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }),
        },
      });

      // ── Token Expiry Redirect ─────────────────────────────────────────────
      // Skip for /auth/me — that endpoint is handled gracefully by checkAuth()
      // in auth-context.tsx which uses the cached user on failure.
      const isSessionCheck = endpoint === '/auth/me' || endpoint === '/auth/session';
      if (response.status === 401 && !isPython && typeof window !== 'undefined' && !isSessionCheck) {
        const isLoginPage = window.location.pathname === '/login' || window.location.pathname === '/';
        if (!isLoginPage) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (window.location.pathname.includes('/dashboard') || window.location.pathname.includes('/admin')) {
            window.location.href = '/login?expired=true';
          }
        }
      }

      // ── 403 Forbidden — Graceful Access Denied ─────────────────────────────
      if (response.status === 403 && typeof window !== 'undefined') {
        console.warn(`[RBAC] 403 Forbidden: ${endpoint} — current user lacks permission`);
        import('sonner').then(({ toast }) => toast.error('Access denied — you don\'t have permission for this action'));
        return {
          success: false,
          data: null as any,
          message: 'Access denied',
        };
      }

      // Handle Response Type
      if (options?.responseType === 'blob') {
        const blob = await response.blob();
        return { success: true, data: blob as any } as ApiResponse<T>;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || result.detail || `HTTP ${response.status}`);
      }

      // Normalize response shape if necessary
      return {
        success: result.success ?? true,
        data: result.data ?? result,
        message: result.message,
        count: result.count
      } as ApiResponse<T>;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      const msg = lastError.message;

      // Retry logic
      const isRetryable = msg.includes('fetch') || msg.includes('NetworkError') || msg.includes('500');
      if (!isRetryable || msg.includes('Unauthorized')) break;
      retries++;
    }
  }

  // ── Centralized Toast Error ────────────────────────────────────────────────
  if (showToast && lastError && typeof window !== 'undefined') {
    import('sonner').then(({ toast }) => toast.error(lastError!.message));
  }

  return {
    success: false,
    message: lastError?.message ?? 'Request failed',
    data: null as any,
  };
}

export const fetchPythonAPI = <T>(endpoint: string, options?: FetchOptions) =>
  fetchAPI<T>(endpoint, options, PYTHON_API_URL);

// ─── Shared Download Helper ──────────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// ─── ApiClient Wrapper ────────────────────────────────────────────────────────

/**
 * Structured API client for cleaner calling syntax.
 * Example: apiClient.get<User[]>('/users')
 */
export const apiClient = {
  get: <T>(endpoint: string, options?: FetchOptions) => 
    fetchAPI<T>(endpoint, { ...options, method: 'GET' }),
  
  post: <T>(endpoint: string, body?: any, options?: FetchOptions) => 
    fetchAPI<T>(endpoint, { ...options, method: 'POST', body: (body instanceof FormData) ? body : JSON.stringify(body) }),
  
  put: <T>(endpoint: string, body?: any, options?: FetchOptions) => 
    fetchAPI<T>(endpoint, { ...options, method: 'PUT', body: (body instanceof FormData) ? body : JSON.stringify(body) }),
  
  patch: <T>(endpoint: string, body?: any, options?: FetchOptions) => 
    fetchAPI<T>(endpoint, { ...options, method: 'PATCH', body: (body instanceof FormData) ? body : JSON.stringify(body) }),
  
  delete: <T>(endpoint: string, options?: FetchOptions) => 
    fetchAPI<T>(endpoint, { ...options, method: 'DELETE' }),
};
