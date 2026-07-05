import express from 'express';
import { authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import {
    openKitchenShift,
    addShiftStock,
    recordProduction,
    recordSpoilage,
    closeKitchenShift,
    submitForApproval,
    chefConfirmShift,
    accountantReviewShift,
    confirmProductionActual,
    getKitchenShift,
    listKitchenShifts,
    createProductionRecipe,
    updateProductionRecipe,
    deactivateProductionRecipe,
    listProductionRecipes,
    listRecipeLinkableMenuItems,
    getKitchenShiftStats,
    getProductionSessionView,
    getKitchenShiftPosConsumption,
    listShiftAdditions,
    getActiveCashierShift,
    getProductionSummary,
    getKitchenShiftHandover
} from '../controllers/kitchen-shift.controller';

const router = express.Router();

const KITCHEN_ROLES = [
    UserRole.SUPER_ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_STOREKEEPER,
    UserRole.STOREKEEPER,
    UserRole.CENTRAL_STOREKEEPER,
    UserRole.HEAD_CHEF,
    UserRole.SOUS_CHEF,
    UserRole.LINE_COOK,
    UserRole.KITCHEN,
    UserRole.KITCHEN_OPERATIONS,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR
];

// Shifts
router.post('/', authorize(KITCHEN_ROLES), openKitchenShift);
router.get('/', authorize(KITCHEN_ROLES), listKitchenShifts);
router.get('/stats', authorize(KITCHEN_ROLES), getKitchenShiftStats);
// Compatibility view for old kitchen_production_sessions-shaped consumers
router.get('/production-sessions-view', authorize(KITCHEN_ROLES), getProductionSessionView);
router.post('/recipes', authorize(KITCHEN_ROLES), createProductionRecipe);
router.get('/recipes/list', authorize(KITCHEN_ROLES), listProductionRecipes);
router.get('/recipes/menu-items', authorize(KITCHEN_ROLES), listRecipeLinkableMenuItems);
router.put('/recipes/:recipe_id', authorize(KITCHEN_ROLES), updateProductionRecipe);
router.delete('/recipes/:recipe_id', authorize(KITCHEN_ROLES), deactivateProductionRecipe);

router.get('/active-cashier-shift', authorize(KITCHEN_ROLES), getActiveCashierShift);

router.get('/:shift_id', authorize(KITCHEN_ROLES), getKitchenShift);
router.get('/:shift_id/pos-consumption', authorize(KITCHEN_ROLES), getKitchenShiftPosConsumption);
router.get('/:shift_id/additions', authorize(KITCHEN_ROLES), listShiftAdditions);
router.get('/:shift_id/production-summary', authorize(KITCHEN_ROLES), getProductionSummary);
router.get('/:shift_id/handover', authorize(KITCHEN_ROLES), getKitchenShiftHandover);

// Stock operations
router.post('/:shift_id/stock', authorize(KITCHEN_ROLES), addShiftStock);
router.post('/:shift_id/production', authorize(KITCHEN_ROLES), recordProduction);
router.post('/:shift_id/production/:production_id/confirm-actual', authorize(KITCHEN_ROLES), confirmProductionActual);
router.post('/:shift_id/spoilage', authorize(KITCHEN_ROLES), recordSpoilage);

// Shift lifecycle
router.post('/:shift_id/close', authorize(KITCHEN_ROLES), closeKitchenShift);
router.post('/:shift_id/submit', authorize(KITCHEN_ROLES), submitForApproval);
router.post('/:shift_id/chef-confirm', authorize([...KITCHEN_ROLES, UserRole.HEAD_CHEF, UserRole.SOUS_CHEF, UserRole.LINE_COOK]), chefConfirmShift);
router.post('/:shift_id/accountant-review', authorize([UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]), accountantReviewShift);

// Recipes
export default router;
