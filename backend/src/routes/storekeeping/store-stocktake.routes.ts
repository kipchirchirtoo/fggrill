import express from 'express';
import { protect, authorize, UserRole } from '../../middleware/auth';
import {
    listStoreStocktakes,
    recordStoreStocktake,
    reviewStoreStocktake,
    approveStoreStocktake,
    rejectStoreStocktake,
    getStoreStocktakeSummary
} from '../../controllers/storekeeping/store-stocktake.controller';

const router = express.Router();

router.use(protect);

const viewRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.CENTRAL_STOREKEEPER,
    UserRole.BRANCH_STOREKEEPER,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.AUDITOR,
];
const recordRoles = [UserRole.SUPER_ADMIN, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER];
const accountantRoles = [UserRole.SUPER_ADMIN, UserRole.BRANCH_ACCOUNTANT];

// Must come before '/:id/...' so it isn't swallowed by the param route.
router.get('/summary', authorize(viewRoles), getStoreStocktakeSummary);

router.get('/', authorize(viewRoles), listStoreStocktakes);
router.post('/', authorize(recordRoles), recordStoreStocktake);
router.patch('/:id/review', authorize(accountantRoles), reviewStoreStocktake);
router.patch('/:id/approve', authorize(accountantRoles), approveStoreStocktake);
router.patch('/:id/reject', authorize(accountantRoles), rejectStoreStocktake);

export default router;
