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
  rejectLeaveRequest,
  updateAttendance,
  approveAttendance,
  getAttendanceReports,
  uploadStaffPhoto,
  batchConfirmAttendance,
  batchLockLeave,
  archiveStaff,
  getStaffHistory,
  uploadStaffDocument,
  getStaffDocuments,
  getStaffByIdentifier
} from '../controllers/staff.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import multer from 'multer';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Public reference data (no authentication needed)
router.get('/roles', getRoles);

// Staff lookup by identifier (must come before parameterized routes)
router.get('/by-identifier/:identifier', getStaffByIdentifier);

// Public attendance routes
router.post('/attendance/clock-in', clockIn);
router.post('/attendance/clock-out', clockOut);

// Protected routes
router.use(protect);

// Admin, Manager, Restaurant staff, and POS Kitchen routes (POS needs to access waiters for order assignment)
router.get('/',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT, UserRole.POS_KITCHEN, UserRole.KITCHEN, UserRole.HR_MANAGER]),
  getStaff
);

router.post('/',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]),
  createStaffMember
);

// Specific paths MUST come before parameterized routes like /:id
router.post('/schedule',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]),
  createStaffSchedule
);

router.post('/performance',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]),
  submitPerformanceReview
);

// Admin, Manager, and Accountant routes
router.post('/payroll',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.HR_MANAGER]),
  processPayroll
);

// Attendance routes
router.get('/attendance',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]),
  getAttendance
);

router.get('/attendance/summary',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]),
  getAttendanceSummary
);

router.post('/attendance/confirm',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]),
  batchConfirmAttendance
);

router.put('/attendance/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]),
  updateAttendance
);

router.put('/attendance/:id/approve',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]),
  approveAttendance
);

// Leave management routes
router.route('/leave')
  .get(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]), getLeaveRequests)
  .post(protect, createLeaveRequest);

router.post('/leave/lock',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]),
  batchLockLeave
);

router.get('/attendance/reports',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]),
  getAttendanceReports
);

// Photo upload route (must come before /:id)
router.post('/:id/photo',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]),
  upload.single('photo'),
  uploadStaffPhoto
);

// Parameterized routes
router.get('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]),
  getStaffMember
);

router.put('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER]),
  updateStaffMember
);

router.post('/:id/archive',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]),
  archiveStaff
);

router.get('/:id/history',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]),
  getStaffHistory
);

router.post('/:id/documents',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]),
  upload.single('document'),
  uploadStaffDocument
);

router.get('/:id/documents',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]),
  getStaffDocuments
);

router.put('/leave/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]),
  updateLeaveRequest
);

router.put('/leave/:id/approve',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]),
  approveLeaveRequest
);

router.put('/leave/:id/reject',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]),
  rejectLeaveRequest
);

export default router;
