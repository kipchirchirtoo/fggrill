import express from 'express';
import {
  getVehicles,
  getVehicle,
  createVehicle,
  assignVehicle
} from '../controllers/fleet.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// =====================================================
// VEHICLES ROUTES
// =====================================================

router.route('/vehicles')
  .get(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]), getVehicles)
  .post(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), createVehicle);

router.get('/vehicles/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]),
  getVehicle
);

// =====================================================
// VEHICLE ASSIGNMENTS ROUTES
// =====================================================

router.post('/assignments',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  assignVehicle
);

export default router;
