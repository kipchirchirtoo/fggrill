import express from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import bookingRoutes from './booking.routes';
import roomRoutes from './room.routes';
import inventoryRoutes from './inventory.routes';
import inventoryFoundationRoutes from './inventory-foundation.routes';
import inventoryGovernanceRoutes from './inventory-governance.routes';
import housekeepingRoutes from './housekeeping.routes';
import maintenanceRoutes from './maintenance.routes';
import reportRoutes from './report.routes';
import storekeepingRoutes from './storekeeping.routes';
import stockAnalyticsRoutes from './stock-analytics.routes';
import financeRoutes from './finance.routes';
import revenueOversightRoutes from './revenue-oversight.routes';
import systemRoutes from './system.routes';
import fleetRoutes from './fleet.routes';
import barRoutes from './bar.routes';
import barStockRequestsRoutes from './bar-stock-requests.routes';
import restaurantRoutes from './restaurant.routes';
import restaurantReservationRoutes from './restaurant.reservation.routes';
import restaurantTableRoutes from './restaurant.table.routes';
import waiterSalesRoutes from './waiter-sales.routes';
import offersRoutes from './offers.routes';
import emailRoutes from './email.routes';
import landingEmailRoutes from './landing-email.routes';
import reviewsRoutes from './reviews.routes';
import paymentRoutes from './payment.routes';
import buffetRoutes from './buffet.routes';
import barcodeRoutes from './barcode.routes';
import {
  sendBookingEmail,
  sendAllConfirmedBookingEmails,
  testEmailService,
  sendCancellationEmail,
  sendPaymentReceiptEmail,
  sendInvoiceEmail,
  sendCheckInReminderEmail,
  sendCheckOutReminderEmail
} from '../controllers/email-booking.controller';
import notificationRoutes from './notification.routes';
import folioRoutes from './folio.routes';
import guestRoutes from './guest.routes';
import auditRoutes from './audit.routes';
import maintenanceEnhancedRoutes from './maintenance.enhanced.routes';
import auditorRoutes from './auditor.routes';
import accountingRoutes from './accounting.routes';
import receiptsRoutes from './receipts.routes';
import branchOperationsRoutes from './branch-operations.routes';
import automationRoutes from './automation.routes';
import mlForecastingRoutes from './ml-forecasting.routes';
import vendorPerformanceRoutes from './vendor-performance.routes';
import facilitiesRoutes from './facilities.routes';
import adminRoutes from './admin.routes';
import ratePlanRoutes from './ratePlan.routes';
import mealPlanRoutes from './meal-plan.routes';
import pricingRoutes from './pricing.routes';
import documentRoutes from './document.routes';
import communicationRoutes from './communication.routes';
import channelManagerRoutes from './channelManager.routes';
import employeePortalRoutes from './employee-portal.routes';
import guestPortalRoutes from './guest-portal.routes';
import corporateRoutes from './corporate.routes';
import staffRoutes from './staff.routes';
import staffPerformanceRoutes from './staff-performance.routes';
import staffAuditRoutes from './staff-audit.routes';
import storekeepingEnhancedRoutes from './storekeeping';
import cashierRoutes from './cashier.routes';
import cashierExpensesRoutes from './cashier-expenses.routes';
import cashierClearanceRoutes from './cashier-clearance.routes';
import outletPosRoutes from './outlet-pos.routes';
import profitLossRoutes from './profit-loss.routes';
import wastageRoutes from './wastage.routes';
import kitchenLedgerRoutes from './kitchen-ledger.routes';
import additionalServicesRoutes from './additional-services.routes';
import dispatchRoutes from './dispatch.routes';
import auditorReportsRoutes from './auditor-reports.routes';
import conferenceRoutes from './conference.routes';
import cateringRoutes from './catering.routes';
import attendanceRoutes from './attendance.routes';
import pettyCashRoutes from './petty-cash.routes';
import creditRoutes from './credit.routes';
import kitchenRoutes from './kitchen.routes';
import kitchenShiftRoutes from './kitchen-shift.routes';
import payrollRoutes from './payroll.routes';
import payrollSimpleRoutes from './payroll-simple.routes';
import procurementRoutes from './procurement.routes';
import hrReportRoutes from './hr-reports.routes';
import stockTakeRoutes from './stock-take.routes';
import verifyRoutes from './verify.routes';
import auditorVoidBillsRoutes from './auditor-void-bills.routes';
import kyogongRoutes from './kyogong.routes';
import bankingRoutes from './banking.routes';
import suppliersRoutes from './suppliers.routes';
import shiftsRoutes from './shifts.routes';
import payrollEnhancedRoutes from './payroll-enhanced.routes';
import cateringBookingsRoutes from './catering-bookings.routes';
import payrollAdjustmentsRoutes from './payroll-adjustments.routes';
import statutoryDeductionsRoutes from './statutory-deductions.routes';
import performanceRoutes from './performance.routes';
import paymentsRoutes from './payments.routes';
import payrollPoliciesRoutes from './payroll-policies.routes';
import adminLogsRoutes from './admin-logs.routes';
import adminAiRoutes from './admin-ai.route';
import searchRoutes from './search.routes';
import branchAnalyticsRoutes from './branch-analytics.routes';
import securityRoutes from './security.routes';
import communicationsRoutes from './communications.routes';
import superadminRoutes from './superadmin.routes';
import linaRoutes from './lina.routes';
import documentTemplateRoutes from './document-template.routes';
import menuPricingRoutes from './menu-pricing.routes';
import branchSearchRoutes from './branch-search.routes';
import branchPaymentRoutes from './branch-payments.routes';
import restaurantBillsRoutes from './restaurant-bills.routes';
import kitchenWastageRoutes from './kitchen-wastage.routes';
import powerSyncRoutes from './powersync.routes';
import branchHealthRoutes from './branch-health.routes';
import branchFeaturesRoutes from './branch-features.routes';
import roomChargeRoutes from './room-charge.routes';
import paymentCollectionRoutes from './payment_collection.routes';
import { maintenanceMode } from '../middleware/maintenanceMode';

