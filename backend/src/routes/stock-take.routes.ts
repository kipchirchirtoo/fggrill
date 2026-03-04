import express from 'express';
import {
    getStockTakes,
    getStockTake,
    createStockTake,
    completeStockTake
} from '../controllers/storekeeping/resources.controller';
import { updateStockTake, submitStockTake } from '../controllers/stock-take.controller'; // Keep for now if resources doesn't have a generic update
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { deleteStockTake } from '../controllers/stock-take.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get all stock takes
router.get('/',
    authorize([
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER,
        UserRole.BRANCH_MANAGER,
        UserRole.ACCOUNTANT,
        UserRole.AUDITOR,
        UserRole.BRANCH_ACCOUNTANT
    ]),
    getStockTakes
);

// Get single stock take
router.get('/:id',
    authorize([
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER,
        UserRole.BRANCH_MANAGER,
        UserRole.ACCOUNTANT,
        UserRole.AUDITOR,
        UserRole.BRANCH_ACCOUNTANT,
        UserRole.BRANCH_STOREKEEPER
    ]),
    getStockTake
);

// Create stock take
router.post('/',
    authorize([
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER,
        UserRole.BRANCH_MANAGER,
        UserRole.BRANCH_ACCOUNTANT
    ]),
    createStockTake
);

// Update stock take
router.put('/:id',
    authorize([
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER,
        UserRole.BRANCH_MANAGER,
        UserRole.BRANCH_ACCOUNTANT,
        UserRole.AUDITOR
    ]),
    updateStockTake
);

// Submit stock take to auditor
router.put('/:id/submit',
    authorize([
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER,
        UserRole.BRANCH_MANAGER,
        UserRole.BRANCH_ACCOUNTANT
    ]),
    submitStockTake
);

// Delete stock take
router.delete('/:id',
    authorize([
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER
    ]),
    deleteStockTake
);

export default router;
