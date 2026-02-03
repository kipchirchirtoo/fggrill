import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import {
  getLedgerEntries,
  createLedgerEntry,
  updateLedgerEntry,
  updateLedgerStatus,
  getStoreReceipts,
  createStoreReceipt,
  verifyStoreReceipt,
  getPortionTracking,
  createPortionTracking,
  updatePortionTracking,
  getVarianceLogs,
  createVarianceLog,
  approveVarianceLog,
  getKitchenStats
} from '../controllers/kitchen-ledger.controller';

const router = Router();

// All routes require authentication
router.use(protect);

// Kitchen Ledger Entries
router.route('/ledger')
  .get(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN, UserRole.POS_KITCHEN, UserRole.KITCHEN_OPERATIONS]),
    getLedgerEntries
  )
  .post(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN, UserRole.KITCHEN_OPERATIONS]),
    createLedgerEntry
  );

router.route('/ledger/:id')
  .patch(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN, UserRole.KITCHEN_OPERATIONS]),
    updateLedgerEntry
  );

router.route('/ledger/:id/status')
  .patch(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN, UserRole.KITCHEN_OPERATIONS]),
    updateLedgerStatus
  );

// Kitchen Store Receipts
router.route('/receipts')
  .get(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN, UserRole.BRANCH_STOREKEEPER, UserRole.CENTRAL_STOREKEEPER, UserRole.KITCHEN_OPERATIONS]),
    getStoreReceipts
  )
  .post(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN, UserRole.KITCHEN_OPERATIONS]),
    createStoreReceipt
  );

router.route('/receipts/:id/verify')
  .patch(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF]),
    verifyStoreReceipt
  );

// Portion Tracking
router.route('/portion-tracking')
  .get(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN, UserRole.KITCHEN_OPERATIONS]),
    getPortionTracking
  )
  .post(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN, UserRole.KITCHEN_OPERATIONS]),
    createPortionTracking
  );

router.route('/portion-tracking/:id')
  .patch(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN, UserRole.KITCHEN_OPERATIONS]),
    updatePortionTracking
  );

// Variance Logs
router.route('/variance-logs')
  .get(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN, UserRole.AUDITOR, UserRole.KITCHEN_OPERATIONS]),
    getVarianceLogs
  )
  .post(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN, UserRole.KITCHEN_OPERATIONS]),
    createVarianceLog
  );

router.route('/variance-logs/:id/approve')
  .patch(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF]),
    approveVarianceLog
  );

// Kitchen Dashboard Stats
router.route('/stats')
  .get(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN, UserRole.KITCHEN_OPERATIONS]),
    getKitchenStats
  );

export default router;
