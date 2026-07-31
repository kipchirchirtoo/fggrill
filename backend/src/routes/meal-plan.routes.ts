import express from 'express';
import {
  getMealPlans,
  getMealPlan,
  createMealPlan,
  updateMealPlan,
  deleteMealPlan,
} from '../controllers/meal-plan.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

router.use(protect);

// Reads: leadership / front-desk roles that need meal-plan entitlement + pricing.
const READ_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.BRANCH_ACCOUNTANT,
  UserRole.ACCOUNTANT,
  UserRole.RECEPTIONIST,
];

// Writes: SuperAdmin / GM own the central meal-plan definitions.
const WRITE_ROLES = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER];

router.get('/', authorize(READ_ROLES), getMealPlans);
router.get('/:id', authorize(READ_ROLES), getMealPlan);
router.post('/', authorize(WRITE_ROLES), createMealPlan);
router.put('/:id', authorize(WRITE_ROLES), updateMealPlan);
router.delete('/:id', authorize(WRITE_ROLES), deleteMealPlan);

export default router;
