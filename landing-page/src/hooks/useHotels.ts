/**
 * React Query Hooks for Hotels
 * Provides data fetching hooks with automatic caching and synchronization
 * Requirements: 7.4 (5 minute cache)
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { hotelsService } from '@/services/hotels.service';
import { config } from '@/config/environment';

/**
 * Query Keys for React Query
 */
export const hotelKeys = {
  all: ['hotels'] as const,
  branches: () => [...hotelKeys.all, 'branches'] as const,
  rooms: (branchId?: string) => [...hotelKeys.all, 'rooms', branchId] as const,
  roomTypes: () => [...hotelKeys.all, 'room-types'] as const,
};

/**
 * Hook to fetch all branches
 * Caches data for 5 minutes as per requirement 7.4
 */
export const useBranches = (): UseQueryResult<any[], Error> => {
  return useQuery({
    queryKey: hotelKeys.branches(),
    queryFn: hotelsService.fetchBranches,
    staleTime: config.cache.staleTime, // 5 minutes
    gcTime: config.cache.cacheTime, // 10 minutes (2x staleTime)
    retry: 2,
  });
};

/**
 * Hook to fetch rooms optionally by branch
 */
export const useRooms = (branchId?: string): UseQueryResult<any[], Error> => {
  return useQuery({
    queryKey: hotelKeys.rooms(branchId),
    queryFn: () => hotelsService.fetchRooms(branchId),
    staleTime: config.cache.staleTime, // 5 minutes
    gcTime: config.cache.cacheTime, // 10 minutes
    retry: 2,
  });
};

/**
 * Hook to fetch room types
 */
export const useRoomTypes = (): UseQueryResult<any[], Error> => {
  return useQuery({
    queryKey: hotelKeys.roomTypes(),
    queryFn: hotelsService.fetchRoomTypes,
    staleTime: config.cache.staleTime, // 5 minutes
    gcTime: config.cache.cacheTime, // 10 minutes
    retry: 2,
  });
};
