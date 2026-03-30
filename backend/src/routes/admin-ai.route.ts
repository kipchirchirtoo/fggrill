import { Router } from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import { getBehaviorAnomalies, rebuildProfiles, getGeminiInsights } from '../controllers/admin-ai.controller';

const router = Router();

router.use(protect);

router.get('/anomalies',
  authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]),
  getBehaviorAnomalies
);

router.get('/insights',
  authorize([UserRole.SUPER_ADMIN]),
  getGeminiInsights
);

router.post('/retrain',
  authorize([UserRole.SUPER_ADMIN]),
  rebuildProfiles
);

export default router;
