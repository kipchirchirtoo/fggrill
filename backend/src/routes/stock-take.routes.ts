import express from 'express';
import {
    getStockTakes,
    getStockTake,
    createStockTake,
    updateStockTake,
    deleteStockTake
} from '../controllers/stock-take.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

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
        UserRole.BRANCH_ACCOUNTANT
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

// Delete stock take
router.delete('/:id',
    authorize([
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER
    ]),
    deleteStockTake
);

export default router;
