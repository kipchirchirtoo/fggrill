import express from 'express';
import { protect, authorize, UserRole } from '../../middleware/auth';
import {
    listBarStocktakes,
    recordBarStocktake,
    reviewBarStocktake,
    approveBarStocktake,
    rejectBarStocktake,
    getBarStocktakeSummary
} from '../../controllers/storekeeping/bar-stocktake.controller';

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
    UserRole.MAIN_BAR_CASHIER,
    UserRole.EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
    UserRole.KYOGONG_SPORTS_BAR_CASHIER,
    UserRole.BARTENDER,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_ACCOUNTANT,
];
const accountantRoles = [UserRole.SUPER_ADMIN, UserRole.BRANCH_ACCOUNTANT];

// Must come before '/:id/...' so it isn't swallowed by the param route.
router.get('/summary', authorize(viewRoles), getBarStocktakeSummary);

router.get('/', authorize(viewRoles), listBarStocktakes);
router.post('/', authorize(recordRoles), recordBarStocktake);
router.patch('/:id/review', authorize(accountantRoles), reviewBarStocktake);
router.patch('/:id/approve', authorize(accountantRoles), approveBarStocktake);
router.patch('/:id/reject', authorize(accountantRoles), rejectBarStocktake);

export default router;