const router = express.Router();

// Maintenance mode gate
router.use(maintenanceMode);

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    env_check: {
      SUPABASE_PROJECT_URL: !!process.env.SUPABASE_PROJECT_URL,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_JWT_SECRET: !!process.env.SUPABASE_JWT_SECRET,
      JWT_SECRET: !!process.env.JWT_SECRET,
    }
  });
});

// Route mounts
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/bookings', bookingRoutes);
router.use('/rooms', roomRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/inventory-foundation', inventoryFoundationRoutes);
router.use('/inventory-governance', inventoryGovernanceRoutes);
router.use('/housekeeping', housekeepingRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/reports', reportRoutes);
router.use('/storekeeping', storekeepingRoutes);
router.use('/store', storekeepingRoutes);
router.use('/stock-analytics', stockAnalyticsRoutes);
router.use('/finance', financeRoutes);
router.use('/revenue-oversight', revenueOversightRoutes);
router.use('/system', systemRoutes);
router.use('/fleet', fleetRoutes);
router.use('/bar', barRoutes);
router.use('/bar-stock-requests', barStockRequestsRoutes);
router.use('/restaurant', restaurantRoutes);
router.use('/restaurant/reservations', restaurantReservationRoutes);
router.use('/restaurant/tables', restaurantTableRoutes);
router.use('/waiter-sales', waiterSalesRoutes);
router.use('/offers', offersRoutes);
router.use('/email', emailRoutes);
router.use('/landing-email', landingEmailRoutes);
router.use('/reviews', reviewsRoutes);
router.use('/payment', paymentRoutes);
router.use('/payments', paymentRoutes);
router.use('/buffet', buffetRoutes);
router.use('/barcode', barcodeRoutes);
router.use('/notifications', notificationRoutes);
router.use('/folios', folioRoutes);
router.use('/guests', guestRoutes);
router.use('/audit', auditRoutes);
router.use('/maintenance-enhanced', maintenanceEnhancedRoutes);
router.use('/auditor', auditorRoutes);
router.use('/accounting', accountingRoutes);
router.use('/receipts', receiptsRoutes);
router.use('/branch-operations', branchOperationsRoutes);
router.use('/automation', automationRoutes);
router.use('/ml-forecasting', mlForecastingRoutes);
router.use('/forecasting', mlForecastingRoutes);
router.use('/vendor-performance', vendorPerformanceRoutes);
router.use('/facilities', facilitiesRoutes);
router.use('/admin', adminRoutes);
router.use('/rate-plans', ratePlanRoutes);
router.use('/meal-plans', mealPlanRoutes);
router.use('/pricing', pricingRoutes);
router.use('/documents', documentRoutes);
router.use('/communication', communicationRoutes);
router.use('/channel-manager', channelManagerRoutes);
router.use('/employee-portal', employeePortalRoutes);
router.use('/guest-portal', guestPortalRoutes);
router.use('/corporate', corporateRoutes);
router.use('/staff', staffRoutes);
router.use('/staff-performance', staffPerformanceRoutes);
router.use('/staff-audit', staffAuditRoutes);
// storekeeping-enhanced sub-router (bar-stocktake, kitchen-stocktake, store-stocktake, spoilage, etc.)
// Also mounted directly under /storekeeping so the mobile app can reach these routes
// at both /api/storekeeping/bar-stocktake and /api/storekeeping-enhanced/bar-stocktake.
router.use('/storekeeping-enhanced', storekeepingEnhancedRoutes);
router.use('/storekeeping', storekeepingEnhancedRoutes);
router.use('/store', storekeepingEnhancedRoutes);
router.use('/cashier', cashierRoutes);
router.use('/cashier', cashierExpensesRoutes);
router.use('/cashier/expenses', cashierExpensesRoutes);
router.use('/cashier-expenses', cashierExpensesRoutes);
router.use('/cashier', cashierClearanceRoutes);
router.use('/cashier-clearance', cashierClearanceRoutes);
// outlet-pos routes accessible as both /outlet-pos (legacy) and /pos (mobile app expects /pos/outlets)
router.use('/outlet-pos', outletPosRoutes);
router.use('/pos', outletPosRoutes);
router.use('/profit-loss', profitLossRoutes);
router.use('/wastage', wastageRoutes);
router.use('/kitchen-ledger', kitchenLedgerRoutes);
router.use('/additional-services', additionalServicesRoutes);
router.use('/auditor-reports', auditorReportsRoutes);
router.use('/conference', conferenceRoutes);
router.use('/catering', cateringRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/petty-cash', pettyCashRoutes);
router.use('/credit', creditRoutes);
router.use('/kitchen', kitchenRoutes);
// kitchen-shift routes accessible as both /kitchen-shift (legacy) and /kitchen/shifts (mobile app)
router.use('/kitchen-shift', kitchenShiftRoutes);
router.use('/kitchen/shifts', kitchenShiftRoutes);
router.use('/payroll', payrollRoutes);
router.use('/payroll-simple', payrollSimpleRoutes);
router.use('/procurement', procurementRoutes);
router.use('/hr-reports', hrReportRoutes);
router.use('/stock-take', stockTakeRoutes);
router.use('/stock-takes', stockTakeRoutes);
router.use('/verify', verifyRoutes);
router.use('/auditor-void-bills', auditorVoidBillsRoutes);
router.use('/kyogong', kyogongRoutes);
router.use('/banking', bankingRoutes);
router.use('/suppliers', suppliersRoutes);
router.use('/shifts', shiftsRoutes);
router.use('/payroll-enhanced', payrollEnhancedRoutes);
router.use('/catering-bookings', cateringBookingsRoutes);
router.use('/payroll-adjustments', payrollAdjustmentsRoutes);
router.use('/payroll-statutory', statutoryDeductionsRoutes);
router.use('/performance', performanceRoutes);
router.use('/payments-verification', paymentsRoutes);
router.use('/payroll-policies', payrollPoliciesRoutes);
router.use('/admin-logs', adminLogsRoutes);
router.use('/admin-ai', adminAiRoutes);
router.use('/search', searchRoutes);
router.use('/analytics', branchAnalyticsRoutes);
router.use('/dispatch', dispatchRoutes);
router.use('/security', securityRoutes);
router.use('/superadmin', superadminRoutes);
router.use('/lina', linaRoutes);
router.use('/document-templates', documentTemplateRoutes);
router.use('/menu-pricing', menuPricingRoutes);
router.use('/branch-search', branchSearchRoutes);
router.use('/branch-payments', branchPaymentRoutes);
router.use('/powersync', powerSyncRoutes);
router.use('/branches', branchHealthRoutes);
router.use('/branch-features', branchFeaturesRoutes);
router.use('/room-charge', roomChargeRoutes);
router.use('/payments-collection', paymentCollectionRoutes);

// Email booking endpoints (public - no auth required)
router.post('/email/send-booking/:bookingId', sendBookingEmail);
router.post('/email/send-all-bookings', sendAllConfirmedBookingEmails);
router.get('/email/test-connection', testEmailService);
router.post('/email/send-cancellation/:bookingId', sendCancellationEmail);
router.post('/email/send-receipt/:bookingId', sendPaymentReceiptEmail);
router.post('/email/send-invoice/:bookingId', sendInvoiceEmail);
router.post('/email/send-checkin-reminder/:bookingId', sendCheckInReminderEmail);
router.post('/email/send-checkout-reminder/:bookingId', sendCheckOutReminderEmail);

// Legacy M-Pesa Route Fix
import { initiateMpesaPayment, mpesaCallback } from '../controllers/payment.controller';
import { protect } from '../middleware/auth.middleware';
router.post('/mpesa/initiate', protect, initiateMpesaPayment);
router.post('/mpesa/callback', mpesaCallback);

export default router;
