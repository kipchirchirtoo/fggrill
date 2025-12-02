import express from 'express';
import {
  getStaff,
  getStaffMember,
  createStaffMember,
  updateStaffMember,
  getRoles,
  createStaffSchedule,
  processPayroll,
  submitPerformanceReview,
  getAttendance,
  recordAttendance,
  getAttendanceSummary,
  getLeaveRequests,
  createLeaveRequest,
  updateLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest
} from '../controllers/staff.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Public reference data (no authentication needed)
router.get('/roles', getRoles);

// Protected routes
router.use(protect);

// Admin and Manager routes
router.get('/',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]),
  getStaff
);

router.post('/',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  createStaffMember
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

// Leave management routes
router.route('/leave')
  .get(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), getLeaveRequests)
  .post(protect, createLeaveRequest);

router.put('/leave/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  updateLeaveRequest
);

router.put('/leave/:id/approve',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  approveLeaveRequest
);

router.put('/leave/:id/reject',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  rejectLeaveRequest
);

export default router;
