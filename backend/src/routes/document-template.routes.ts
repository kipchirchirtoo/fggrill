import { Router, Request, Response, NextFunction } from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import * as ctrl from '../controllers/document-template.controller';

const router = Router();
router.use(protect);

// Customer-facing paper a Branch Accountant may customise for THEIR OWN branch only.
export const BRANCH_EDITABLE_TEMPLATE_KEYS = ['customer_bill', 'customer_receipt', 'credit_bill', 'void_order'];

/**
 * Super admins keep full control. A branch accountant is pinned to the branch on their account:
 * any branch_id they send is overwritten, a global (all-branch) edit is impossible, and only the
 * customer bill / receipt templates can be touched.
 */
const scopeToOwnBranch = (req: Request, res: Response, next: NextFunction): void => {
  const user: any = (req as any).user;
  if (user?.role === UserRole.SUPER_ADMIN) { next(); return; }
  const branchId = Number(user?.branch_id ?? user?.branchId);
  if (!Number.isFinite(branchId) || branchId <= 0) {
    res.status(403).json({ success: false, message: 'Your account is not assigned to a branch' });
    return;
  }
  const key = req.params?.key;
  if (key && !BRANCH_EDITABLE_TEMPLATE_KEYS.includes(key)) {
    res.status(403).json({ success: false, message: 'This template can only be changed by a super admin' });
    return;
  }
  req.query.branch_id = String(branchId);
  if (req.body && typeof req.body === 'object') req.body.branch_id = branchId;
  next();
};
const templateEditors = authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_ACCOUNTANT]);

// App-side: any authenticated staff can resolve a document template + till to print.
router.get('/resolve', ctrl.resolveDocument);

// SuperAdmin template management ------------------------------------------------
// Branch accountant: contact details + till numbers of their own branch.
router.get('/branch-settings', templateEditors, scopeToOwnBranch, ctrl.getBranchPrintSettings);
router.put('/branch-settings', templateEditors, scopeToOwnBranch, ctrl.updateBranchPrintSettings);

router.get('/', templateEditors, scopeToOwnBranch, ctrl.listTemplates);
router.get('/tills', authorize([UserRole.SUPER_ADMIN]), ctrl.listTills);
router.put('/tills/outlet/:outletId', authorize([UserRole.SUPER_ADMIN]), ctrl.updateOutletTill);
router.put('/tills/branch/:branchId', authorize([UserRole.SUPER_ADMIN]), ctrl.updateBranchTill);
router.get('/:key', templateEditors, scopeToOwnBranch, ctrl.getTemplate);
router.put('/:key', templateEditors, scopeToOwnBranch, ctrl.saveTemplate);
router.post('/:key/reset', templateEditors, scopeToOwnBranch, ctrl.resetTemplate);

export default router;
