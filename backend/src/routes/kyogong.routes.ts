import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { CASHIER_STATION_ROLES } from '../utils/posStationAccess';

// Import controllers
import {
  openShift,
  getCurrentShift,
  closeShift,
  getShifts,
  getShiftDetails,
  approveShift,
  reconcileShift,
  flagShift,
  recalculateShiftTotals
} from '../controllers/kyogong/shifts.controller';

import {
  createTransaction,
  getShiftTransactions,
  voidTransaction,
  getTransactionDetails
} from '../controllers/kyogong/transactions.controller';

import {
  getSpaServices,
  createSpaService,
  updateSpaService,
  getSpaCategories
} from '../controllers/kyogong/spa-services.controller';

import {
  getCurrentFloat,
  adjustFloat,
  getFloatHistory,
  exportFloatHistory
} from '../controllers/kyogong/float-tracking.controller';

// Legacy /kyogong/petty-cash endpoints are now COMPATIBILITY ALIASES over the
// shared, multi-branch cashier-expenses module (see /cashier/expenses). Kept so
// un-migrated clients keep working; remove once every client uses the new path.
import {
  recordExpense as recordPettyCash,
  listExpenses as getPettyCashEntries,
  getSummary as getPettyCashSummary,
  getCategories as getPettyCashCategories,
  getPendingPOs as getPendingPOsForCashier,
} from '../controllers/cashier-expenses.controller';

import {
  getSalesPoints,
  getSalesPointDetails,
  getDynamicServices,
  createDynamicService,
  updateDynamicService,
  getPoolTokensInventory
} from '../controllers/kyogong/sales-points.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Log route registration for debugging
console.log('[Kyogong Routes] Registering Kyogong routes...');

// ============================================
// SALES POINTS ROUTES
// ============================================
router.get('/sales-points',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.KYOGONG_SPA_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    UserRole.CHOMA_ZONE_CASHIER
  ]),
  getSalesPoints
);

router.get('/sales-points/:id',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.KYOGONG_SPA_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    UserRole.CHOMA_ZONE_CASHIER
  ]),
  getSalesPointDetails
);

// ============================================
// SHIFT MANAGEMENT ROUTES
// ============================================

// Open new shift
router.post('/shifts/open',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.KYOGONG_SPA_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    UserRole.CHOMA_ZONE_CASHIER
  ]),
  openShift
);

// Get current open shift
router.get('/shifts/current',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.KYOGONG_SPA_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    UserRole.CHOMA_ZONE_CASHIER
  ]),
  getCurrentShift
);

// Get all shifts (filtered by role)
router.get('/shifts',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.KYOGONG_SPA_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    UserRole.CHOMA_ZONE_CASHIER
  ]),
  getShifts
);

// ============================================
// FLOAT TRACKING ROUTES
// IMPORTANT: These routes MUST be registered BEFORE the general /shifts/:id route
// to prevent Express from matching /shifts/{id}/float to the :id parameter
// ============================================

console.log('[Kyogong Routes] Registering float tracking routes...');

// Get current float for shift
router.get('/shifts/:shift_id/float',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.KYOGONG_SPA_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    UserRole.CHOMA_ZONE_CASHIER
  ]),
  getCurrentFloat
);
console.log('[Kyogong Routes] ✓ GET /shifts/:shift_id/float');

// Manual float adjustment (supervisor only)
router.post('/shifts/:shift_id/float/adjust',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT
  ]),
  adjustFloat
);

// Get float history
router.get('/shifts/:shift_id/float/history',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.KYOGONG_SPA_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    UserRole.CHOMA_ZONE_CASHIER
  ]),
  getFloatHistory
);

// Export float history to CSV
router.get('/shifts/:shift_id/float/history/export',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR
  ]),
  exportFloatHistory
);
console.log('[Kyogong Routes] ✓ GET /shifts/:shift_id/float/history/export');
console.log('[Kyogong Routes] Float tracking routes registered successfully');

// ============================================
// SHIFT DETAIL AND MODIFICATION ROUTES
// These routes use :id parameter and must come AFTER more specific routes
// ============================================

// Get shift details
router.get('/shifts/:id',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.KYOGONG_SPA_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    UserRole.CHOMA_ZONE_CASHIER
  ]),
  getShiftDetails
);

// Close shift
router.put('/shifts/:id/close',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.KYOGONG_SPA_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    UserRole.CHOMA_ZONE_CASHIER
  ]),
  closeShift
);

