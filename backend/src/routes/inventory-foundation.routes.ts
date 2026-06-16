import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import {
  getAlerts,
  getBalances,
  getLocations,
  getMovements,
  getReservations,
  postMovement,
  postReservation,
  recomputeBalances,
  releaseReservation
} from '../controllers/inventory-foundation.controller';
import {
  closeOutletStockVariance,
  createAdjustmentRequest,
  createProductionRun,
  getAdjustmentRequests,
  getOutletStock,
  postAdjustmentRequest,
  reviewAdjustmentRequest
} from '../controllers/inventory-operations.controller';

const router = express.Router();

const inventoryRoles = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.GENERAL_MANAGER,
  UserRole.CENTRAL_STOREKEEPER,
  UserRole.BRANCH_STOREKEEPER,
  UserRole.BRANCH_MANAGER,
  UserRole.BRANCH_ACCOUNTANT,
  UserRole.AUDITOR,
  UserRole.PROCUREMENT,
  UserRole.PURCHASING_MANAGER,
  UserRole.STOREKEEPER,
  UserRole.KITCHEN_OPERATIONS,
  UserRole.RESTAURANT_MANAGER
];

router.use(protect);
router.use(authorize(inventoryRoles));

router.get('/locations', getLocations);
router.get('/balances', getBalances);
router.get('/movements', getMovements);
router.get('/reservations', getReservations);
router.get('/alerts', getAlerts);

router.post('/movements', postMovement);
router.post('/reservations', postReservation);
router.post('/reservations/:id/release', releaseReservation);
router.post('/balances/recompute', recomputeBalances);

router.get('/outlet-stock', getOutletStock);
router.post('/production-runs', createProductionRun);
router.post('/outlet-shifts/:shiftId/close-variance', closeOutletStockVariance);
router.get('/stock-adjustments', getAdjustmentRequests);
router.post('/stock-adjustments', createAdjustmentRequest);
router.post('/stock-adjustments/:id/review', reviewAdjustmentRequest);
router.post('/stock-adjustments/:id/post', postAdjustmentRequest);

export default router;
