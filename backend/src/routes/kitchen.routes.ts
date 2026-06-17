import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

// Import controllers
import {
    getKitchenStock,
    getKitchenLedger,
    getItemHistory,
    getKitchenDashboardStats
} from '../controllers/kitchen/stock.controller';

import {
    createRequisition,
    getRequisitions,
    getRequisition,
    approveRequisition,
    rejectRequisition,
    fulfillRequisition,
    getRequisitionRelatedActivity
} from '../controllers/kitchen/requisitions.controller';

import {
    createRecipe,
    getRecipes,
    getRecipe,
    updateRecipe,
    deleteRecipe,
    autoDeductIngredients,
    lockRecipe,
    unlockRecipe,
    getRecipeHistory
} from '../controllers/kitchen/recipes.controller';

import {
    recordUsage,
    getUsageEntries,
    recordWastage,
    getWastageRecords,
    updateWastage,
    deleteWastage,
    reviewWastage,
    auditWastage,
    reviewUsage,
    auditUsage
} from '../controllers/kitchen/usage-wastage.controller';

import {
    getFoodControls,
    createFoodControl,
    updateFoodControl,
    deleteFoodControl,
    calculateYield
} from '../controllers/kitchen/food-control.controller';

import {
    getVarianceReasons,
    getDailyVariance,
    submitVarianceReason,
    approveVariance,
    getPortionStock,
    getPortionLedger
} from '../controllers/kitchen/variance-reconciliation.controller';

import {
    getYieldReport,
    getLossReport,
    getAccountabilityReport
} from '../controllers/kitchen/reports.controller';

import {
    getExpectedPortions,
    getExpectedPortion,
    verifyActualPortions,
    getVarianceSummary,
    getPendingVerifications
} from '../controllers/kitchen/expected-portions.controller';

import {
    listProductionSessions,
    createProductionSession,
    getProductionSession,
    completeProductionSession,
    getRecipesWithIngredients,
    getShiftHandover,
} from '../controllers/kitchen/kitchen-production.controller';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Define role groups
const kitchenStaff = [
    UserRole.KITCHEN,
    UserRole.POS_KITCHEN,
    UserRole.KITCHEN_OPERATIONS,
    UserRole.RESTAURANT,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_STOREKEEPER,
    UserRole.CENTRAL_STOREKEEPER,
];

const kitchenManagers = [
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.KITCHEN_OPERATIONS,
    UserRole.BRANCH_STOREKEEPER,
    UserRole.CENTRAL_STOREKEEPER,
];

const storekeepers = [
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.CENTRAL_STOREKEEPER,
    UserRole.BRANCH_STOREKEEPER,
    UserRole.AUDITOR
];

// =====================================================
// STOCK & LEDGER ROUTES
// =====================================================

router.get('/stock', authorize([...kitchenStaff, UserRole.AUDITOR]), getKitchenStock);
router.get('/stock/ledger', authorize([...kitchenStaff, UserRole.AUDITOR]), getKitchenLedger);
router.get('/stock/:sku/history', authorize([...kitchenStaff, UserRole.AUDITOR]), getItemHistory);
router.get('/dashboard/stats', authorize([...kitchenStaff, UserRole.AUDITOR]), getKitchenDashboardStats);

// Portion Stock Routes
router.get('/portion-stock', authorize([...kitchenStaff, UserRole.AUDITOR]), getPortionStock);
router.get('/portion-ledger', authorize([...kitchenStaff, UserRole.AUDITOR]), getPortionLedger);

// =====================================================
// REQUISITION ROUTES
// =====================================================

router.post('/requisitions', authorize(kitchenStaff), createRequisition);
router.get('/requisitions', authorize([...kitchenStaff, ...storekeepers]), getRequisitions);
router.get('/requisitions/:id', authorize([...kitchenStaff, ...storekeepers]), getRequisition);
router.put('/requisitions/:id/approve', authorize(kitchenManagers), approveRequisition);
router.post('/requisitions/:id/approve', authorize(kitchenManagers), approveRequisition);
router.put('/requisitions/:id/reject', authorize([...kitchenManagers, ...storekeepers]), rejectRequisition);
router.post('/requisitions/:id/reject', authorize([...kitchenManagers, ...storekeepers]), rejectRequisition);
router.post('/requisitions/:id/fulfill', authorize(storekeepers), fulfillRequisition);
router.put('/requisitions/:id/fulfill', authorize(storekeepers), fulfillRequisition);
router.get('/requisitions/:id/related-activity', authorize([...kitchenStaff, ...storekeepers]), getRequisitionRelatedActivity);

