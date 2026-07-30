import express from 'express';
import {
  getBranches,
  getBranch,
  createBranch,
  updateBranch,
  deleteBranch,
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getRoles,
  getRolePermissions,
  getSystemUsers,
  getSystemStatus,
  getSystemStats,
  getSystemConfig,
  updateSystemConfig
} from '../controllers/system.controller';
import { protect, authorize } from '../middleware/auth';
import { withCache } from '../middleware/cacheMiddleware';
import { UserRole } from '../models/User';
import { CacheKeys, CACHE_TTL } from '../services/cacheService';

const router = express.Router();

// Public reference data (no authentication needed)
router.get('/branches', getBranches);

// Apply authentication to all other routes
router.use(protect);

// =====================================================
// SYSTEM HEALTH / STATUS
// =====================================================

router.get('/status',
  authorize([UserRole.SUPER_ADMIN]),
  getSystemStatus
);

router.get('/stats',
  authorize([UserRole.SUPER_ADMIN]),
  getSystemStats
);

router.route('/config')
  .get(
    authorize([UserRole.SUPER_ADMIN]),
    withCache(CacheKeys.systemConfig(), CACHE_TTL.BRANCH_SETTINGS),
    getSystemConfig
  )
  .put(authorize([UserRole.SUPER_ADMIN]), updateSystemConfig);

// =====================================================
// USERS (SYSTEM-WIDE)
// =====================================================

router.get('/users',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]),
  getSystemUsers
);

// =====================================================
// BRANCHES ROUTES (Protected)
// =====================================================

router.route('/branches')
  .post(authorize([UserRole.SUPER_ADMIN]), createBranch);

router.route('/branches/:id')
  .get(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), getBranch)
  .put(authorize([UserRole.SUPER_ADMIN]), updateBranch)
  .delete(authorize([UserRole.SUPER_ADMIN]), deleteBranch);

// =====================================================
// DEPARTMENTS ROUTES
// =====================================================

router.route('/departments')
  .get(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), getDepartments)
  .post(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), createDepartment);

router.route('/departments/:id')
  .get(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]), getDepartment)
  .put(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), updateDepartment)
  .delete(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), deleteDepartment);

// =====================================================
// ROLES & PERMISSIONS ROUTES
// =====================================================

router.get('/roles',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]),
  withCache('fg:system:roles', CACHE_TTL.PERMISSIONS),
  getRoles
);

router.get('/roles/:id/permissions',
  authorize([UserRole.SUPER_ADMIN]),
  withCache((req) => CacheKeys.rolePermissions(String(req.params.id || '').trim().toLowerCase()), CACHE_TTL.PERMISSIONS),
  getRolePermissions
);

export default router;
