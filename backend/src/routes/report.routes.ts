import express from 'express';
import {
  getReports,
  getReport,
  createReport,
  updateReport,
  deleteReport,
  generateReport,
  scheduleReport,
  sendReport,
  getReportTemplates,
  createReportTemplate,
  updateReportTemplate,
  deleteReportTemplate,
  getReportHistory,
  getReportStats,
  getRevenueReport,
  getOccupancyReport,
  getHousekeepingReport,
  getMaintenanceReport,
  getInventoryReport,
  getDashboardReport,
  getConferenceReport,
  exportReport,
  generateAsyncReport,
  getReportJobStatus
} from '../controllers/report.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Public export for testing (TODO: Re-enable protect)
router.post('/export', exportReport);
router.post('/generate/async', generateAsyncReport);
router.get('/jobs/:id/status', getReportJobStatus);

// Apply protection to all routes
router.use(protect);

// Admin and Manager routes
router.use(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]));

// Dashboard & Analytics
router.get('/dashboard', getDashboardReport);
router.get('/revenue', getRevenueReport);
router.get('/occupancy', getOccupancyReport);
router.get('/inventory', getInventoryReport);
router.get('/housekeeping', getHousekeepingReport);
router.get('/maintenance', getMaintenanceReport);
router.get('/conference', getConferenceReport);

router.route('/')
  .get(getReports)
  .post(createReport);

// Report Templates must be registered before /:id so "templates" is not
// captured as a report id.
router.route('/templates')
  .get(getReportTemplates)
  .post(createReportTemplate);

router.route('/templates/:id')
  .put(updateReportTemplate)
  .delete(deleteReportTemplate);

// Statistics must also stay before /:id.
router.get('/stats/overview', getReportStats);

router.route('/:id')
  .get(getReport)
  .put(updateReport)
  .delete(deleteReport);

router.post('/:id/generate', generateReport);
router.post('/:id/schedule', scheduleReport);
router.post('/:id/send', sendReport);

router.get('/:id/history', getReportHistory);

export default router;
