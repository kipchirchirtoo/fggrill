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
 * Helper to standardize branch names as 'FamousGate Hotel (Branch)'.
 * Cleans any existing prefixes like 'Famous Gates Hotel — ', 'FamousGate ', etc.
 */
export function formatBranchDisplayName(name: string): string {
  if (!name) return 'FamousGate Hotel';
  
  let cleanName = name.trim();
  cleanName = cleanName
    .replace(/^FamousGate\s+Famous\s+Gates\s+Hotel\s*[—–-]?\s*/i, '')
    .replace(/^Famous\s+Gates\s+Hotel\s*[—–-]?\s*/i, '')
    .replace(/^Famous\s+Gate\s+Hotel\s*[—–-]?\s*/i, '')
    .replace(/^FamousGate\s+Hotel\s*[—–-]?\s*/i, '')
    .replace(/^FamousGate\s+[—–-]?\s*/i, '')
    .trim();

  if (!cleanName) return 'FamousGate Hotel';

  cleanName = cleanName
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return `FamousGate Hotel (${cleanName})`;
}

/**
 * Static fallback branches — shown instantly if API is slow or unreachable.
 * Contains all 10 database branches.
 */
export const FALLBACK_BRANCHES: any[] = [
  {
    id: '1',
    name: 'Kyogong',
    location: 'Bomet, Kenya',
    address: 'Kyogong, Bomet County, Kenya',
    status: 'active',
    phone: '0706782828',
    email: 'famousgatesbmt@gmail.com',
  },
  {
    id: '2',
    name: 'Bomet Town',
    location: 'Bomet, Kenya',
    address: 'Bomet Town, Bomet County, Kenya',
    status: 'active',
    phone: '0706782828',
    email: 'famousgatesbmt@gmail.com',
  },
  {
    id: '3',
    name: 'Kaplong',
    location: 'Bomet, Kenya',
    address: 'Kaplong, Bomet County, Kenya',
    status: 'active',
    phone: '0706782828',
    email: 'famousgatesbmt@gmail.com',
  },
  {
    id: '4',
    name: 'Sotik',
    location: 'Bomet, Kenya',
    address: 'Sotik, Bomet County, Kenya',
    status: 'active',
    phone: '0706782828',
    email: 'famousgatesbmt@gmail.com',
  },
  {
    id: '5',
    name: 'Mogogoshiek',
    location: 'Bomet, Kenya',
    address: 'Mogogoshiek, Bomet County, Kenya',
    status: 'active',
    phone: '0706782828',
    email: 'famousgatesbmt@gmail.com',
  },
  {
    id: '6',
    name: 'Kaptote',
    location: 'Kericho, Kenya',
    address: 'Kaptote, Kericho County, Kenya',
    status: 'active',
    phone: '0706782828',
    email: 'famousgatesbmt@gmail.com',
  },
  {
    id: '7',
    name: 'Litein',
    location: 'Kericho, Kenya',
    address: 'Litein, Kericho County, Kenya',
    status: 'active',
    phone: '0706782828',
    email: 'famousgatesbmt@gmail.com',
  },
  {
    id: '8',
    name: 'Kapsoit',
    location: 'Kericho, Kenya',
    address: 'Kapsoit, Kericho County, Kenya',
    status: 'active',
    phone: '0706782828',
    email: 'famousgatesbmt@gmail.com',
  },
  {
    id: '9',
    name: 'Grill',
    location: 'Kericho, Kenya',
    address: 'Grill, Kericho County, Kenya',
    status: 'active',
    phone: '0706782828',
    email: 'famousgatesbmt@gmail.com',
  },
  {
    id: '10',
    name: 'Guesthouse',
    location: 'Kericho, Kenya',
    address: 'Guesthouse, Kericho County, Kenya',
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
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    const res = await fetch(`${baseUrl}/system/branches`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return FALLBACK_BRANCHES;
    const json = await res.json();
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
  formatBranchDisplayName,
};

