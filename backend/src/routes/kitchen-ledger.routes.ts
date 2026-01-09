import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import {
  getLedgerEntries,
  createLedgerEntry,
  updateLedgerEntry,
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
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN, UserRole.POS_KITCHEN]),
    getLedgerEntries
  )
  .post(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN]),
    createLedgerEntry
  );

router.route('/ledger/:id')
  .patch(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN]),
    updateLedgerEntry
  );

// Kitchen Store Receipts
router.route('/receipts')
  .get(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN, UserRole.BRANCH_STOREKEEPER, UserRole.CENTRAL_STOREKEEPER]),
    getStoreReceipts
  )
  .post(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN]),
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
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN]),
    getPortionTracking
  )
  .post(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN]),
    createPortionTracking
  );

router.route('/portion-tracking/:id')
  .patch(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN]),
    updatePortionTracking
  );

// Variance Logs
router.route('/variance-logs')
  .get(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN, UserRole.AUDITOR]),
    getVarianceLogs
  )
  .post(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN]),
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
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.KITCHEN]),
    getKitchenStats
  );

export default router;
