import { fetchAPI, buildQuery } from './core';
import { 
  ApiResponse, 
  Booking, 
  Room 
} from './types';

// =====================================
// ROOMS API
// =====================================

// ─── Base Rooms Logic (Private to avoid recursive type inference issues) ──────
const roomsBase = {
  getRooms: (params?: any) => fetchAPI<Room[]>(`/rooms${buildQuery(params)}`),
  getRoom: (id: string | number) => fetchAPI<Room>(`/rooms/${id}`),
  create: (data: any) => fetchAPI<Room>('/rooms', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string | number, data: any) => fetchAPI<Room>(`/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string | number) => fetchAPI<void>(`/rooms/${id}`, { method: 'DELETE' }),
  toggleStatus: (id: string | number, status: string) => fetchAPI<void>(`/rooms/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getRoomTypes: () => fetchAPI<any[]>('/rooms/types'),
  updateRoomType: (id: string | number, data: any) => fetchAPI<any>(`/rooms/types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getHousekeeping: (params?: any) => fetchAPI<any[]>(`/rooms/housekeeping${buildQuery(params)}`),
  
  // Extension methods
  getRoomBookings: (id: string | number) => fetchAPI<Booking[]>(`/rooms/${id}/bookings`),
  getRoomMaintenance: (id: string | number) => fetchAPI<any[]>(`/rooms/${id}/maintenance`),
  getRoomReviews: (id: string | number) => fetchAPI<any[]>(`/rooms/${id}/reviews`),
};

/**
 * roomsAPI — High-level Room management.
 * Includes both modern and legacy alias methods.
 */
export const roomsAPI = {
  ...roomsBase,
  createRoom: (data: any) => roomsBase.create(data),
  updateRoom: (id: string | number, data: any) => roomsBase.update(id, data),
  deleteRoom: (id: string | number) => roomsBase.delete(id),
  updateRoomStatus: (id: string | number, status: string) => roomsBase.toggleStatus(id, status),
};

export const ratePlansAPI = {
  getRatePlans: () => roomsBase.getRoomTypes(),
  createRatePlan: (data: any) => fetchAPI<any>('/rooms/types', { method: 'POST', body: JSON.stringify(data) }),
  updateRatePlan: (id: string | number, data: any) => roomsBase.updateRoomType(id, data),
  deleteRatePlan: (id: string | number) => fetchAPI<void>(`/rooms/types/${id}`, { method: 'DELETE' }),
};

// =====================================
// BOOKINGS / RESERVATIONS API
// =====================================

// ─── Bookings & Reservations ─────────────────────────────────────────────────

const bookingsBase = {
  getBookings: (params?: any) => fetchAPI<Booking[]>(`/bookings${buildQuery(params)}`),
  getBooking: (id: string | number) => fetchAPI<Booking>(`/bookings/${id}`),
  create: (data: any) => fetchAPI<Booking>('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string | number, data: any) => fetchAPI<Booking>(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  cancel: (id: string | number, reason?: string) => fetchAPI<void>(`/bookings/${id}/cancel`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  checkIn:  (id: string | number) => fetchAPI<void>(`/bookings/${id}/check-in`,  { method: 'PUT' }),
  checkOut: (id: string | number) => fetchAPI<void>(`/bookings/${id}/check-out`, { method: 'PUT' }),
  
  // Folio & Billing
  getFolio: (id: string | number) => fetchAPI<any>(`/bookings/${id}/folio`),
  addCharge: (id: string | number, data: any) => fetchAPI<void>(`/bookings/${id}/charges`, { method: 'POST', body: JSON.stringify(data) }),
  
  getAvailableRooms: (params: { start_date: string; end_date: string; room_type?: string; branch_id?: number }) =>
    fetchAPI<Room[]>(`/bookings/available${buildQuery(params)}`),
};

export const bookingsAPI = {
  // Appended for UI Compatibility
  getBookingByConfirmation: (ref: any) => fetchAPI<any>(`/bookings/confirmation/${ref}`),
  addTransaction: (id: any, data: any) => fetchAPI<any>(`/bookings/${id}/transactions`, { method: 'POST', body: JSON.stringify(data) }),

  ...bookingsBase,
  createBooking: (data: any) => bookingsBase.create(data),
  updateBooking: (id: string | number, data: any) => bookingsBase.update(id, data),
  cancelBooking: (id: string | number, reason?: string) => bookingsBase.cancel(id, reason),
};

// ─── Guests & Loyalty ────────────────────────────────────────────────────────

const guestBase = {
  getGuests: (params?: any) => fetchAPI<any[]>(`/guests${buildQuery(params)}`),
  getGuest: (id: string | number) => fetchAPI<any>(`/guests/${id}`),
  create: (data: any) => fetchAPI<any>('/guests', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string | number, data: any) => fetchAPI<any>(`/guests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGuest: (id: string | number) => fetchAPI<void>(`/guests/${id}`, { method: 'DELETE' }),
  getHistory: (id: string | number) => fetchAPI<any[]>(`/guests/${id}/history`),
};

export const guestAPI = {
  ...guestBase,
  createGuest: (data: any) => guestBase.create(data),
  updateGuest: (id: string | number, data: any) => guestBase.update(id, data),
};

export const guestLoyaltyAPI = {
  getPoints: (guestId: string | number) => fetchAPI<any>(`/guests/${guestId}/loyalty/points`),
  getLoyaltyPoints: (guestId: string | number) => fetchAPI<any>(`/guests/${guestId}/loyalty/points`),
  getHistory: (guestId: string | number) => fetchAPI<any[]>(`/guests/${guestId}/loyalty/history`),
  redeemPoints: (guestId: string | number, amount: number) => fetchAPI<void>(`/guests/${guestId}/loyalty/redeem`, { 
    method: 'POST', 
    body: JSON.stringify({ amount }) 
  }),
};
