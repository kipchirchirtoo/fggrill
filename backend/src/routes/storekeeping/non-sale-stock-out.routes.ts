import express from 'express';
import { protect, authorize, UserRole } from '../../middleware/auth';
import { listNonSaleStockOut, setOperationalExpenseFlag } from '../../controllers/storekeeping/non-sale-stock-out.controller';

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
const correctRoles = [UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT];

router.get('/', authorize(viewRoles), listNonSaleStockOut);
router.put('/:id', authorize(correctRoles), setOperationalExpenseFlag);

export default router;
