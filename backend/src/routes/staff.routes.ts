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
  clockIn,
  clockOut,
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

// Admin, Manager, Restaurant staff, and POS Kitchen routes (POS needs to access waiters for order assignment)
router.get('/',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT, UserRole.POS_KITCHEN, UserRole.KITCHEN]),
  getStaff
);

router.post('/',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]),
  createStaffMember
);

// Specific paths MUST come before parameterized routes like /:id
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
router.get('/attendance',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]),
  getAttendance
);

router.post('/attendance/clock-in',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]),
  clockIn
);

router.post('/attendance/clock-out',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]),
  clockOut
);

router.get('/attendance/summary',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]),
  getAttendanceSummary
);

// Leave management routes
router.route('/leave')
  .get(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), getLeaveRequests)
  .post(protect, createLeaveRequest);

// Parameterized routes
router.get('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]),
  getStaffMember
);

router.put('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]),
  updateStaffMember
);

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
