/**
 * Booking Service
 * Handles booking creation and retrieval with validation and duplicate prevention
 * Requirements: 5.1, 5.2, 5.5, 5.6
 */

import { apiClient } from './api-client';
import { BookingRequest, BookingConfirmation } from '@/types';

/**
 * API Endpoints
 */
const ENDPOINTS = {
  BOOKINGS: '/bookings',
  AVAILABLE_ROOMS: '/bookings/available',
  CHECK_AVAILABILITY: '/bookings/check-availability',
  BOOKING_BY_CONFIRMATION: (confirmation: string) => `/bookings/confirmation/${confirmation}`,
};

/**
 * Validation Errors
 */
export class BookingValidationError extends Error {
  public field?: string;
  public errors: Record<string, string>;

  constructor(message: string, errors: Record<string, string> = {}) {
    super(message);
    this.name = 'BookingValidationError';
    this.errors = errors;
  }
}

/**
 * Validate email format
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone format (basic validation)
 */
const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

/**
 * Validate date format (ISO 8601)
 */
const isValidDate = (date: string): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;

  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime());
};

/**
 * Validate that check-out is after check-in
 */
const isValidDateRange = (checkInDate: string, checkOutDate: string): boolean => {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  return checkOut > checkIn;
};

/**
 * Validate booking request data
 * Requirements: 5.2
 */
export const validateBookingRequest = (request: BookingRequest): void => {
  const errors: Record<string, string> = {};

  // Validate branch ID
  if (!request.branchId && !request.branch_id) {
    errors.branchId = 'Branch is required';
  }

  // Validate room ID or room type ID
  if (!request.roomId && !request.room_id && !request.roomTypeId && !request.room_type_id) {
    errors.roomId = 'Room or Room Type is required';
  }

  // Validate guest info
  if (!request.guestInfo.firstName || request.guestInfo.firstName.trim() === '') {
    errors.firstName = 'First name is required';
  }

  if (!request.guestInfo.lastName || request.guestInfo.lastName.trim() === '') {
    errors.lastName = 'Last name is required';
  }

  if (!request.guestInfo.email || !isValidEmail(request.guestInfo.email)) {
    errors.email = 'Valid email address is required';
  }

  if (!request.guestInfo.phone || !isValidPhone(request.guestInfo.phone)) {
    errors.phone = 'Valid phone number is required';
  }

  // Validate dates
  if (!request.checkInDate || !isValidDate(request.checkInDate)) {
    errors.checkInDate = 'Valid check-in date is required (YYYY-MM-DD)';
  }

  if (!request.checkOutDate || !isValidDate(request.checkOutDate)) {
    errors.checkOutDate = 'Valid check-out date is required (YYYY-MM-DD)';
  }

  if (request.checkInDate && request.checkOutDate &&
    isValidDate(request.checkInDate) && isValidDate(request.checkOutDate)) {
    if (!isValidDateRange(request.checkInDate, request.checkOutDate)) {
      errors.dateRange = 'Check-out date must be after check-in date';
    }

    // Check that check-in is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkIn = new Date(request.checkInDate);
    if (checkIn < today) {
      errors.checkInDate = 'Check-in date cannot be in the past';
    }
  }

  // Validate number of guests
  if (!request.numberOfGuests || request.numberOfGuests < 1) {
    errors.numberOfGuests = 'At least one guest is required';
  }

  // If there are errors, throw validation error
  if (Object.keys(errors).length > 0) {
    throw new BookingValidationError('Booking validation failed', errors);
  }
};

/**
 * Duplicate submission prevention
 * Tracks recent booking submissions to prevent duplicates
 * Requirements: 5.6
 */
class DuplicateSubmissionPrevention {
  private pendingSubmissions: Set<string>;
  private recentSubmissions: Map<string, number>;
  private readonly DUPLICATE_WINDOW = 60000; // 60 seconds

  constructor() {
    this.pendingSubmissions = new Set();
    this.recentSubmissions = new Map();
  }

  /**
   * Generate a unique key for a booking request
   */
  private generateKey(request: BookingRequest): string {
    return `${request.branchId || request.branch_id}-${request.roomId || request.room_id}-${request.checkInDate}-${request.checkOutDate}-${request.guestInfo.email}`;
  }

  /**
   * Check if a submission is a duplicate
   */
  isDuplicate(request: BookingRequest): boolean {
    const key = this.generateKey(request);

    // Check if currently pending
    if (this.pendingSubmissions.has(key)) {
      return true;
    }

    // Check if recently submitted
    const lastSubmission = this.recentSubmissions.get(key);
    if (lastSubmission && Date.now() - lastSubmission < this.DUPLICATE_WINDOW) {
      return true;
    }

    return false;
  }

  /**
   * Mark a submission as pending
   */
  markPending(request: BookingRequest): void {
    const key = this.generateKey(request);
    this.pendingSubmissions.add(key);
  }

  /**
   * Mark a submission as complete
   */
  markComplete(request: BookingRequest): void {
    const key = this.generateKey(request);
    this.pendingSubmissions.delete(key);
    this.recentSubmissions.set(key, Date.now());

    // Clean up old entries
    this.cleanup();
  }

  /**
   * Mark a submission as failed (allow retry)
   */
  markFailed(request: BookingRequest): void {
    const key = this.generateKey(request);
    this.pendingSubmissions.delete(key);
  }

  /**
   * Clean up old entries from recent submissions
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.recentSubmissions.entries()) {
      if (now - timestamp > this.DUPLICATE_WINDOW) {
        this.recentSubmissions.delete(key);
      }
    }
  }
}

// Singleton instance for duplicate prevention
const duplicatePrevention = new DuplicateSubmissionPrevention();

/**
 * Create a new booking
 * Requirements: 5.1, 5.2, 5.5, 5.6
 */
export const createBooking = async (request: BookingRequest): Promise<BookingConfirmation> => {
  // Validate request data
  validateBookingRequest(request);

  // Check for duplicate submission
  if (duplicatePrevention.isDuplicate(request)) {
    throw new Error('A booking with these details is already being processed. Please wait.');
  }

  try {
    // Mark as pending
    duplicatePrevention.markPending(request);

    // Submit booking
    const confirmation = await apiClient.post<BookingConfirmation, BookingRequest>(
      ENDPOINTS.BOOKINGS,
      request
    );

    // Mark as complete
    duplicatePrevention.markComplete(request);

    return confirmation;
  } catch (error) {
    // Mark as failed to allow retry
    duplicatePrevention.markFailed(request);
    throw error;
  }
};

/**
 * Search available rooms
 */
export const searchAvailableRooms = async (params: {
  branch_id?: string | number,
  checkIn: string,
  checkOut: string
}): Promise<any> => {
  console.log('📡 Calling API with params:', params);
  const result = await apiClient.get<any>(ENDPOINTS.AVAILABLE_ROOMS, { params });
  console.log('📦 API returned:', result);
  return result;
};

/**
 * Get booking details by confirmation number
 */
export const getBookingDetails = async (confirmation: string, email: string): Promise<any> => {
  if (!confirmation || confirmation.trim() === '') {
    throw new Error('Booking confirmation is required');
  }

  return apiClient.get<any>(ENDPOINTS.BOOKING_BY_CONFIRMATION(confirmation), { params: { email } });
};

/**
 * Booking Service Object (for easier imports)
 */
export const bookingService = {
  createBooking,
  getBookingDetails,
  searchAvailableRooms,
  validateBookingRequest,
};
