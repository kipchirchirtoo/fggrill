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

export default router;
