export * from './core';
export * from './types';
export * from './store';
export * from './restaurant';
export * from './staff';
export * from './rooms';
export * from './finance';
export * from './reports';
export * from './system';
export * from './operations';
export * from './procurement';
export * from './kyogong';
export * from './employee-portal';
export * from './search';
export * from './bar';
export * from './guest-portal';
export * from './admin-logs';
export * from './branch-manager';

import { authAPI, userAPI, notificationsAPI, systemAPI, idCardsAPI, channelManagerAPI, documentsAPI } from './system';
import { bookingsAPI, roomsAPI, guestAPI, ratePlansAPI, guestLoyaltyAPI } from './rooms';
import { staffAPI, attendanceAPI, payrollAPI, payrollPoliciesAPI, shiftsAPI, simplePayrollAPI } from './staff';
import { restaurantAPI, barAPI } from './restaurant';
import { storeAPI, stockTakeAPI } from './store';
import { financeAPI, accountingAPI, receiptsAPI, pettyCashAPI, bankingAPI, paymentsVerificationAPI } from './finance';
import { reportsAPI, auditAPI, auditorReportsAPI } from './reports';
import { conferenceAPI, cateringAPI, housekeepingAPI, kitchenAPI, inventoryAPI, barInventoryAPI, maintenanceAPI } from './operations';
import { procurementAPI, suppliersAPI } from './procurement';
import { kyogongAPI } from './kyogong';
import { employeePortalAPI } from './employee-portal';
import { searchAPI, attendanceAnalyticsAPI, automationAPI, forecastingAPI } from './search';
import { cashierAPI, barStockRequestsAPI } from './bar';
import { guestPortalAPI } from './guest-portal';
import { adminLogsAPI } from './admin-logs';
import { staffAuditAPI, profitLossAPI, stockAnalyticsAPI } from './branch-manager';

// Explicitly export all API modules as named exports for better reliability and discovery
export { 
  authAPI, userAPI, notificationsAPI, systemAPI, idCardsAPI, channelManagerAPI, documentsAPI,
  bookingsAPI, roomsAPI, guestAPI, ratePlansAPI, guestLoyaltyAPI,
  staffAPI, attendanceAPI, payrollAPI, payrollPoliciesAPI, shiftsAPI, simplePayrollAPI,
  restaurantAPI, barAPI,
  storeAPI, stockTakeAPI,
  financeAPI, accountingAPI, receiptsAPI, pettyCashAPI, bankingAPI, paymentsVerificationAPI,
  reportsAPI, reportsAPI as reportAPI, reportsAPI as reportsService, auditAPI, auditorReportsAPI,
  conferenceAPI, cateringAPI, housekeepingAPI, kitchenAPI, inventoryAPI, barInventoryAPI, maintenanceAPI,
  procurementAPI, suppliersAPI,
  kyogongAPI,
  employeePortalAPI,
  searchAPI, attendanceAnalyticsAPI, automationAPI, forecastingAPI,
  barStockRequestsAPI, cashierAPI,
  guestPortalAPI,
  adminLogsAPI,
  staffAuditAPI, profitLossAPI, stockAnalyticsAPI,
  // Add common aliases as named exports for backward compatibility
  bookingsAPI as folioAPI,
  roomsAPI as pricingAPI,
  financeAPI as paymentsAPI
};

/**
 * Strict interface for the API client to catch contract mismatches at compile-time.
 */
/**
 * Strict interface for the API client to catch contract mismatches at compile-time.
 */
