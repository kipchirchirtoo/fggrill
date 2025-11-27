import express from 'express';
import {
  getStaff,
  getStaffMember,
  updateStaffMember,
  createStaffSchedule,
  processPayroll,
  submitPerformanceReview,
  getAttendance,
  recordAttendance,
  getAttendanceSummary
} from '../controllers/staff.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Protected routes
router.use(protect);

// Admin and Manager routes
router.get('/',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]),
  getStaff
);

router.get('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]),
  getStaffMember
);

router.put('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  updateStaffMember
);

router.post('/schedule',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]),
  createStaffSchedule
);

router.post('/performance',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]),
  submitPerformanceReview
);

// Admin, Manager, and Accountant routes
router.post('/payroll',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  processPayroll
);

// Attendance routes
router.route('/attendance')
  .get(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), getAttendance)
  .post(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]), recordAttendance);

router.get('/attendance/summary',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  getAttendanceSummary
);

export default router;
