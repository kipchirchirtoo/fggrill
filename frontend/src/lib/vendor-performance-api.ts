import { fetchWithBranchContext } from './branch-api';

/**
 * API Client for Vendor Performance Services
 */
const vendorPerformanceAPI = {
  /**
   * Get all vendor performance data
   */
  getAllVendorPerformance: async () => {
    return fetchWithBranchContext('/api/vendors/performance');
  },
  
  /**
   * Get detailed performance for a specific vendor
   * @param vendorId Vendor ID
   */
  getVendorDetails: async (vendorId: number) => {
    return fetchWithBranchContext(`/api/vendors/performance/${vendorId}`);
  },
  
  /**
   * Record a new vendor delivery
   * @param delivery Delivery data
   */
  recordDelivery: async (delivery: any) => {
    return fetchWithBranchContext('/api/vendors/deliveries', {
      method: 'POST',
      body: JSON.stringify(delivery),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },
  
  /**
   * Submit a rating for a vendor
   * @param rating Rating data
   */
  submitRating: async (rating: any) => {
    return fetchWithBranchContext('/api/vendors/ratings', {
      method: 'POST',
      body: JSON.stringify(rating),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },
  
  /**
   * Get vendor rankings and comparison
   * @param category Optional category filter
   */
  getVendorRankings: async (category?: string) => {
    let url = '/api/vendors/rankings';
    
    if (category) {
      url += `?category=${encodeURIComponent(category)}`;
    }
    
    return fetchWithBranchContext(url);
  },
  
  /**
   * Generate vendor performance report
   * @param vendorId Optional vendor ID
   * @param category Optional category
   */
  generateReport: async (vendorId?: number, category?: string) => {
    let url = '/api/vendors/report?';
    const params = new URLSearchParams();
    
    if (vendorId) {
      params.append('vendor_id', vendorId.toString());
    }
    
    if (category) {
      params.append('category', category);
    }
    
    return fetchWithBranchContext(`${url}${params}`);
  }
};

export default vendorPerformanceAPI;
