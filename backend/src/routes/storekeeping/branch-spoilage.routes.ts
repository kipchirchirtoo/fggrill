import express from 'express';
import { protect, authorize, UserRole } from '../../middleware/auth';
import {
    getSpoilageCandidates,
    listSpoilageRecords,
    recordSpoilage,
    approveSpoilage,
    rejectSpoilage,
} from '../../controllers/storekeeping/branch-spoilage.controller';

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

router.get('/candidates', authorize(viewRoles), getSpoilageCandidates);
router.get('/', authorize(viewRoles), listSpoilageRecords);
router.post('/', authorize(recordRoles), recordSpoilage);
router.patch('/:id/approve', authorize(accountantRoles), approveSpoilage);
router.patch('/:id/reject', authorize(accountantRoles), rejectSpoilage);

export default router;
