import { Router } from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import * as ctrl from '../controllers/document-template.controller';

const router = Router();
router.use(protect);

// App-side: any authenticated staff can resolve a document template + till to print.
router.get('/resolve', ctrl.resolveDocument);

// SuperAdmin template management ------------------------------------------------
router.get('/', authorize([UserRole.SUPER_ADMIN]), ctrl.listTemplates);
router.get('/tills', authorize([UserRole.SUPER_ADMIN]), ctrl.listTills);
router.put('/tills/outlet/:outletId', authorize([UserRole.SUPER_ADMIN]), ctrl.updateOutletTill);
router.put('/tills/branch/:branchId', authorize([UserRole.SUPER_ADMIN]), ctrl.updateBranchTill);
router.get('/:key', authorize([UserRole.SUPER_ADMIN]), ctrl.getTemplate);
router.put('/:key', authorize([UserRole.SUPER_ADMIN]), ctrl.saveTemplate);
router.post('/:key/reset', authorize([UserRole.SUPER_ADMIN]), ctrl.resetTemplate);

export default router;
