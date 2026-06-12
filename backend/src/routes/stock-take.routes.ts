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
import { generateBranchStockTakeWorksheet } from '../controllers/stock-take.controller';
import {
    downloadBranchStockTakeReportPDF,
    downloadBranchStockTakeWorkbook
} from '../controllers/storekeeping/stock-take-reports.controller';
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

const STOREKEEPER_ROLES = [
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_STOREKEEPER,
    UserRole.BRANCH_MANAGER
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
    authorize(STOREKEEPER_ROLES),
    createStockTake
);

// Update stock take (Bulk items update / Progress save)
// Frontend uses PUT /api/stock-takes/:id
router.put('/:id',
    authorize(STOREKEEPER_ROLES),
    updateStockTake
);

// Submit stock take to auditor
// Frontend uses POST /api/stock-takes/:id/submit
router.post('/:id/submit',
    authorize(STOREKEEPER_ROLES),
    completeStockTake
);

// Specific worksheet generation for an existing stock take
router.get('/:id/worksheet',
    authorize(AUDIT_ROLES),
    generateWorksheet
);

// Branch stock take worksheet with category grouping
router.get('/:id/worksheet-categorized',
    authorize(AUDIT_ROLES),
    generateBranchStockTakeWorksheet
);

// Executive branch stock take reports (variance/audit) — FG branded.
// Variant query param: storekeeper (default) | accountant_review | audit
router.get('/:id/report.pdf',
    authorize(AUDIT_ROLES),
    downloadBranchStockTakeReportPDF
);

router.get('/:id/report.xlsx',
    authorize(AUDIT_ROLES),
    downloadBranchStockTakeWorkbook
);

export default router;
