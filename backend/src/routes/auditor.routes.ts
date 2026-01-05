import express from 'express';
import {
  startNightAudit,
  completeNightAudit,
  getNightAudits,
  createException,
  resolveException,
  getExceptions,
  getAuditTrail,
  createAuditPlan,
  createFinding,
  getFindings
} from '../controllers/auditor.controller';
import {
  getConsumptionConfigs,
  updateConsumptionConfig,
  getConsumptionVariances,
  submitApproval,
  getApprovalHistory,
  getPayrollVariances
} from '../controllers/auditor-advanced.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

router.use(protect);

// Night Audit
router.post('/night-audit/start',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  startNightAudit
);

router.put('/night-audit/:id/complete',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  completeNightAudit
);

router.get('/night-audit',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getNightAudits
);

// Exceptions
router.post('/exceptions',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  createException
);

router.put('/exceptions/:id/resolve',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  resolveException
);

router.get('/exceptions',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getExceptions
);

// Audit Trail
router.get('/trail',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  getAuditTrail
);

// Internal Audit
router.post('/plans',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  createAuditPlan
);

router.post('/findings',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  createFinding
);

router.get('/findings',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]),
  getFindings
);

// Advanced Operational Audit
router.get('/consumption/configs',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  getConsumptionConfigs
);

router.post('/consumption/configs',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  updateConsumptionConfig
);

router.get('/consumption/variances',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  getConsumptionVariances
);

// Approvals
router.post('/approvals',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  submitApproval
);

router.get('/approvals',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  getApprovalHistory
);

router.get('/payroll/variances',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR]),
  getPayrollVariances
);

export default router;
