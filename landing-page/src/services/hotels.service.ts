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
 * Fetch all branches
 */
export const fetchBranches = async (): Promise<any[]> => {
  return apiClient.get<any[]>(ENDPOINTS.BRANCHES);
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
