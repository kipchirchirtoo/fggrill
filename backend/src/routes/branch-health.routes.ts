import { Router } from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import { healthRefreshLimiter, healthRefreshLimiterIfForced } from '../middleware/rateLimiter';
import {
  getBranchHealthCheck,
  getFleetHealthCheck,
  refreshBranchHealthCheck,
} from '../controllers/branch-health.controller';

const router = Router();
router.use(protect);

// Staff who manage/oversee branch food-control setup.
const HEALTH_CHECK_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.BRANCH_ACCOUNTANT,
  UserRole.ACCOUNTANT,
  UserRole.FINANCE_MANAGER,
  UserRole.AUDITOR,
];
router.use(authorize(HEALTH_CHECK_ROLES));

// Fleet overview must be registered before the :branchId routes so "fleet"
// is not captured as a branch id. Deterministic only — no AI call, no limiter.
router.get('/fleet/health-check', getFleetHealthCheck);
// GET with ?force_refresh=true triggers an AI call, so it shares the same
// per-branch rate limit as the explicit refresh endpoint.
router.get('/:branchId/health-check', healthRefreshLimiterIfForced, getBranchHealthCheck);
router.post('/:branchId/health-check/refresh', healthRefreshLimiter, refreshBranchHealthCheck);

export default router;
