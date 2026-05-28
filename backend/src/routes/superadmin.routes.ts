import express from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import * as ctrl from '../controllers/superadmin.controller';

const router = express.Router();
router.use(protect);
router.use(authorize([UserRole.SUPER_ADMIN]));

// Feature Flags
router.get('/feature-flags', ctrl.getFeatureFlags);
router.post('/feature-flags', ctrl.createFeatureFlag);
router.put('/feature-flags/:id', ctrl.updateFeatureFlag);
router.delete('/feature-flags/:id', ctrl.deleteFeatureFlag);

// Announcements
router.get('/announcements', ctrl.getAnnouncements);
router.post('/announcements', ctrl.createAnnouncement);
router.delete('/announcements/:id', ctrl.deleteAnnouncement);

// Security Config (god-mode version with history)
router.get('/config/security', ctrl.getSecurityConfig);
router.put('/config/security', ctrl.updateSecurityConfig);

// Backup
router.post('/backup/trigger', ctrl.triggerBackup);
router.get('/backup/history', ctrl.getBackupHistory);

// Impersonation
router.post('/impersonate/:userId', ctrl.startImpersonation);
router.delete('/impersonate/:sessionId', ctrl.endImpersonation);

// Audit log
router.get('/audit-log', ctrl.getSuperadminAuditLog);

// Emergency
router.post('/emergency/maintenance-mode', ctrl.toggleMaintenanceMode);
router.post('/emergency/force-logout-all', ctrl.forceLogoutAll);
router.post('/emergency/force-logout-user/:userId', ctrl.forceLogoutUser);
router.post('/emergency/lockdown-branch/:branchId', ctrl.lockdownBranch);

// Data Overrides
router.post('/override/approval/:id/force-approve', ctrl.forceApproveRecord);
router.post('/override/user/:id/unlock', ctrl.unlockUserAccount);

// SSE Stream (protect only — authorize not applied since it's long-lived)
router.get('/stream', ctrl.getSystemStream);

export default router;
