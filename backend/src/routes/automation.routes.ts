import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import alertsService from '../services/alerts.service';
import schedulerService from '../services/scheduler.service';
import reportsService from '../services/reports.service';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * @route   GET /api/automation/status
 * @desc    Get status of the automation system
 * @access  Admin
 */
router.get(
  '/status',
  protect,
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  async (req, res) => {
    try {
      const activeJobs = schedulerService.getActiveJobs();

      res.json({
        success: true,
        data: {
          active: activeJobs.length > 0,
          jobs: activeJobs
        }
      });
    } catch (error) {
      logger.error('Error getting automation status:', error);
      res.status(500).json({ success: false, message: 'Error getting automation status' });
    }
  }
);

/**
 * @route   POST /api/automation/start
 * @desc    Start the automation system
 * @access  Admin
 */
router.post(
  '/start',
  protect,
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  async (req, res) => {
    try {
      const jobs = schedulerService.startAll();

      res.json({
        success: true,
        message: 'Automation system started',
        data: {
          jobs: Object.keys(jobs)
        }
      });
    } catch (error) {
      logger.error('Error starting automation:', error);
      res.status(500).json({ success: false, message: 'Error starting automation system' });
    }
  }
);

/**
 * @route   POST /api/automation/stop
 * @desc    Stop the automation system
 * @access  Admin
 */
router.post(
  '/stop',
  protect,
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  async (req, res) => {
    try {
      schedulerService.stopAll();

      res.json({
        success: true,
        message: 'Automation system stopped'
      });
    } catch (error) {
      logger.error('Error stopping automation:', error);
      res.status(500).json({ success: false, message: 'Error stopping automation system' });
    }
  }
);

/**
 * @route   POST /api/automation/run/low-stock-check
 * @desc    Run low stock check manually
 * @access  Admin
 */
router.post(
  '/run/low-stock-check',
  protect,
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER]),
  async (req, res) => {
    try {
      const alertCount = await alertsService.checkLowStock();

      res.json({
        success: true,
        message: `Low stock check completed, ${alertCount} alerts generated`,
        data: { alertCount }
      });
    } catch (error) {
      logger.error('Error running low stock check:', error);
      res.status(500).json({ success: false, message: 'Error running low stock check' });
    }
  }
);

/**
 * @route   POST /api/automation/run/compliance-check
 * @desc    Run compliance expiry check manually
 * @access  Admin
 */
router.post(
  '/run/compliance-check',
  protect,
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  async (req, res) => {
    try {
      const { days = 14 } = req.body;
      const alertCount = await alertsService.checkComplianceExpiry(days);

      res.json({
        success: true,
        message: `Compliance check completed, ${alertCount} alerts generated`,
        data: { alertCount, daysThreshold: days }
      });
    } catch (error) {
      logger.error('Error running compliance check:', error);
      res.status(500).json({ success: false, message: 'Error running compliance check' });
    }
  }
);

/**
 * @route   POST /api/automation/run/budget-check
 * @desc    Run budget variance check manually
 * @access  Admin
 */
router.post(
  '/run/budget-check',
  protect,
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  async (req, res) => {
    try {
      const { threshold = 10 } = req.body;
      const alertCount = await alertsService.checkBudgetVariances(threshold);

      res.json({
        success: true,
        message: `Budget variance check completed, ${alertCount} alerts generated`,
        data: { alertCount, threshold }
      });
    } catch (error) {
      logger.error('Error running budget variance check:', error);
      res.status(500).json({ success: false, message: 'Error running budget variance check' });
    }
  }
);

/**
 * @route   POST /api/automation/run/performance-check
 * @desc    Run performance metrics check manually
 * @access  Admin
 */
router.post(
  '/run/performance-check',
  protect,
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  async (req, res) => {
    try {
      const { threshold = 15 } = req.body;
      const alertCount = await alertsService.checkPerformanceMetrics(threshold);

      res.json({
        success: true,
        message: `Performance metrics check completed, ${alertCount} alerts generated`,
        data: { alertCount, threshold }
      });
    } catch (error) {
      logger.error('Error running performance metrics check:', error);
      res.status(500).json({ success: false, message: 'Error running performance metrics check' });
    }
  }
);

/**
 * @route   POST /api/automation/run/generate-reports
 * @desc    Generate scheduled reports manually
 * @access  Admin
 */
router.post(
  '/run/generate-reports',
  protect,
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  async (req, res) => {
    try {
      const { period = 'daily' } = req.body;
      const reportsCount = await reportsService.generateScheduledReports(period as any);

      res.json({
        success: true,
        message: `Report generation completed, ${reportsCount} reports generated`,
        data: { reportsCount, period }
      });
    } catch (error) {
      logger.error('Error generating reports:', error);
      res.status(500).json({ success: false, message: 'Error generating reports' });
    }
  }
);

export default router;
