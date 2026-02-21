import express from 'express';
import {
    getBankAccounts,
    createBankAccount,
    recordBankingTransaction,
    getBankingTransactions,
    approveBankingTransaction,
    getBankingSummary,
    recordBankReconciliation,
    getBankReconciliations
} from '../controllers/banking.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Bank Accounts
router.get('/accounts', 
    authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.GENERAL_MANAGER]),
    getBankAccounts
);

router.post('/accounts',
    authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
    createBankAccount
);

// Banking Transactions
router.get('/transactions',
    authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.GENERAL_MANAGER]),
    getBankingTransactions
);

router.post('/transactions',
    authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
    recordBankingTransaction
);

router.put('/transactions/:id/approve',
    authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.GENERAL_MANAGER]),
    approveBankingTransaction
);

// Banking Summary/Dashboard
router.get('/summary',
    authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.GENERAL_MANAGER]),
    getBankingSummary
);

// Bank Reconciliations
router.get('/reconciliations',
    authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.GENERAL_MANAGER]),
    getBankReconciliations
);

router.post('/reconciliations',
    authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]),
    recordBankReconciliation
);

export default router;
