import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  getShiftTemplates,
  createShiftTemplate,
  updateShiftTemplate,
  deleteShiftTemplate,
  getStaffShifts,
  createStaffShift,
  bulkCreateStaffShifts,
  updateStaffShift,
  checkInShift,
  checkOutShift,
  deleteStaffShift,
  getShiftSwaps,
  createShiftSwap,
  updateShiftSwapStatus,
  getShiftStatistics
} from '../controllers/shifts.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Shift templates routes
router.get('/templates', authorize('branch_manager', 'super_admin', 'hr_manager'), getShiftTemplates);
router.post('/templates', authorize('branch_manager', 'super_admin'), createShiftTemplate);
router.put('/templates/:id', authorize('branch_manager', 'super_admin'), updateShiftTemplate);
router.delete('/templates/:id', authorize('branch_manager', 'super_admin'), deleteShiftTemplate);

// Staff shifts routes
router.get('/', authorize('branch_manager', 'super_admin', 'hr_manager'), getStaffShifts);
router.post('/', authorize('branch_manager', 'super_admin'), createStaffShift);
router.post('/bulk', authorize('branch_manager', 'super_admin'), bulkCreateStaffShifts);
router.put('/:id', authorize('branch_manager', 'super_admin'), updateStaffShift);
router.post('/:id/check-in', checkInShift);
router.post('/:id/check-out', checkOutShift);
router.delete('/:id', authorize('branch_manager', 'super_admin'), deleteStaffShift);

// Shift swaps routes
router.get('/swaps', authorize('branch_manager', 'super_admin', 'hr_manager'), getShiftSwaps);
router.post('/swaps', createShiftSwap);
router.put('/swaps/:id/status', authorize('branch_manager', 'super_admin'), updateShiftSwapStatus);

// Statistics
router.get('/statistics', authorize('branch_manager', 'super_admin', 'hr_manager'), getShiftStatistics);

export default router;
