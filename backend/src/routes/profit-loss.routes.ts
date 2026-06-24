import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
    getPosProfitLoss,
    exportPosProfitLossPDF,
    getBranchProfitLossRpc
} from '../controllers/profit-loss.controller';

const router = express.Router();

// All routes require authentication. NOTE: authorization is applied PER-ROUTE
// (not via router.use) — a router-level authorize() would 403 every other
// /finance/* request that merely passes through this router on its way to a
// later-mounted router (e.g. /finance/shift-pnl).
router.use(protect);

const FINANCE_ROLES = [
  'branch_manager',
  'branch_accountant',
  'accountant',
  'auditor',
  'director',
  'super_admin',
  'general_manager',
];

// NOTE: /profit-loss and /expense-breakdown are handled by finance.routes.ts,
// which is mounted before this router at the same /finance prefix.

// Per-POS-outlet P&L (cashier transactions + sold items) + branded PDF export
router.get('/pos-profit-loss', authorize(...FINANCE_ROLES), getPosProfitLoss);
router.get('/pos-profit-loss/export/pdf', authorize(...FINANCE_ROLES), exportPosProfitLossPDF);

// Branch P&L via the get_branch_profit_loss() Postgres RPC
router.get('/branch-profit-loss', authorize(...FINANCE_ROLES), getBranchProfitLossRpc);

export default router;
