import express from 'express';
import { protect, authorize, UserRole } from '../../middleware/auth';
import {
    listPastryProduction,
    recordPastryProduction,
    issuePastryToKitchen,
} from '../../controllers/storekeeping/pastry-production.controller';

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

router.get('/', authorize(viewRoles), listPastryProduction);
router.post('/', authorize(writeRoles), recordPastryProduction);
router.put('/:id/issue', authorize(writeRoles), issuePastryToKitchen);

export default router;
