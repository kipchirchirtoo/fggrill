import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
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
    authorize(['super_admin', 'branch_manager', 'head_chef', 'sous_chef', 'kitchen', 'pos_kitchen']),
    getLedgerEntries
  )
  .post(
    authorize(['super_admin', 'branch_manager', 'head_chef', 'sous_chef', 'kitchen']),
    createLedgerEntry
  );

router.route('/ledger/:id')
  .patch(
    authorize(['super_admin', 'branch_manager', 'head_chef', 'sous_chef', 'kitchen']),
    updateLedgerEntry
  );

// Kitchen Store Receipts
router.route('/receipts')
  .get(
    authorize(['super_admin', 'branch_manager', 'head_chef', 'sous_chef', 'kitchen', 'branch_storekeeper', 'central_storekeeper']),
    getStoreReceipts
  )
  .post(
    authorize(['super_admin', 'branch_manager', 'head_chef', 'sous_chef', 'kitchen']),
    createStoreReceipt
  );

router.route('/receipts/:id/verify')
  .patch(
    authorize(['super_admin', 'branch_manager', 'head_chef']),
    verifyStoreReceipt
  );

// Portion Tracking
router.route('/portion-tracking')
  .get(
    authorize(['super_admin', 'branch_manager', 'head_chef', 'sous_chef', 'kitchen']),
    getPortionTracking
  )
  .post(
    authorize(['super_admin', 'branch_manager', 'head_chef', 'sous_chef', 'kitchen']),
    createPortionTracking
  );

router.route('/portion-tracking/:id')
  .patch(
    authorize(['super_admin', 'branch_manager', 'head_chef', 'sous_chef', 'kitchen']),
    updatePortionTracking
  );

// Variance Logs
router.route('/variance-logs')
  .get(
    authorize(['super_admin', 'branch_manager', 'head_chef', 'sous_chef', 'kitchen', 'auditor']),
    getVarianceLogs
  )
  .post(
    authorize(['super_admin', 'branch_manager', 'head_chef', 'sous_chef', 'kitchen']),
    createVarianceLog
  );

router.route('/variance-logs/:id/approve')
  .patch(
    authorize(['super_admin', 'branch_manager', 'head_chef']),
    approveVarianceLog
  );

// Kitchen Dashboard Stats
router.route('/stats')
  .get(
    authorize(['super_admin', 'branch_manager', 'head_chef', 'sous_chef', 'kitchen']),
    getKitchenStats
  );

export default router;
