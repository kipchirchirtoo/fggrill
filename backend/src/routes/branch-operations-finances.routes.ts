import express from 'express';
import { protect } from '../middleware/auth';
import { validateBranch } from '../middleware/branch';

// Define UserRole enum since it might not be directly accessible
enum UserRole {
  SUPER_ADMIN = 'super_admin',
  GENERAL_MANAGER = 'general_manager',
  ACCOUNTANT = 'accountant',
  BRANCH_ACCOUNTANT = 'branch_accountant',
  BRANCH_MANAGER = 'branch_manager',
  BRANCH_OPERATIONS_MANAGER = 'branch_operations_manager'
}

// Simple authorize middleware implementation
const authorize = (roles: UserRole[]) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userRole = req.user?.role;
    
    if (!userRole || !roles.includes(userRole as UserRole)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
    
    next();
  };
};

// Import budget controllers
import {
  getBranchBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget,
  linkExpenseToBudget,
  getBudgetSummary,
  getBudgetAnalysis
} from '../controllers/budget.controller';

const router = express.Router();

// Middleware for all routes
router.use(protect);
router.use(validateBranch);

// Budget routes
router.route('/budgets')
  .get(
    authorize([
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.BRANCH_ACCOUNTANT,
      UserRole.BRANCH_MANAGER,
      UserRole.BRANCH_OPERATIONS_MANAGER
    ]),
    getBranchBudgets
  )
  .post(
    authorize([
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.BRANCH_ACCOUNTANT
    ]),
    createBudget
  );

router.route('/budgets/:id')
  .get(
    authorize([
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.BRANCH_ACCOUNTANT,
      UserRole.BRANCH_MANAGER,
      UserRole.BRANCH_OPERATIONS_MANAGER
    ]),
    getBudgetById
  )
  .put(
    authorize([
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.BRANCH_ACCOUNTANT
    ]),
    updateBudget
  )
  .delete(
    authorize([
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER
    ]),
    deleteBudget
  );

router.post(
  '/budgets/:id/expenses',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT
  ]),
  linkExpenseToBudget
);

router.get(
  '/budget-summary',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_OPERATIONS_MANAGER
  ]),
  getBudgetSummary
);

router.get(
  '/budget-analysis',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_OPERATIONS_MANAGER
  ]),
  getBudgetAnalysis
);

export default router;
