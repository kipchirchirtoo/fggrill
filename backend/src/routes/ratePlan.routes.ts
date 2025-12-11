import express from 'express';
import {
  getRatePlans,
  getRatePlan,
  createRatePlan,
  updateRatePlan,
  deleteRatePlan
} from '../controllers/ratePlan.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// All routes are protected
router.use(protect);

router.get('/', getRatePlans);
router.get('/:id', getRatePlan);

// Admin only routes
router.post('/',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  createRatePlan
);

router.put('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  updateRatePlan
);

router.delete('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  deleteRatePlan
);

export default router;
