import { Router } from 'express';
import { protect } from '../middleware/auth';
import {
  getPowerSyncCredentials,
  getPowerSyncRules,
  getPowerSyncJWKS,
  uploadPowerSyncData,
} from '../controllers/powersync.controller';

const router = Router();

router.use(protect);
router.post('/credentials', getPowerSyncCredentials);
router.get('/rules', getPowerSyncRules);
router.get('/.well-known/jwks.json', getPowerSyncJWKS);
router.post('/upload', uploadPowerSyncData);

export default router;
