import { Router } from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import { getBehaviorAnomalies, rebuildProfiles } from '../controllers/admin-ai.controller';

const router = Router();

// Apply authentication to all AI routes
router.use(protect);

// Allow Super_Admin and Branch_Manager to see insights
router.get('/anomalies', 
  authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]), 
  getBehaviorAnomalies
);

// Only Super_Admin can trigger full model rebuilds
router.post('/retrain', 
  authorize([UserRole.SUPER_ADMIN]), 
  rebuildProfiles
);

export default router;
