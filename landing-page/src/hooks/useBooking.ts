/**
 * React Query Hooks for Bookings
 * Provides mutation hooks for booking creation and query hooks for booking details
 */

import { useMutation, useQuery, UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { BookingRequest, BookingConfirmation } from '@/types';
import { bookingService } from '@/services/booking.service';

/**
 * Query Keys for React Query
 */
export const bookingKeys = {
  all: ['bookings'] as const,
  details: () => [...bookingKeys.all, 'detail'] as const,
  detail: (reference: string) => [...bookingKeys.details(), reference] as const,
};

/**
 * Hook to create a new booking
 * Uses mutation for POST request
 */
export const useCreateBooking = (): UseMutationResult<
  BookingConfirmation,
  Error,
  BookingRequest
> => {
  return useMutation({
    mutationFn: bookingService.createBooking,
    retry: false, // Don't retry booking submissions automatically
  });
};

/**
 * Hook to fetch booking details by reference number
 */
export const useBookingDetails = (
  reference: string,
  email: string,
  enabled: boolean = true
): UseQueryResult<BookingConfirmation, Error> => {
  return useQuery({
    queryKey: bookingKeys.detail(reference),
    queryFn: () => bookingService.getBookingDetails(reference, email),
    enabled: enabled && !!reference && !!email,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
};
