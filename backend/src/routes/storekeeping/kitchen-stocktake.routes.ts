import express from 'express';
import { protect, authorize, UserRole } from '../../middleware/auth';
import {
    getKitchenStocktake,
    saveKitchenStocktake,
    listKitchenStocktakes,
    reviewKitchenStocktake,
    approveKitchenStocktake,
    rejectKitchenStocktake,
    updateKitchenStocktakeItems,
} from '../../controllers/storekeeping/kitchen-stocktake.controller';

const router = express.Router();

router.use(protect);

const viewRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
    UserRole.CENTRAL_STOREKEEPER,
    UserRole.BRANCH_STOREKEEPER,
    UserRole.STOREKEEPER,
    UserRole.KITCHEN_OPERATIONS,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.RESTAURANT_CASHIER,
    UserRole.CASHIER,
    UserRole.HEAD_CHEF,
    UserRole.SOUS_CHEF,
];

const recordRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_STOREKEEPER,
    UserRole.STOREKEEPER,
    UserRole.KITCHEN_OPERATIONS,
    UserRole.HEAD_CHEF,
    UserRole.SOUS_CHEF,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_ACCOUNTANT,
];

const accountantRoles = [UserRole.SUPER_ADMIN, UserRole.BRANCH_ACCOUNTANT];

router.get('/list', authorize(viewRoles), listKitchenStocktakes);
router.get('/', authorize(viewRoles), getKitchenStocktake);
router.post('/', authorize(recordRoles), saveKitchenStocktake);
router.put('/:id/items', authorize(accountantRoles), updateKitchenStocktakeItems);
router.patch('/:id/review', authorize(accountantRoles), reviewKitchenStocktake);
router.patch('/:id/approve', authorize(accountantRoles), approveKitchenStocktake);
router.patch('/:id/reject', authorize(accountantRoles), rejectKitchenStocktake);

export default router;
