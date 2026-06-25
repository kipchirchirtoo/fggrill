import { Router } from 'express';
import { protect } from '../middleware/auth';
import {
  getPowerSyncCredentials,
  getPowerSyncJWKS,
  uploadPowerSyncData,
} from '../controllers/powersync.controller';

const router = Router();

// Unauthenticated: the PowerSync service fetches this on its own schedule,
// not as a logged-in user. Must come before the protect() gate below.
router.get('/.well-known/jwks.json', getPowerSyncJWKS);

router.use(protect);
router.post('/credentials', getPowerSyncCredentials);
router.post('/upload', uploadPowerSyncData);

export default router;
