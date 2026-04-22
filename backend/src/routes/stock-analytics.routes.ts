import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import {
    getConsumptionTrends,
    getReorderSuggestions,
    getStockMovement,
    getWastageAnalytics
} from '../controllers/stock-analytics.controller';

const router = express.Router();

// Define authorized roles - Branch Managers and management level access
const managerRoles = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.CENTRAL_STOREKEEPER,
  UserRole.BRANCH_STOREKEEPER,
  UserRole.BRANCH_MANAGER,
  UserRole.BRANCH_ACCOUNTANT,
  UserRole.AUDITOR
];

// All routes require authentication and specific roles
router.use(protect);
router.use(authorize(managerRoles));

// Get consumption trends
router.get('/consumption-trends', getConsumptionTrends);

// Get reorder suggestions
router.get('/reorder-suggestions', getReorderSuggestions);

// Get stock movement timeline
router.get('/stock-movement', getStockMovement);

// Get wastage analytics
router.get('/wastage-analytics', getWastageAnalytics);

export default router;
