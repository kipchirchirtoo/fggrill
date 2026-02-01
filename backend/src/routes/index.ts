import express from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import bookingRoutes from './booking.routes';
import roomRoutes from './room.routes';
import inventoryRoutes from './inventory.routes';
import housekeepingRoutes from './housekeeping.routes';
import maintenanceRoutes from './maintenance.routes';
import reportRoutes from './report.routes';
import storekeepingRoutes from './storekeeping.routes';
import financeRoutes from './finance.routes';
import systemRoutes from './system.routes';
import fleetRoutes from './fleet.routes';
import barRoutes from './bar.routes';
import barStockRequestsRoutes from './bar-stock-requests.routes';
import restaurantRoutes from './restaurant.routes';
import restaurantReservationRoutes from './restaurant.reservation.routes';
import restaurantTableRoutes from './restaurant.table.routes';
import emailRoutes from './email.routes';
import paymentRoutes from './payment.routes';
import barcodeRoutes from './barcode.routes';
import { sendBookingEmail, sendAllConfirmedBookingEmails, testEmailService } from '../controllers/email-booking.controller';
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
import pricingRoutes from './pricing.routes';
import documentRoutes from './document.routes';
import communicationRoutes from './communication.routes';
import channelManagerRoutes from './channelManager.routes';
import employeePortalRoutes from './employee-portal.routes';
import guestPortalRoutes from './guest-portal.routes';
import staffRoutes from './staff.routes';
import storekeepingEnhancedRoutes from './storekeeping';
import cashierRoutes from './cashier.routes';
import wastageRoutes from './wastage.routes';
import kitchenLedgerRoutes from './kitchen-ledger.routes';
import additionalServicesRoutes from './additional-services.routes';
import auditorReportsRoutes from './auditor-reports.routes';
import conferenceRoutes from './conference.routes';
import cateringRoutes from './catering.routes';
import attendanceRoutes from './attendance.routes';
import pettyCashRoutes from './petty-cash.routes';
import creditRoutes from './credit.routes';
import kitchenRoutes from './kitchen.routes';
import payrollRoutes from './payroll.routes';
import procurementRoutes from './procurement.routes';

console.log('Index routes: importing staffRoutes', staffRoutes);

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime()
  });
});

// API routes
router.use('/staff', staffRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/bookings', bookingRoutes);
router.use('/rate-plans', ratePlanRoutes);
router.use('/pricing', pricingRoutes);
router.use('/documents', documentRoutes);
router.use('/rooms', roomRoutes);
router.use('/guests', guestRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/housekeeping', housekeepingRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/reports', reportRoutes);
router.use('/store', storekeepingRoutes);
router.use('/finance', financeRoutes);
router.use('/system', systemRoutes);
router.use('/fleet', fleetRoutes);
router.use('/bar', barRoutes);
router.use('/bar/stock-requests', barStockRequestsRoutes);
router.use('/restaurant', restaurantRoutes);
router.use('/restaurant/reservations', restaurantReservationRoutes);
router.use('/restaurant/tables', restaurantTableRoutes);
router.use('/payments', paymentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/folios', folioRoutes);
router.use('/audit', auditRoutes);
router.use('/maintenance-enhanced', maintenanceEnhancedRoutes);
router.use('/auditor', auditorRoutes);
router.use('/accounting', accountingRoutes);
router.use('/receipts', receiptsRoutes);
router.use('/branch-operations', branchOperationsRoutes);
router.use('/automation', automationRoutes);
router.use('/forecasting', mlForecastingRoutes);
router.use('/vendors', vendorPerformanceRoutes);
router.use('/facilities', facilitiesRoutes);
router.use('/admin', adminRoutes);
router.use('/communications', communicationRoutes);
router.use('/channel-manager', channelManagerRoutes);
router.use('/employee-portal', employeePortalRoutes);
router.use('/guest-portal', guestPortalRoutes);
router.use('/payroll', payrollRoutes);
// router.use('/staff', staffRoutes); // Removed duplicate
router.use('/email', emailRoutes);
router.use('/barcode', barcodeRoutes);
router.use('/storekeeping', storekeepingEnhancedRoutes);
router.use('/cashier', cashierRoutes);
router.use('/wastage', wastageRoutes);
router.use('/kitchen', kitchenLedgerRoutes);
router.use('/additional-services', additionalServicesRoutes);
router.use('/reports/auditor', auditorReportsRoutes);
router.use('/conference', conferenceRoutes);
router.use('/catering', cateringRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/petty-cash', pettyCashRoutes);
router.use('/credit', creditRoutes);
router.use('/kitchen', kitchenRoutes);
router.use('/procurement', procurementRoutes);

// Email booking endpoints (public - no auth required)
router.post('/email/send-booking/:bookingId', sendBookingEmail);
router.post('/email/send-all-bookings', sendAllConfirmedBookingEmails);
router.get('/email/test-connection', testEmailService);

// Legacy M-Pesa Route Fix (for cached clients calling /api/mpesa/initiate)
import { initiateMpesaPayment, mpesaCallback } from '../controllers/payment.controller';
import { protect } from '../middleware/auth.middleware';
router.post('/mpesa/initiate', protect, initiateMpesaPayment);
router.post('/mpesa/callback', mpesaCallback);

export default router;

