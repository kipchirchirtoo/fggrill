import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { CASHIER_STATION_ROLES } from '../utils/posStationAccess';
import {
  recordExpense,
  listExpenses,
  getSummary,
  getCategories,
  getPendingPOs,
} from '../controllers/cashier-expenses.controller';

// Generic, multi-branch Cashier Expenses & Petty Cash routes (mounted at
// /cashier). The controller/service enforce the real scoping: cashier-facing
// roles are pinned to their own active shift; management roles get
// branch-permissioned history. Route-level authorize() is only a coarse gate.
const router = express.Router();

// Cashier-station roles come from the canonical list so onboarding a new branch
// or cashier variant needs no edits here.
const STATION_ROLES = CASHIER_STATION_ROLES as UserRole[];

// Broad read gate — service narrows to active shift (cashiers) or authorized
// branch (management).
const READ_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.RECEPTIONIST,
  UserRole.BRANCH_ACCOUNTANT,
  UserRole.ACCOUNTANT,
  UserRole.AUDITOR,
  UserRole.KYOGONG_RECEPTION_CASHIER,
  ...STATION_ROLES,
];

// Recording requires a caller who mans a shift.
const RECORD_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.RECEPTIONIST,
  UserRole.KYOGONG_RECEPTION_CASHIER,
  ...STATION_ROLES,
];

router.use(protect);

router.get('/expenses/categories', authorize(READ_ROLES), getCategories);
router.get('/expenses/summary', authorize(READ_ROLES), getSummary);
router.get('/expenses/pending-pos', authorize(READ_ROLES), getPendingPOs);
router.get('/expenses', authorize(READ_ROLES), listExpenses);
router.post('/expenses', authorize(RECORD_ROLES), recordExpense);

export default router;
