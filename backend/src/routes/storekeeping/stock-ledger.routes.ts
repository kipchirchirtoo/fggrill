import express from 'express';
import { protect, authorize, UserRole } from '../../middleware/auth';
import { getStockLedger, recordActualClosing } from '../../controllers/storekeeping/stock-ledger.controller';

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
const writeRoles = [UserRole.SUPER_ADMIN, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER];

router.get('/', authorize(viewRoles), getStockLedger);
router.put('/:id/actual-closing', authorize(writeRoles), recordActualClosing);

export default router;
