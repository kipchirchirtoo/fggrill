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
    deleteWastage
} from '../controllers/kitchen/usage-wastage.controller';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Define role groups
const kitchenStaff = [
    UserRole.KITCHEN,
    UserRole.POS_KITCHEN,
    UserRole.RESTAURANT,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER
];

const kitchenManagers = [
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER
];

const storekeepers = [
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.CENTRAL_STOREKEEPER,
    UserRole.BRANCH_STOREKEEPER
];

// =====================================================
// STOCK & LEDGER ROUTES
// =====================================================

router.get('/stock', authorize(kitchenStaff), getKitchenStock);
router.get('/stock/ledger', authorize(kitchenStaff), getKitchenLedger);
router.get('/stock/:sku/history', authorize(kitchenStaff), getItemHistory);
router.get('/dashboard/stats', authorize(kitchenStaff), getKitchenDashboardStats);

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
router.get('/usage', authorize([...kitchenStaff, ...kitchenManagers]), getUsageEntries);

// =====================================================
// WASTAGE ROUTES
// =====================================================

router.post('/wastage', authorize(kitchenStaff), recordWastage);
router.get('/wastage', authorize([...kitchenStaff, ...kitchenManagers]), getWastageRecords);
router.put('/wastage/:id', authorize(kitchenStaff), updateWastage);
router.delete('/wastage/:id', authorize(kitchenManagers), deleteWastage);

export default router;
