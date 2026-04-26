/**
 * Food Control Routes
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getShiftVarianceReport,
  computeShiftVariance,
  explainVarianceItem,
  flagVarianceItem,
  approveVariance,
  getPendingVariances,
  getShiftPortionOutput,
  getVarianceStats
} from '../controllers/foodControlVariance.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Variance reporting
router.get('/variance/shift/:shiftId', getShiftVarianceReport);
router.post('/variance/compute', computeShiftVariance);
router.get('/variance/pending', getPendingVariances);
router.get('/variance/stats', getVarianceStats);

// Variance actions
router.post('/variance/:id/explain', explainVarianceItem);
router.post('/variance/:id/flag', flagVarianceItem);
router.post('/variance/:id/approve', approveVariance);

// Portion output
router.get('/portion-output/shift/:shiftId', getShiftPortionOutput);

export default router;
