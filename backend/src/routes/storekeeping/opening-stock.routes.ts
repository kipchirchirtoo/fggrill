import express from 'express';
import { protect, authorize, UserRole } from '../../middleware/auth';
import { getOpeningStockStatus, submitOpeningStock } from '../../controllers/storekeeping/opening-stock.controller';

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
const submitRoles = [UserRole.SUPER_ADMIN, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER];

router.get('/:shiftId', authorize(viewRoles), getOpeningStockStatus);
router.post('/:shiftId', authorize(submitRoles), submitOpeningStock);

export default router;