// =====================================================
// RECIPE/BOM ROUTES
// =====================================================

router.post('/recipes', authorize(kitchenManagers), createRecipe);
router.get('/recipes', authorize(kitchenStaff), getRecipes);
router.get('/recipes/:id', authorize(kitchenStaff), getRecipe);
router.put('/recipes/:id', authorize(kitchenManagers), updateRecipe);
router.delete('/recipes/:id', authorize(kitchenManagers), deleteRecipe);
router.post('/recipes/:id/lock', authorize(kitchenManagers), lockRecipe);
router.post('/recipes/:id/unlock', authorize(kitchenManagers), unlockRecipe);
router.get('/recipes/:id/history', authorize([...kitchenStaff, UserRole.AUDITOR]), getRecipeHistory);

// Auto-deduction endpoint (called by POS)
router.post('/recipes/auto-deduct', authorize([...kitchenStaff, UserRole.RECEPTIONIST]), autoDeductIngredients);

// =====================================================
// USAGE TRACKING ROUTES
// =====================================================

router.post('/usage', authorize(kitchenStaff), recordUsage);
router.get('/usage', authorize([...kitchenStaff, ...kitchenManagers, UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT]), getUsageEntries);
router.put('/usage/:id/review', authorize([UserRole.BRANCH_ACCOUNTANT, UserRole.SUPER_ADMIN]), reviewUsage);
router.put('/usage/:id/audit', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), auditUsage);

// =====================================================
// WASTAGE ROUTES
// =====================================================

router.post('/wastage', authorize(kitchenStaff), recordWastage);
router.get('/wastage', authorize([...kitchenStaff, ...kitchenManagers, UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT]), getWastageRecords);
router.put('/wastage/:id', authorize(kitchenStaff), updateWastage);
router.delete('/wastage/:id', authorize(kitchenManagers), deleteWastage);
router.put('/wastage/:id/review', authorize([UserRole.BRANCH_ACCOUNTANT, UserRole.SUPER_ADMIN]), reviewWastage);
router.put('/wastage/:id/audit', authorize([UserRole.AUDITOR, UserRole.SUPER_ADMIN]), auditWastage);

// =====================================================
// FOOD CONTROL (YIELD) ROUTES
// =====================================================
router.get('/food-controls', authorize(kitchenStaff), getFoodControls);
router.post('/food-controls', authorize(kitchenManagers), createFoodControl);
router.put('/food-controls/:id', authorize(kitchenManagers), updateFoodControl);
router.delete('/food-controls/:id', authorize(kitchenManagers), deleteFoodControl);
router.post('/food-controls/calculate', authorize(kitchenStaff), calculateYield);

// Variance Reconciliation Routes
router.get('/variance-reasons', authorize(kitchenStaff), getVarianceReasons);
router.get('/variance', authorize(kitchenStaff), getDailyVariance);
router.post('/variance/:id/reason', authorize(kitchenStaff), submitVarianceReason);
router.post('/variance/:id/approve', authorize(kitchenManagers), approveVariance);

// =====================================================
// REPORT ROUTES
// =====================================================
router.get('/reports/yield', authorize(kitchenManagers), getYieldReport);
router.get('/reports/loss', authorize(kitchenManagers), getLossReport);
router.get('/reports/accountability', authorize(kitchenManagers), getAccountabilityReport);

// =====================================================
// EXPECTED PORTIONS (FOOD CONTROL INTEGRATION)
// =====================================================
router.get('/expected-portions', authorize(kitchenStaff), getExpectedPortions);
router.get('/expected-portions/pending', authorize(kitchenStaff), getPendingVerifications);
router.get('/expected-portions/variance/summary', authorize([...kitchenManagers, UserRole.AUDITOR]), getVarianceSummary);
router.get('/expected-portions/:id', authorize(kitchenStaff), getExpectedPortion);
router.put('/expected-portions/:id/verify', authorize(kitchenStaff), verifyActualPortions);

// =====================================================
// KITCHEN PRODUCTION SESSIONS (STOREKEEPER FLOW)
// =====================================================
router.get('/production-sessions/recipes', authorize(storekeepers), getRecipesWithIngredients);
router.get('/production-sessions/handover', authorize([...storekeepers, ...kitchenStaff]), getShiftHandover);
router.get('/production-sessions', authorize([...storekeepers, ...kitchenStaff]), listProductionSessions);
router.post('/production-sessions', authorize(storekeepers), createProductionSession);
router.get('/production-sessions/:id', authorize([...storekeepers, ...kitchenStaff]), getProductionSession);
router.put('/production-sessions/:id/complete', authorize(storekeepers), completeProductionSession);

export default router;
