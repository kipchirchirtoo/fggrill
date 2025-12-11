import { fetchWithBranchContext } from './branch-api';

/**
 * API Client for ML Forecasting Services
 */
const mlForecastingAPI = {
  /**
   * Get sales forecast
   * @param branchId Optional branch ID
   * @param days Number of days to forecast
   */
  getSalesForecast: async (branchId?: number, days: number = 30) => {
    let url = `/api/forecasting/sales?days=${days}`;
    
    if (branchId) {
      url += `&branch_id=${branchId}`;
    }
    
    return fetchWithBranchContext(url);
  },
  
  /**
   * Get inventory demand forecast
   * @param categoryId Optional category ID
   * @param days Number of days to forecast
   */
  getInventoryForecast: async (categoryId?: number, days: number = 30) => {
    let url = `/api/forecasting/inventory?days=${days}`;
    
    if (categoryId) {
      url += `&category_id=${categoryId}`;
    }
    
    return fetchWithBranchContext(url);
  },
  
  /**
   * Get occupancy forecast
   * @param branchId Optional branch ID
   * @param days Number of days to forecast
   */
  getOccupancyForecast: async (branchId?: number, days: number = 30) => {
    let url = `/api/forecasting/occupancy?days=${days}`;
    
    if (branchId) {
      url += `&branch_id=${branchId}`;
    }
    
    return fetchWithBranchContext(url);
  },
  
  /**
   * Get budget forecast
   * @param departmentId Optional department ID
   * @param months Number of months to forecast
   */
  getBudgetForecast: async (departmentId?: number, months: number = 3) => {
    let url = `/api/forecasting/budget?months=${months}`;
    
    if (departmentId) {
      url += `&department_id=${departmentId}`;
    }
    
    return fetchWithBranchContext(url);
  }
};

export default mlForecastingAPI;
