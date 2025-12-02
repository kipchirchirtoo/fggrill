import express from 'express';
import {
  getBranches,
  createBranch,
  getDepartments,
  createDepartment,
  getRoles,
  getRolePermissions
} from '../controllers/system.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Public reference data (no authentication needed)
router.get('/branches', getBranches);

// Apply authentication to all other routes
router.use(protect);

// =====================================================
// BRANCHES ROUTES (Protected)
// =====================================================

router.route('/branches')
  .post(authorize([UserRole.SUPER_ADMIN]), createBranch);

// =====================================================
// DEPARTMENTS ROUTES
// =====================================================

router.route('/departments')
  .get(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), getDepartments)
  .post(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), createDepartment);

// =====================================================
// ROLES & PERMISSIONS ROUTES
// =====================================================

router.get('/roles',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  getRoles
);

router.get('/roles/:id/permissions',
  authorize([UserRole.SUPER_ADMIN]),
  getRolePermissions
);

export default router;
