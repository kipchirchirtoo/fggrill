// Branch Analytics Routes
// Defines all routes for branch manager analytics dashboard

import { Router } from 'express';
import {
  getBranchSales,
  getBranchSalesSummary,
  exportBranchSalesPDF,
  exportBranchSalesCSV
} from '../controllers/branch-analytics.controller';
import { protect, authorize, UserRole } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(protect);

/**
 * @route   POST /api/analytics/branch-sales
 * @desc    Get comprehensive branch sales analytics
 * @access  Protected (branch_manager, general_manager, super_admin)
 */
router.post(
  '/branch-sales',
  authorize([UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]),
  getBranchSales
);

/**
 * @route   GET /api/analytics/branch-sales/summary
 * @desc    Get quick sales summary metrics
 * @access  Protected (branch_manager, general_manager, super_admin)
 * @query   branch_id (required), period (optional: daily, weekly, monthly, yearly)
 */
router.get(
  '/branch-sales/summary',
  authorize([UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]),
  getBranchSalesSummary
);

/**
 * @route   POST /api/analytics/branch-sales/export/pdf
 * @desc    Export branch sales report as PDF
 * @access  Protected (branch_manager, general_manager, super_admin)
 */
router.post(
  '/branch-sales/export/pdf',
  authorize([UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]),
  exportBranchSalesPDF
);

/**
 * @route   POST /api/analytics/branch-sales/export/csv
 * @desc    Export branch sales report as CSV
 * @access  Protected (branch_manager, general_manager, super_admin)
 */
router.post(
  '/branch-sales/export/csv',
  authorize([UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]),
  exportBranchSalesCSV
);

export default router;
