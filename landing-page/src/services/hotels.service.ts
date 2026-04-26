import { apiClient } from './api-client';

/**
 * API Endpoints
 */
const ENDPOINTS = {
  BRANCHES: '/system/branches',
  ROOMS: '/rooms',
  ROOM_TYPES: '/rooms/types',
  ROOM_BY_ID: (id: string) => `/rooms/${id}`,
};

/**
 * Static fallback branches — shown instantly if API is slow or unreachable.
 * These are the real branches; live data from the API will replace them.
 */
export const FALLBACK_BRANCHES: any[] = [
  {
    id: 1,
    name: 'Famous Gates Hotel — Kyogong',
    location: 'Bomet, Kenya',
    address: 'Kyogong, Bomet County, Kenya',
    status: 'active',
    phone: '0706782828',
    email: 'famousgatesbmt@gmail.com',
  },
  {
    id: 2,
    name: 'Famous Gates Hotel — Litein',
    location: 'Kericho, Kenya',
    address: 'Litein, Kericho County, Kenya',
    status: 'active',
    phone: '0706782828',
    email: 'famousgatesbmt@gmail.com',
  },
  {
    id: 3,
    name: 'Famous Gates Hotel — Mogogoshiek',
    location: 'Bomet, Kenya',
    address: 'Mogogoshiek, Bomet County, Kenya',
    status: 'active',
    phone: '0706782828',
    email: 'famousgatesbmt@gmail.com',
  },
  {
    id: 4,
    name: 'Famous Gates Hotel — Sotik',
    location: 'Bomet, Kenya',
    address: 'Sotik, Bomet County, Kenya',
    status: 'active',
    phone: '0706782828',
    email: 'famousgatesbmt@gmail.com',
  },
];

/**
 * Fetch all branches with a fast timeout and static fallback.
 * Returns live data from the Node.js backend; falls back to FALLBACK_BRANCHES on error/timeout.
 */
export const fetchBranches = async (): Promise<any[]> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000); // 4s hard timeout
  try {
    // Use fetch directly to bypass the api-client retry logic and respect the abort signal
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    const res = await fetch(`${baseUrl}/system/branches`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return FALLBACK_BRANCHES;
    const json = await res.json();
    // Handle both { data: [...] } and [...] response shapes
    const data = Array.isArray(json) ? json : (json?.data ?? []);
    if (!Array.isArray(data) || data.length === 0) return FALLBACK_BRANCHES;
    return data;
  } catch {
    clearTimeout(timer);
    return FALLBACK_BRANCHES;
  }
};

/**
 * Fetch a single branch by ID (if needed, but using list for now)
 */
export const fetchRooms = async (branchId?: string): Promise<any[]> => {
  const params = branchId ? { params: { branchId } } : {};
  return apiClient.get<any[]>(ENDPOINTS.ROOMS, params);
};

/**
 * Fetch room types
 */
export const fetchRoomTypes = async (): Promise<any[]> => {
  return apiClient.get<any[]>(ENDPOINTS.ROOM_TYPES);
};

/**
 * Hotels Service Object (for easier imports)
 */
export const hotelsService = {
  fetchBranches,
  fetchRooms,
  fetchRoomTypes,
};
