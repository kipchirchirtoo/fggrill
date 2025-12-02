import express from 'express';
import {
  getTables,
  getTableById,
  createTable,
  updateTable,
  updateTableStatus,
  assignServer,
  getFloorPlan,
  updateFloorPlan,
  getTableStats
} from '../controllers/restaurant.table.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Public routes (for all restaurant staff)
router.get('/',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST]),
  getTables
);

router.get('/stats',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  getTableStats
);

router.get('/floor-plan',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  getFloorPlan
);

router.get('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  getTableById
);

// Status updates (restaurant staff can do this)
router.put('/:id/status',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  updateTableStatus
);

router.post('/:id/assign',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  assignServer
);

// Management routes (managers only)
router.post('/',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  createTable
);

router.put('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  updateTable
);

router.put('/floor-plan',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  updateFloorPlan
);

export default router;
