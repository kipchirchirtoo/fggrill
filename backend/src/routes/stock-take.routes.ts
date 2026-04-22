import express from 'express';
import {
    getStockTakes,
    getStockTake,
    getStockTakeItems,
    createStockTake,
    updateStockTake,
    completeStockTake,
    generateWorksheet
} from '../controllers/storekeeping/resources.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Unified roles for all stock take operations
const AUDIT_ROLES = [
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.AUDITOR,
    UserRole.CENTRAL_STOREKEEPER,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.BRANCH_STOREKEEPER
];

// Get all stock takes
router.get('/',
    authorize(AUDIT_ROLES),
    getStockTakes
);

// Global worksheet generation (usually by category/branch)
router.get('/worksheet',
    authorize(AUDIT_ROLES),
    generateWorksheet
);

// Get single stock take
router.get('/:id',
    authorize(AUDIT_ROLES),
    getStockTake
);

// Get stock take items
router.get('/:id/items',
    authorize(AUDIT_ROLES),
    getStockTakeItems
);

// Create stock take
router.post('/',
    authorize(AUDIT_ROLES),
    createStockTake
);

// Update stock take (Bulk items update / Progress save)
// Frontend uses PUT /api/stock-takes/:id
router.put('/:id',
    authorize(AUDIT_ROLES),
    updateStockTake
);

// Submit stock take to auditor
// Frontend uses POST /api/stock-takes/:id/submit
router.post('/:id/submit',
    authorize(AUDIT_ROLES),
    completeStockTake
);

// Specific worksheet generation for an existing stock take
router.get('/:id/worksheet',
    authorize(AUDIT_ROLES),
    generateWorksheet
);

export default router;
