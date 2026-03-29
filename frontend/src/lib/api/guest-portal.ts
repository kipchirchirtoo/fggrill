import { fetchAPI, buildQuery, API_URL, PYTHON_API_URL } from './core';

export interface LoyaltyDetails {
  total_points: number;
  tier: string;
  total_stays: number;
  total_spent: number;
  next_tier_progress?: number;
}

export interface GuestDashboard {
  profile: any;
  bookings: any[];
  activeBooking: any;
  loyalty: LoyaltyDetails;
  pendingRequests: any[];
  unreadMessages: number;
  amenities: any[];
}

export const guestPortalAPI = {
  getDashboard: () => fetchAPI<GuestDashboard>('/guest-portal/dashboard'),
  
  getBookings: (params?: any) => 
    fetchAPI<any[]>(`/guest-portal/bookings${buildQuery(params)}`),
  
  getRequests: (params?: any) => 
    fetchAPI<any[]>(`/guest-portal/requests${buildQuery(params)}`),
  
  createRequest: (data: any) => 
    fetchAPI<any>('/guest-portal/requests', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),

  getLoyalty: () => fetchAPI<any>('/guest-portal/loyalty'),
  
  getMessages: () => fetchAPI<any[]>('/guest-portal/messages'),
  
  sendMessage: (message: string, bookingId?: string) => 
    fetchAPI<any>('/guest-portal/messages', { 
      method: 'POST', 
      body: JSON.stringify({ message, booking_id: bookingId }) 
    }),
    
  updateProfile: (data: any) => 
    fetchAPI<any>('/guest-portal/profile', { 
      method: 'PUT', 
      body: JSON.stringify(data) 
    }),

  // Python Service Endpoints (Loyalty & Specialized Requests)
  getLoyaltyDetails: (guestId: string) => 
    fetchAPI<any>(`/guest-portal/loyalty/details?guest_id=${guestId}`, {}, PYTHON_API_URL),
    
  getServiceRequests: (guestId: string) => 
    fetchAPI<any>(`/guest-portal/requests?guest_id=${guestId}`, {}, PYTHON_API_URL),
};
