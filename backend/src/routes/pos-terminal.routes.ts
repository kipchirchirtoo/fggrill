import express from 'express';
import {
  createTerminal,
  listTerminals,
  getTerminal,
  regenerateEnrollmentCode,
  updateTerminal,
  revokeTerminal,
  transferTerminal,
  verifyEnrollmentCode,
  registerTerminal,
  deviceChallenge,
  deviceToken,
  checkDeviceStatus,
} from '../controllers/pos-terminal.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Central administration owns terminals across branches.
const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER];
const VIEW_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.BRANCH_ACCOUNTANT,
];

// ---------------------------------------------------------------
// DEVICE endpoints — PUBLIC (the terminal has no user session yet).
// Protected by the one-time enrollment code and the device signature
// itself, not by a user JWT. Declared first so they never fall through
// to the ':id' admin routes.
// ---------------------------------------------------------------
router.post('/enroll/verify', verifyEnrollmentCode);
router.post('/enroll/register', registerTerminal);
router.get('/device/status', checkDeviceStatus);
router.post('/device/challenge', deviceChallenge);
router.post('/device/token', deviceToken);

// ---------------------------------------------------------------
// ADMIN endpoints — require a user session + role.
// ---------------------------------------------------------------
router.post('/', protect, authorize(ADMIN_ROLES), createTerminal);
router.get('/', protect, authorize(VIEW_ROLES), listTerminals);
router.get('/:id', protect, authorize(VIEW_ROLES), getTerminal);
router.post('/:id/enrollment-code', protect, authorize(ADMIN_ROLES), regenerateEnrollmentCode);
router.patch('/:id', protect, authorize(ADMIN_ROLES), updateTerminal);
router.post('/:id/revoke', protect, authorize(ADMIN_ROLES), revokeTerminal);
router.post('/:id/transfer', protect, authorize(ADMIN_ROLES), transferTerminal);

export default router;
