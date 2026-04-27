import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import * as securityController from '../controllers/security.controller';

const router = Router();

// All routes require super admin authentication
router.use(protect);
router.use(authorize(['super_admin']));

// Security configuration
router.get('/config', securityController.getSecurityConfig);
router.put('/config', securityController.updateSecurityConfig);

// RLS policies
router.get('/rls-policies', securityController.getRLSPolicies);

// API security metrics
router.get('/api-metrics', securityController.getAPISecurityMetrics);

// IP blocking
router.get('/blocked-ips', securityController.getBlockedIPs);
router.post('/block-ip', securityController.blockIP);
router.post('/unblock-ip', securityController.unblockIP);

// Session management
router.get('/active-sessions', securityController.getActiveSessions);
router.post('/terminate-session', securityController.terminateSession);
router.post('/terminate-all-sessions', securityController.terminateAllSessions);

export default router;
