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
    fulfillRequisition
} from '../controllers/kitchen/requisitions.controller';

import {
    createRecipe,
    getRecipes,
    getRecipe,
    updateRecipe,
    deleteRecipe,
    autoDeductIngredients
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
    UserRole.BRANCH_MANAGER
];

const kitchenManagers = [
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.KITCHEN_OPERATIONS
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
router.put('/requisitions/:id/reject', authorize(kitchenManagers), rejectRequisition);
router.post('/requisitions/:id/fulfill', authorize(storekeepers), fulfillRequisition);

// =====================================================
// RECIPE/BOM ROUTES
// =====================================================

router.post('/recipes', authorize(kitchenManagers), createRecipe);
router.get('/recipes', authorize(kitchenStaff), getRecipes);
router.get('/recipes/:id', authorize(kitchenStaff), getRecipe);
router.put('/recipes/:id', authorize(kitchenManagers), updateRecipe);
router.delete('/recipes/:id', authorize(kitchenManagers), deleteRecipe);

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

export default router;
