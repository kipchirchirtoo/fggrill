/**
 * Search Service
 * Handles search and filtering functionality for hotels and rooms
 * Requirements: 8.1, 8.2, 8.4
 */

import { apiClient } from './api-client';
import { Hotel, Room, SearchFilters } from '@/types';

/**
 * API Endpoints
 */
const ENDPOINTS = {
  SEARCH_HOTELS: '/public/search/hotels',
  SEARCH_ROOMS: '/public/search/rooms',
};

/**
 * Search hotels by query string
 * Requirements: 8.1
 * 
 * @param query - Search query (hotel name or location)
 */
export const searchHotels = async (query: string): Promise<Hotel[]> => {
  if (!query || query.trim() === '') {
    return [];
  }

  return apiClient.get<Hotel[]>(ENDPOINTS.SEARCH_HOTELS, {
    params: { q: query.trim() },
  });
};

/**
 * Filter rooms based on criteria
 * Requirements: 8.4
 * 
 * @param filters - Search filters object
 */
export const filterRooms = async (filters: SearchFilters): Promise<Room[]> => {
  const params: Record<string, string | number> = {};

  if (filters.query) {
    params.q = filters.query;
  }

  if (filters.location) {
    params.location = filters.location;
  }

  if (filters.priceMin !== undefined) {
    params.priceMin = filters.priceMin;
  }

  if (filters.priceMax !== undefined) {
    params.priceMax = filters.priceMax;
  }

  if (filters.capacity !== undefined) {
    params.capacity = filters.capacity;
  }

  if (filters.amenities && filters.amenities.length > 0) {
    params.amenities = filters.amenities.join(',');
  }

  if (filters.checkInDate) {
    params.checkInDate = filters.checkInDate;
  }

  if (filters.checkOutDate) {
    params.checkOutDate = filters.checkOutDate;
  }

  return apiClient.get<Room[]>(ENDPOINTS.SEARCH_ROOMS, { params });
};

/**
 * Client-side filtering for hotels
 * Used for instant filtering without API calls
 * Requirements: 8.1, 8.2
 */
export const filterHotelsLocally = (hotels: Hotel[], query: string): Hotel[] => {
  if (!query || query.trim() === '') {
    return hotels;
  }

  const searchTerm = query.toLowerCase().trim();

  return hotels.filter((hotel) => {
    const nameMatch = hotel.name.toLowerCase().includes(searchTerm);
    const locationMatch = hotel.location.toLowerCase().includes(searchTerm);
    const descriptionMatch = hotel.description?.toLowerCase().includes(searchTerm);

    return nameMatch || locationMatch || descriptionMatch;
  });
};

/**
 * Client-side filtering for rooms
 * Used for instant filtering without API calls
 * Requirements: 8.4
 */
export const filterRoomsLocally = (rooms: Room[], filters: SearchFilters): Room[] => {
  let filtered = [...rooms];

  // Filter by query (room type)
  if (filters.query) {
    const searchTerm = filters.query.toLowerCase().trim();
    filtered = filtered.filter((room) =>
      room.type.toLowerCase().includes(searchTerm) ||
      room.description?.toLowerCase().includes(searchTerm)
    );
  }

  // Filter by price range
  if (filters.priceMin !== undefined) {
    filtered = filtered.filter((room) => room.pricePerNight >= filters.priceMin!);
  }

  if (filters.priceMax !== undefined) {
    filtered = filtered.filter((room) => room.pricePerNight <= filters.priceMax!);
  }

  // Filter by capacity
  if (filters.capacity !== undefined) {
    filtered = filtered.filter((room) => room.capacity >= filters.capacity!);
  }

  // Filter by amenities (room must have all selected amenities)
  if (filters.amenities && filters.amenities.length > 0) {
    filtered = filtered.filter((room) =>
      filters.amenities!.every((amenity) =>
        room.amenities.some((roomAmenity) =>
          roomAmenity.toLowerCase().includes(amenity.toLowerCase())
        )
      )
    );
  }

  // Filter by availability
  if (filters.checkInDate || filters.checkOutDate) {
    filtered = filtered.filter((room) => room.isAvailable);
  }

  return filtered;
};

/**
 * Sort rooms by price
 * Requirements: 4.4
 */
export const sortRoomsByPrice = (rooms: Room[], ascending: boolean = true): Room[] => {
  return [...rooms].sort((a, b) => {
    return ascending
      ? a.pricePerNight - b.pricePerNight
      : b.pricePerNight - a.pricePerNight;
  });
};

/**
 * Sort hotels alphabetically by name
 * Requirements: 1.5
 */
export const sortHotelsByName = (hotels: Hotel[]): Hotel[] => {
  return [...hotels].sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Search Service Object (for easier imports)
 */
export const searchService = {
  searchHotels,
  filterRooms,
  filterHotelsLocally,
  filterRoomsLocally,
  sortRoomsByPrice,
  sortHotelsByName,
};
