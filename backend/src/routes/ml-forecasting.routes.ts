import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { logger } from '../utils/logger';
import mlForecastingService from '../services/ml-forecasting.service';

const router = express.Router();

/**
 * @route   GET /api/forecasting/sales
 * @desc    Get sales forecast
 * @access  Restricted
 */
router.get(
  '/sales',
  protect,
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.CENTRAL_OPERATIONS_MANAGER,
    UserRole.FINANCE_MANAGER
  ]),
  async (req, res) => {
    try {
      const { branch_id, days } = req.query;
      
      const forecast = await mlForecastingService.generateSalesForecast(
        branch_id ? Number(branch_id) : undefined,
        days ? Number(days) : 30
      );
      
      res.json(forecast);
    } catch (error) {
      logger.error('Error generating sales forecast:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating sales forecast'
      });
    }
  }
);

/**
 * @route   GET /api/forecasting/inventory
 * @desc    Get inventory demand forecast
 * @access  Restricted
 */
router.get(
  '/inventory',
  protect,
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.CENTRAL_OPERATIONS_MANAGER,
    UserRole.CENTRAL_STOREKEEPER
  ]),
  async (req, res) => {
    try {
      const { category_id, days } = req.query;
      
      const forecast = await mlForecastingService.generateInventoryDemandForecast(
        category_id ? Number(category_id) : undefined,
        days ? Number(days) : 30
      );
      
      res.json(forecast);
    } catch (error) {
      logger.error('Error generating inventory forecast:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating inventory forecast'
      });
    }
  }
);

/**
 * @route   GET /api/forecasting/occupancy
 * @desc    Get occupancy forecast
 * @access  Restricted
 */
router.get(
  '/occupancy',
  protect,
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.CENTRAL_OPERATIONS_MANAGER,
    UserRole.BRANCH_MANAGER
  ]),
  async (req, res) => {
    try {
      const { branch_id, days } = req.query;
      
      const forecast = await mlForecastingService.generateOccupancyForecast(
        branch_id ? Number(branch_id) : undefined,
        days ? Number(days) : 30
      );
      
      res.json(forecast);
    } catch (error) {
      logger.error('Error generating occupancy forecast:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating occupancy forecast'
      });
    }
  }
);

/**
 * @route   GET /api/forecasting/budget
 * @desc    Get budget forecast
 * @access  Restricted
 */
router.get(
  '/budget',
  protect,
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.CENTRAL_OPERATIONS_MANAGER,
    UserRole.FINANCE_MANAGER
  ]),
  async (req, res) => {
    try {
      const { department_id, months } = req.query;
      
      const forecast = await mlForecastingService.generateBudgetForecast(
        department_id ? Number(department_id) : undefined,
        months ? Number(months) : 3
      );
      
      res.json(forecast);
    } catch (error) {
      logger.error('Error generating budget forecast:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating budget forecast'
      });
    }
  }
);

export default router;
