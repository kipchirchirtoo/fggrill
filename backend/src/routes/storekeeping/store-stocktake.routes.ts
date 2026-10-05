import express from 'express';
import { protect, authorize, UserRole } from '../../middleware/auth';
import {
    listStoreStocktakes,
    recordStoreStocktake,
    reviewStoreStocktake,
    approveStoreStocktake,
    rejectStoreStocktake,
    batchReviewStoreStocktake,
    batchApproveStoreStocktake,
    batchRejectStoreStocktake,
    getStoreStocktakeSummary
} from '../../controllers/storekeeping/store-stocktake.controller';

const router = express.Router();

router.use(protect);

const viewRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
    UserRole.CENTRAL_STOREKEEPER,
    UserRole.BRANCH_STOREKEEPER,
    UserRole.STOREKEEPER,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.MAIN_BAR_CASHIER,
    UserRole.EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.RESTAURANT_CASHIER,
    UserRole.CASHIER,
    UserRole.BARTENDER,
];
const recordRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
    UserRole.CENTRAL_STOREKEEPER,
    UserRole.BRANCH_STOREKEEPER,
    UserRole.STOREKEEPER,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_ACCOUNTANT,
];
const accountantRoles = [UserRole.SUPER_ADMIN, UserRole.BRANCH_ACCOUNTANT];

// Must come before '/:id/...' so it isn't swallowed by the param route.
router.get('/summary', authorize(viewRoles), getStoreStocktakeSummary);
router.patch('/batch/review', authorize(accountantRoles), batchReviewStoreStocktake);
router.patch('/batch/approve', authorize(accountantRoles), batchApproveStoreStocktake);
router.patch('/batch/reject', authorize(accountantRoles), batchRejectStoreStocktake);

router.get('/', authorize(viewRoles), listStoreStocktakes);
router.post('/', authorize(recordRoles), recordStoreStocktake);
router.patch('/:id/review', authorize(accountantRoles), reviewStoreStocktake);
router.patch('/:id/approve', authorize(accountantRoles), approveStoreStocktake);
router.patch('/:id/reject', authorize(accountantRoles), rejectStoreStocktake);

export default router;
