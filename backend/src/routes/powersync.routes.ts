import { Router } from 'express';
import { protect } from '../middleware/auth';
import { getPowerSyncCredentials, getPowerSyncRules } from '../controllers/powersync.controller';

const router = Router();

router.use(protect);
router.post('/credentials', getPowerSyncCredentials);
router.get('/rules', getPowerSyncRules);

export default router;
