import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

// Import controllers
import {
  openShift,
  getCurrentShift,
  closeShift,
  getShifts,
  getShiftDetails,
  approveShift,
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

import {
  recordPettyCash,
  getPettyCashEntries,
  getPettyCashSummary,
  getPettyCashCategories
} from '../controllers/kyogong/petty-cash.controller';

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
    UserRole.KYOGONG_RECEPTION_CASHIER
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
    UserRole.KYOGONG_RECEPTION_CASHIER
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
    UserRole.KYOGONG_RECEPTION_CASHIER
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
    UserRole.KYOGONG_RECEPTION_CASHIER
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
    UserRole.KYOGONG_RECEPTION_CASHIER
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
    UserRole.KYOGONG_RECEPTION_CASHIER
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
    UserRole.KYOGONG_RECEPTION_CASHIER
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
    UserRole.KYOGONG_RECEPTION_CASHIER
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
    UserRole.KYOGONG_RECEPTION_CASHIER
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
    UserRole.KYOGONG_RECEPTION_CASHIER
  ]),
  recalculateShiftTotals
);

// Approve shift (Branch Accountant)
router.put('/shifts/:id/approve',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT
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
    UserRole.KYOGONG_RECEPTION_CASHIER
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
    UserRole.KYOGONG_RECEPTION_CASHIER
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
    UserRole.KYOGONG_RECEPTION_CASHIER
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
    UserRole.KYOGONG_RECEPTION_CASHIER
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
    UserRole.KYOGONG_RECEPTION_CASHIER
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
    UserRole.KYOGONG_RECEPTION_CASHIER
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
    UserRole.KYOGONG_RECEPTION_CASHIER
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
    UserRole.KYOGONG_RECEPTION_CASHIER
  ]),
  getPettyCashEntries
);

// Record petty cash entry
router.post('/petty-cash',
  authorize([
    UserRole.SUPER_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.KYOGONG_RECEPTION_CASHIER
  ]),
  recordPettyCash
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
    UserRole.KYOGONG_RECEPTION_CASHIER
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