// Recalculate shift totals
router.post('/shifts/:id/recalculate',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.KYOGONG_SPA_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    UserRole.CHOMA_ZONE_CASHIER
  ]),
  recalculateShiftTotals
);

// Reconcile shift (Branch Accountant)
router.put('/shifts/:id/reconcile',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT
  ]),
  reconcileShift
);

// Approve shift (Auditor / Branch Accountant)
router.put('/shifts/:id/approve',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR
  ]),
  approveShift
);

// Flag shift (Branch Accountant)
router.put('/shifts/:id/flag',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT
  ]),
  flagShift
);

// ============================================
// TRANSACTION ROUTES
// ============================================

// Create transaction within shift
router.post('/shifts/:shift_id/transactions',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.RESTAURANT,
    UserRole.BARTENDER,
    UserRole.KYOGONG_SPA_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    UserRole.CHOMA_ZONE_CASHIER
  ]),
  createTransaction
);

// Get shift transactions
router.get('/shifts/:shift_id/transactions',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.KYOGONG_SPA_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    UserRole.CHOMA_ZONE_CASHIER
  ]),
  getShiftTransactions
);

// Get transaction details
router.get('/transactions/:id',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.KYOGONG_SPA_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    UserRole.CHOMA_ZONE_CASHIER
  ]),
  getTransactionDetails
);

// Void transaction
router.put('/transactions/:id/void',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER
  ]),
  voidTransaction
);

// ============================================
// SPA SERVICES ROUTES
// ============================================

// Get SPA categories
router.get('/spa-services/categories',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.KYOGONG_SPA_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    UserRole.CHOMA_ZONE_CASHIER
  ]),
  getSpaCategories
);

// Get SPA services
router.get('/spa-services',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.KYOGONG_SPA_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    UserRole.CHOMA_ZONE_CASHIER
  ]),
  getSpaServices
);

// Create SPA service
router.post('/spa-services',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER
  ]),
  createSpaService
);

// Update SPA service
router.put('/spa-services/:id',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER
  ]),
  updateSpaService
);

// ============================================
// PETTY CASH ROUTES
// ============================================

// Cashier roles that record/read their OWN shift petty-cash (expenses).
// The controller scopes every read and write to the caller's branch_id and the
// supplied shift_id, so these routes are safe for any branch's cashier — the
// "kyogong" namespace is historical; the handler itself is branch-neutral.
//
// Sourced from the CANONICAL cashier-role list (posStationAccess.ts) so this
// scales with the estate: onboarding a new branch or cashier variant only
// requires updating that one map — every petty-cash guard below picks it up
// automatically, with zero edits to this file.
const PETTY_CASH_CASHIER_ROLES = CASHIER_STATION_ROLES as UserRole[];

// Get petty cash categories
router.get('/petty-cash/categories',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.RECEPTIONIST,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    ...PETTY_CASH_CASHIER_ROLES
  ]),
  getPettyCashCategories
);

// Get petty cash summary
router.get('/petty-cash/summary',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.RECEPTIONIST,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    ...PETTY_CASH_CASHIER_ROLES
  ]),
  getPettyCashSummary
);

// Get petty cash entries
router.get('/petty-cash',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.RECEPTIONIST,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    ...PETTY_CASH_CASHIER_ROLES
  ]),
  getPettyCashEntries
);

// Record petty cash entry
router.post('/petty-cash',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    ...PETTY_CASH_CASHIER_ROLES
  ]),
  recordPettyCash
);

// Get pending approved POs for cashier expenses
router.get('/petty-cash/pending-pos',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.RECEPTIONIST,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    ...PETTY_CASH_CASHIER_ROLES
  ]),
  getPendingPOsForCashier
);

// ============================================
// DYNAMIC SERVICES ROUTES
// ============================================

// Get dynamic services
router.get('/dynamic-services',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.KYOGONG_SPA_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.KYOGONG_RECEPTION_CASHIER,
    UserRole.CHOMA_ZONE_CASHIER
  ]),
  getDynamicServices
);

// Create dynamic service
router.post('/dynamic-services',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER
  ]),
  createDynamicService
);

// Update dynamic service
router.put('/dynamic-services/:id',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER
  ]),
  updateDynamicService
);

// ============================================
// POOL TOKENS ROUTES
// ============================================

// Get pool tokens inventory
router.get('/pool-tokens',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.CASHIER,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER
  ]),
  getPoolTokensInventory
);

console.log('[Kyogong Routes] All Kyogong routes registered successfully');

export default router;
