import { Router } from 'express';
import {
  getBranchFeatures,
  toggleBranchFeature,
  checkFeatureEnabled,
} from '../controllers/branch-features.controller';

const router = Router();

router.get('/', getBranchFeatures);
router.put('/toggle', toggleBranchFeature);
router.post('/toggle', toggleBranchFeature);
router.get('/check', checkFeatureEnabled);
router.get('/check/:branchId/:featureKey', checkFeatureEnabled);

export default router;
