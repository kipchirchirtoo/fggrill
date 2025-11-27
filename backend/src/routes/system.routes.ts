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

// Apply authentication to all routes
router.use(protect);

// =====================================================
// BRANCHES ROUTES
// =====================================================

router.route('/branches')
  .get(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]), getBranches)
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
