import express from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import {
    getBranchPerformanceReport,
    getStockUsageReport,
    getEmployeeCreditReport
} from '../controllers/auditor-reports.controller';

const router = express.Router();

// All routes require authentication and Auditor role
router.use(protect);
router.use(authorize([UserRole.AUDITOR]));

router.get('/performance', getBranchPerformanceReport);
router.get('/stock-usage', getStockUsageReport);
router.get('/employee-credit', getEmployeeCreditReport);

export default router;
