import { Router } from 'express';
import { getHRReportsIndex, generateKRAP10, generateNSSFReport, generateSHIFReport, generateHousingLevyReport } from '../controllers/hrReports.controller';
import { protect as authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

router.use(authenticate);
router.use(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR]));

router.get('/', getHRReportsIndex);
router.get('/kra-p10', generateKRAP10);
router.get('/nssf', generateNSSFReport);
router.get('/shif', generateSHIFReport);
router.get('/housing-levy', generateHousingLevyReport);

export default router;
