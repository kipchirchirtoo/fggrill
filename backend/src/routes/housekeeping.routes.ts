import express from 'express';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  getRoomStatus,
  getStaffWorkload
} from '../controllers/housekeeping.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Protected routes
router.use(protect);

// Staff routes (Admin, Manager, Housekeeping)
router.get('/tasks',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOUSEKEEPING]),
  getTasks
);

router.get('/tasks/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOUSEKEEPING]),
  getTask
);

router.post('/tasks',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOUSEKEEPING]),
  createTask
);

router.put('/tasks/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOUSEKEEPING]),
  updateTask
);

router.get('/rooms/:id/status',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOUSEKEEPING]),
  getRoomStatus
);

// Admin and Manager routes
router.delete('/tasks/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  deleteTask
);

router.get('/staff/workload',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  getStaffWorkload
);

export default router;
