import { Router } from 'express';
import { generateKRAP10, generateNSSFReport, generateSHIFReport, generateHousingLevyReport } from '../controllers/hrReports.controller';
import { protect as authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

router.use(authenticate);
router.use(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]));

router.get('/kra-p10', generateKRAP10);
router.get('/nssf', generateNSSFReport);
router.get('/shif', generateSHIFReport);
router.get('/housing-levy', generateHousingLevyReport);

export default router;
