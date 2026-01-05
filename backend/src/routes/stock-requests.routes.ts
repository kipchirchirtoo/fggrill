import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import {
    createRequest,
    getRequests,
    approveRequest,
    rejectRequest
} from '../controllers/stock-request.controller';

const router = express.Router();

router.use(protect);

router
    .route('/')
    .post(authorize([UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]), createRequest)
    .get(authorize([UserRole.AUDITOR, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_MANAGER]), getRequests);

router
    .route('/:id/approve')
    .put(authorize([UserRole.AUDITOR, UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN]), approveRequest);

router
    .route('/:id/reject')
    .put(authorize([UserRole.AUDITOR, UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN]), rejectRequest);

export default router;
