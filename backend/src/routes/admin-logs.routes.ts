import { Router } from 'express';
import { 
    getLogsOverview, 
    getUnifiedLogs, 
    getSystemLogs 
} from '../controllers/admin-logs.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

// All routes require super_admin access
router.use(protect);
router.use(authorize([
    UserRole.SUPER_ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.GENERAL_MANAGER,
    UserRole.AUDITOR,
]));

/**
 * @desc Get summary statistics
 * @route GET /api/admin-logs/overview
 */
router.get('/overview', getLogsOverview);

/**
 * @desc Get normalized logs from any category (security, audit, finance, alerts)
 * @route GET /api/admin-logs
 */
router.get('/', getUnifiedLogs);

/**
 * @desc Read raw system log files
 * @route GET /api/admin-logs/system
 */
router.get('/system', getSystemLogs);

export default router;
