// Python API client — analytics, PDF, reports, forecasting

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

const PYTHON_BASE = import.meta.env.VITE_PYTHON_API_URL ?? 'https://services.hirall.com';

function getStoredToken(): string | null {
  return localStorage.getItem('fg_token');
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, any>
): Promise<T> {
  let url = `${PYTHON_BASE}/api${path}`;

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
    const err = await response.json().catch(() => ({ message: 'Python service error' }));
    throw new Error((err as any).message ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const pythonClient = {
  get: <T>(path: string, params?: Record<string, any>) => request<T>('GET', path, undefined, params),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
};