export interface ApiInterface {
  auth: typeof authAPI;
  bookings: typeof bookingsAPI;
  user: typeof userAPI;
  staff: typeof staffAPI;
  rooms: typeof roomsAPI;
  guests: typeof guestAPI;
  bar: typeof barAPI;
  restaurant: typeof restaurantAPI;
  store: typeof storeAPI;
  storeService: typeof storeAPI;
  kitchen: typeof kitchenAPI;
  finance: typeof financeAPI;
  banking: typeof bankingAPI;
  accounting: typeof accountingAPI;
  paymentsVerification: typeof paymentsVerificationAPI;
  reports: typeof reportsAPI;
  report: typeof reportsAPI;
  audit: typeof auditAPI;
  auditorReports: typeof auditorReportsAPI;
  conference: typeof conferenceAPI;
  catering: typeof cateringAPI;
  housekeeping: typeof housekeepingAPI;
  maintenance: typeof maintenanceAPI;
  payroll: typeof payrollAPI;
  payrollPolicies: typeof payrollPoliciesAPI;
  notifications: typeof notificationsAPI;
  employeePortal: typeof employeePortalAPI;
  idCards: typeof idCardsAPI;
  procurement: typeof procurementAPI;
  suppliers: typeof suppliersAPI;
  kyogong: typeof kyogongAPI;
  barInventory: typeof barInventoryAPI;
  barStockRequests: typeof barStockRequestsAPI;
  attendance: typeof attendanceAPI;
  attendanceAnalytics: typeof attendanceAnalyticsAPI;
  cashier: typeof cashierAPI;
  search: typeof searchAPI;
  automation: typeof automationAPI;
  forecasts: typeof forecastingAPI;
  guestPortal: typeof guestPortalAPI;
  system: typeof systemAPI;
  channelManager: typeof channelManagerAPI;
  ratePlans: typeof ratePlansAPI;
  guestLoyalty: typeof guestLoyaltyAPI;
  documents: typeof documentsAPI;
  folio: typeof bookingsAPI;
  folioAPI: typeof bookingsAPI;
  payments: typeof financeAPI;
  paymentsAPI: typeof financeAPI;
  pricing: typeof roomsAPI;
  pricingAPI: typeof roomsAPI;
  inventory: typeof inventoryAPI;
  kitchenStock: typeof kitchenAPI;
  adminLogs: typeof adminLogsAPI;
}

export const api: ApiInterface = {
  auth: authAPI,
  bookings: bookingsAPI,
  user: userAPI,
  staff: staffAPI,
  rooms: roomsAPI,
  guests: guestAPI,
  bar: barAPI,
  restaurant: restaurantAPI,
  store: storeAPI,
  storeService: storeAPI,
  kitchen: kitchenAPI,
  finance: financeAPI,
  banking: bankingAPI,
  accounting: accountingAPI,
  paymentsVerification: paymentsVerificationAPI,
  reports: reportsAPI,
  report: reportsAPI,
  audit: auditAPI,
  auditorReports: auditorReportsAPI,
  conference: conferenceAPI,
  catering: cateringAPI,
  housekeeping: housekeepingAPI,
  maintenance: maintenanceAPI,
  payroll: payrollAPI,
  payrollPolicies: payrollPoliciesAPI,
  notifications: notificationsAPI,
  employeePortal: employeePortalAPI,
  idCards: idCardsAPI,
  procurement: procurementAPI,
  suppliers: suppliersAPI,
  kyogong: kyogongAPI,
  barInventory: barInventoryAPI,
  barStockRequests: barStockRequestsAPI,
  attendance: attendanceAPI,
  attendanceAnalytics: attendanceAnalyticsAPI,
  cashier: cashierAPI,
  search: searchAPI,
  automation: automationAPI,
  forecasts: forecastingAPI,
  guestPortal: guestPortalAPI,
  system: systemAPI,
  channelManager: channelManagerAPI,
  ratePlans: ratePlansAPI,
  guestLoyalty: guestLoyaltyAPI,
  documents: documentsAPI,
  folio: bookingsAPI,
  folioAPI: bookingsAPI,
  payments: financeAPI,
  paymentsAPI: financeAPI,
  pricing: roomsAPI,
  pricingAPI: roomsAPI,
  inventory: inventoryAPI,
  kitchenStock: kitchenAPI,
  adminLogs: adminLogsAPI,
};

export default api;
