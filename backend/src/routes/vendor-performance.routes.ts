import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { logger } from '../utils/logger';
import vendorPerformanceService from '../services/vendor-performance.service';

const router = express.Router();

/**
 * @route   GET /api/vendors/performance
 * @desc    Get all vendor performance data
 * @access  Restricted
 */
router.get(
  '/performance',
  protect,
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.CENTRAL_STOREKEEPER
  ]),
  async (req, res) => {
    try {
      const vendorPerformance = await vendorPerformanceService.getAllVendorPerformance();
      res.json(vendorPerformance);
    } catch (error) {
      logger.error('Error fetching vendor performance:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching vendor performance data'
      });
    }
  }
);

/**
 * @route   GET /api/vendors/performance/:id
 * @desc    Get detailed performance for a specific vendor
 * @access  Restricted
 */
router.get(
  '/performance/:id',
  protect,
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.CENTRAL_STOREKEEPER
  ]),
  async (req, res) => {
    try {
      const vendorId = parseInt(req.params.id);

      if (isNaN(vendorId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid vendor ID'
        });
      }

      const vendorDetails = await vendorPerformanceService.getVendorPerformanceDetails(vendorId);
      res.json(vendorDetails);
    } catch (error) {
      logger.error('Error fetching vendor details:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching vendor performance details'
      });
    }
  }
);

/**
 * @route   POST /api/vendors/deliveries
 * @desc    Record a new vendor delivery
 * @access  Restricted
 */
router.post(
  '/deliveries',
  protect,
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.CENTRAL_STOREKEEPER
  ]),
  async (req, res) => {
    try {
      const delivery = req.body;

      if (!delivery.vendor_id || !delivery.purchase_order_id || !delivery.delivery_date) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      const result = await vendorPerformanceService.recordDelivery(delivery);
      res.json(result);
    } catch (error) {
      logger.error('Error recording delivery:', error);
      res.status(500).json({
        success: false,
        message: 'Error recording vendor delivery'
      });
    }
  }
);

/**
 * @route   POST /api/vendors/ratings
 * @desc    Submit a rating for a vendor
 * @access  Restricted
 */
router.post(
  '/ratings',
  protect,
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.CENTRAL_STOREKEEPER
  ]),
  async (req, res) => {
    try {
      const rating = {
        ...req.body,
        created_by: req.user.id
      };

      if (!rating.vendor_id || !rating.category || !rating.score) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      const result = await vendorPerformanceService.submitRating(rating);
      res.json(result);
    } catch (error) {
      logger.error('Error submitting rating:', error);
      res.status(500).json({
        success: false,
        message: 'Error submitting vendor rating'
      });
    }
  }
);

/**
 * @route   GET /api/vendors/rankings
 * @desc    Get vendor rankings and comparison
 * @access  Restricted
 */
router.get(
  '/rankings',
  protect,
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.GENERAL_MANAGER
  ]),
  async (req, res) => {
    try {
      const { category } = req.query;

      const rankings = await vendorPerformanceService.getVendorRankings(
        category ? String(category) : undefined
      );

      res.json(rankings);
    } catch (error) {
      logger.error('Error generating vendor rankings:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating vendor rankings'
      });
    }
  }
);

/**
 * @route   GET /api/vendors/report
 * @desc    Generate vendor performance report
 * @access  Restricted
 */
router.get(
  '/report',
  protect,
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.GENERAL_MANAGER
  ]),
  async (req, res) => {
    try {
      const { vendor_id, category } = req.query;

      const report = await vendorPerformanceService.generatePerformanceReport(
        vendor_id ? Number(vendor_id) : undefined,
        category ? String(category) : undefined
      );

      res.json(report);
    } catch (error) {
      logger.error('Error generating vendor performance report:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating vendor performance report'
      });
    }
  }
);

export default router;
