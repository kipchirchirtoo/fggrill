// Node API client — all calls to the Express backend go through here
// Uses Tauri HTTP plugin (scoped to api.hirall.com)

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

const NODE_BASE = import.meta.env.VITE_NODE_API_URL ?? 'https://api.hirall.com';

function getStoredToken(): string | null {
  return localStorage.getItem('fg_token');
}

function getStoredBranchId(): string | null {
  return localStorage.getItem('fg_branch_id');
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  };
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const branchId = getStoredBranchId();
  if (branchId) headers['x-branch-id'] = branchId;
  return headers;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, any>
): Promise<T> {
  let url = `${NODE_BASE}/api${path}`;
  
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const response = await tauriFetch(url, {
    method,
    headers: buildHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error((err as any).message ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const nodeClient = {
  get: <T>(path: string, params?: Record<string, any>) => request<T>('GET', path, undefined, params),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
