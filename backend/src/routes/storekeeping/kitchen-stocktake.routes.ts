import express from 'express';
import { protect, authorize, UserRole } from '../../middleware/auth';
import {
    getKitchenStocktake,
    saveKitchenStocktake,
    listKitchenStocktakes,
    reviewKitchenStocktake,
    approveKitchenStocktake,
    rejectKitchenStocktake,
} from '../../controllers/storekeeping/kitchen-stocktake.controller';

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

router.get('/list', authorize(viewRoles), listKitchenStocktakes);
router.get('/', authorize(viewRoles), getKitchenStocktake);
router.post('/', authorize(recordRoles), saveKitchenStocktake);
router.patch('/:id/review', authorize(accountantRoles), reviewKitchenStocktake);
router.patch('/:id/approve', authorize(accountantRoles), approveKitchenStocktake);
router.patch('/:id/reject', authorize(accountantRoles), rejectKitchenStocktake);

export default router;
