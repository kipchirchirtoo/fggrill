import express from 'express';
import { protect, authorize, UserRole } from '../../middleware/auth';
import {
    getKitchenStocktake,
    saveKitchenStocktake,
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

router.get('/', authorize(viewRoles), getKitchenStocktake);
router.post('/', authorize(recordRoles), saveKitchenStocktake);

export default router;
