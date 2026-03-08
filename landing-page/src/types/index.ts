/**
 * Core type definitions for the FamousGates Hotels Landing Page
 */

export interface Hotel {
  id: string;
  name: string;
  location: string;
  description: string;
  shortDescription?: string;
  primaryImage: string;
  images?: string[];
  amenities: string[];
  contactInfo: ContactInfo;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: number | string;
  name: string;
  code: string;
  location: string;
  address: string;
  phone: string;
  email: string;
  status: string | boolean;
}

export interface ContactInfo {
  phone: string;
  email: string;
  address: string;
  businessHours: string;
  socialMedia?: SocialMedia;
}

export interface SocialMedia {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
}

export interface Room {
  id: string;
  hotelId: string;
  type: string;
  capacity: number;
  pricePerNight: number;
  currency: string;
  amenities: string[];
  images: string[];
  description: string;
  isAvailable: boolean;
  availableFrom?: string;
  availableTo?: string;
}

export interface Promotion {
  id: string;
  hotelId: string;
  title: string;
  description: string;
  discountPercentage?: number;
  validFrom: string;
  validTo: string;
  image?: string;
  terms?: string;
}

export interface BookingRequest {
  branchId?: string | number;
  branch_id?: string | number;
  roomId?: string;
  room_id?: string;
  roomTypeId?: string;
  room_type_id?: string;
  guestId?: string;
  guest_id?: string;
  guestInfo: GuestInfo;
  checkInDate: string;
  check_in_date?: string;
  checkOutDate: string;
  check_out_date?: string;
  numberOfGuests?: number;
  adults?: number;
  children?: number;
  infants?: number;
  mealPlan?: string;
  specialRequests?: string;
  bookingSource?: string;
}

export interface GuestInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idType?: string;
  idNumber?: string;
  nationality?: string;
  address?: string;
}

export interface BookingConfirmation {
  confirmationNumber?: string;
  referenceNumber?: string;
  bookingId: string;
  hotelName?: string;
  branchName?: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice?: number;
  amount_paid?: number;
  currency?: string;
  guestInfo: GuestInfo;
  status: string;
  createdAt: string;
}

export interface SearchFilters {
  query?: string;
  location?: string;
  priceMin?: number;
  priceMax?: number;
  capacity?: number;
  amenities?: string[];
  checkInDate?: string;
  checkOutDate?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
