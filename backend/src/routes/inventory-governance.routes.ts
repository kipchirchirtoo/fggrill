import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import {
  getAlerts,
  getDashboard,
  getDocuments,
  getExceptions,
  getRules,
  reviewException
} from '../controllers/inventory-governance.controller';

const router = express.Router();

const viewRoles = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.GENERAL_MANAGER,
  UserRole.CENTRAL_STOREKEEPER,
  UserRole.BRANCH_STOREKEEPER,
  UserRole.BRANCH_MANAGER,
  UserRole.BRANCH_ACCOUNTANT,
  UserRole.AUDITOR,
  UserRole.ACCOUNTANT,
  UserRole.FINANCE_MANAGER,
  UserRole.PROCUREMENT,
  UserRole.PURCHASING_MANAGER,
  UserRole.STOREKEEPER,
  UserRole.KITCHEN_OPERATIONS,
  UserRole.RESTAURANT_MANAGER
];

const reviewRoles = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.GENERAL_MANAGER,
  UserRole.AUDITOR,
  UserRole.FINANCE_MANAGER
];

router.use(protect);

router.get('/exceptions', authorize(viewRoles), getExceptions);
router.get('/alerts', authorize(viewRoles), getAlerts);
router.get('/dashboards/:role', authorize(viewRoles), getDashboard);
router.get('/documents', authorize(viewRoles), getDocuments);
router.get('/rules', authorize(viewRoles), getRules);
router.post('/exceptions/review', authorize(reviewRoles), reviewException);

export default router;
