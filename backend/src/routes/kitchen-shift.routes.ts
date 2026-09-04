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
    listYieldTypes,
    listRecipeLinkableMenuItems,
    getKitchenShiftStats,
    getProductionSessionView,
    getKitchenShiftPosConsumption,
    listShiftAdditions,
    getActiveCashierShift,
    getProductionSummary,
    getKitchenShiftHandover,
    logProductionEvent,
    getActiveShiftModeHandler,
    configureShiftModeHandler,
    retrySyncHandler,
    getBreakfastPax,
    getShiftReconciliationReport,
    getShiftDailyControlsReport,
    exportShiftDailyControlsExcel,
    exportShiftDailyControlsCsv,
    listPrepBatches,
    sendPrepBatch,
    receivePrepBatch,
    listDirectItems,
    createDirectItem,
    deactivateDirectItem,
    getKitchenVarianceSummaryReport,
    exportKitchenVarianceSummaryExcel
} from '../controllers/kitchen-shift.controller';

const router = express.Router();

export const KITCHEN_ROLES = [
    UserRole.SUPER_ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_STOREKEEPER,
    UserRole.STOREKEEPER,
    UserRole.CENTRAL_STOREKEEPER,
    UserRole.KITCHEN_OPERATIONS,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR
];

export const SHIFT_WRITE_ROLES = [
    UserRole.BRANCH_STOREKEEPER,
    UserRole.STOREKEEPER,
    UserRole.KITCHEN_OPERATIONS
];

const SHIFT_ADMIN_ROLES = [
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT
];

// Shifts
router.post('/', authorize(SHIFT_WRITE_ROLES), openKitchenShift);
router.get('/', authorize(KITCHEN_ROLES), listKitchenShifts);
router.get('/stats', authorize(KITCHEN_ROLES), getKitchenShiftStats);
router.get('/shift-mode', authorize(KITCHEN_ROLES), getActiveShiftModeHandler);
router.post('/shift-mode', authorize(SHIFT_ADMIN_ROLES), configureShiftModeHandler);
router.post('/production/log', authorize(SHIFT_WRITE_ROLES), logProductionEvent);

// Compatibility view for old kitchen_production_sessions-shaped consumers
router.get('/production-sessions-view', authorize(KITCHEN_ROLES), getProductionSessionView);
router.post('/recipes', authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]), createProductionRecipe);
router.get('/recipes/list', authorize(KITCHEN_ROLES), listProductionRecipes);
router.get('/yield-types', authorize(KITCHEN_ROLES), listYieldTypes);
router.get('/recipes/menu-items', authorize(KITCHEN_ROLES), listRecipeLinkableMenuItems);
router.put('/recipes/:recipe_id', authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]), updateProductionRecipe);
router.delete('/recipes/:recipe_id', authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]), deactivateProductionRecipe);
router.get('/direct-items', authorize(KITCHEN_ROLES), listDirectItems);
router.post('/direct-items', authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]), createDirectItem);
router.delete('/direct-items/:id', authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]), deactivateDirectItem);

// Active shift helpers
router.get('/breakfast-pax', authorize(KITCHEN_ROLES), getBreakfastPax);
router.get('/active-cashier-shift', authorize(KITCHEN_ROLES), getActiveCashierShift);

// Variance summary and reporting
router.get('/variance-summary-report', authorize(KITCHEN_ROLES), getKitchenVarianceSummaryReport);
router.get('/variance-summary-report/export.xlsx', authorize(KITCHEN_ROLES), exportKitchenVarianceSummaryExcel);

router.get('/:shift_id', authorize(KITCHEN_ROLES), getKitchenShift);
router.get('/:shift_id/pos-consumption', authorize(KITCHEN_ROLES), getKitchenShiftPosConsumption);
router.get('/:shift_id/reconciliation-report', authorize(KITCHEN_ROLES), getShiftReconciliationReport);
router.get('/:shift_id/daily-controls', authorize(KITCHEN_ROLES), getShiftDailyControlsReport);
router.get('/:shift_id/daily-controls/export.xlsx', authorize(KITCHEN_ROLES), exportShiftDailyControlsExcel);
router.get('/:shift_id/daily-controls/export.csv', authorize(KITCHEN_ROLES), exportShiftDailyControlsCsv);
router.get('/:shift_id/additions', authorize(KITCHEN_ROLES), listShiftAdditions);
router.get('/:shift_id/prep-batches', authorize(KITCHEN_ROLES), listPrepBatches);
router.get('/:shift_id/production-summary', authorize(KITCHEN_ROLES), getProductionSummary);
router.get('/:shift_id/handover', authorize(KITCHEN_ROLES), getKitchenShiftHandover);

// Stock operations
router.post('/:shift_id/stock', authorize(SHIFT_WRITE_ROLES), addShiftStock);
router.post('/:shift_id/prep-batches', authorize(SHIFT_WRITE_ROLES), sendPrepBatch);
router.post('/:shift_id/prep-batches/:batch_id/receive', authorize(SHIFT_WRITE_ROLES), receivePrepBatch);
router.post('/:shift_id/production', authorize(SHIFT_WRITE_ROLES), recordProduction);
router.post('/:shift_id/production/:production_id/confirm-actual', authorize(SHIFT_WRITE_ROLES), confirmProductionActual);
router.post('/:shift_id/spoilage', authorize(SHIFT_WRITE_ROLES), recordSpoilage);

// Shift lifecycle
router.post('/:shift_id/close', authorize(SHIFT_WRITE_ROLES), closeKitchenShift);
router.post('/:shift_id/submit', authorize(SHIFT_WRITE_ROLES), submitForApproval);
router.post('/:shift_id/chef-confirm', authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]), chefConfirmShift);
router.post('/:shift_id/accountant-review', authorize([UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]), accountantReviewShift);
router.post('/:shift_id/sync/retry', authorize(SHIFT_WRITE_ROLES), retrySyncHandler);

export default router;
