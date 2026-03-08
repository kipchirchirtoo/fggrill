/**
 * React Query Hooks for Search
 * Provides search hooks with debouncing for performance
 * Requirements: 8.2 (300ms debounce)
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { Hotel, Room, SearchFilters } from '@/types';
import { searchService } from '@/services/search.service';

/**
 * Query Keys for React Query
 */
export const searchKeys = {
  all: ['search'] as const,
  hotels: (query: string) => [...searchKeys.all, 'hotels', query] as const,
  rooms: (filters: SearchFilters) => [...searchKeys.all, 'rooms', filters] as const,
};

/**
 * Debounce hook
 * Requirements: 8.2 (300ms delay)
 */
export const useDebounce = <T,>(value: T, delay: number = 300): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook to search hotels with debouncing
 * Requirements: 8.1, 8.2
 */
export const useSearchHotels = (query: string): UseQueryResult<Hotel[], Error> => {
  const debouncedQuery = useDebounce(query, 300);

  return useQuery({
    queryKey: searchKeys.hotels(debouncedQuery),
    queryFn: () => searchService.searchHotels(debouncedQuery),
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to filter rooms with debouncing
 * Requirements: 8.4
 */
export const useFilterRooms = (filters: SearchFilters): UseQueryResult<Room[], Error> => {
  const debouncedFilters = useDebounce(filters, 300);

  return useQuery({
    queryKey: searchKeys.rooms(debouncedFilters),
    queryFn: () => searchService.filterRooms(debouncedFilters),
    enabled: Object.keys(debouncedFilters).length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook for client-side hotel filtering with debouncing
 * Provides instant filtering without API calls
 * Requirements: 8.1, 8.2
 */
export const useLocalHotelSearch = (hotels: Hotel[], query: string) => {
  const debouncedQuery = useDebounce(query, 300);

  const filteredHotels = useMemo(() => {
    return searchService.filterHotelsLocally(hotels, debouncedQuery);
  }, [hotels, debouncedQuery]);

  return {
    filteredHotels,
    isSearching: query !== debouncedQuery,
    count: filteredHotels.length,
  };
};

/**
 * Hook for client-side room filtering with debouncing
 * Provides instant filtering without API calls
 * Requirements: 8.4
 */
export const useLocalRoomFilter = (rooms: Room[], filters: SearchFilters) => {
  const debouncedFilters = useDebounce(filters, 300);

  const filteredRooms = useMemo(() => {
    return searchService.filterRoomsLocally(rooms, debouncedFilters);
  }, [rooms, debouncedFilters]);

  const sortedRooms = useMemo(() => {
    return searchService.sortRoomsByPrice(filteredRooms, true);
  }, [filteredRooms]);

  return {
    filteredRooms: sortedRooms,
    isFiltering: JSON.stringify(filters) !== JSON.stringify(debouncedFilters),
    count: sortedRooms.length,
  };
};

/**
 * Hook for sorting hotels alphabetically
 * Requirements: 1.5
 */
export const useSortedHotels = (hotels: Hotel[]) => {
  return useMemo(() => {
    return searchService.sortHotelsByName(hotels);
  }, [hotels]);
};
