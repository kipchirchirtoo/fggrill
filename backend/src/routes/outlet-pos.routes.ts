import { Router } from 'express';
import { protect } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
  closeShift,
  createOutlet,
  createOutletItem,
  getActiveShift,
  getPendingPosVoidRequests,
  getOutletItems,
  getOutletStaff,
  getOutlets,
  getPrinterStatus,
  getShiftOrder,
  getShiftOrders,
  getShiftSummary,
  getStockCount,
  mergeShiftOrders,
  openShift,
  payShiftOrder,
  recordShiftOrder,
  requestVoidShiftOrder,
  reviewPosVoidRequest,
  reviewShift,
  splitShiftOrder,
  syncOutletItems,
  submitShift,
  updateOutlet,
  updateOutletItem,
  updateShiftOrder,
  updateStockCount
} from '../controllers/outlet-pos.controller';

const router = Router();

const allowedRoles = new Set([
  'cashier',
  'restaurant_cashier',
  'main_bar_cashier',
  'executive_bar_cashier',
  'non_consumables_cashier',
  'super_admin',
  'general_manager',
  'director',
  'branch_manager',
  'accountant',
  'branch_accountant',
  'finance_manager',
  'auditor',
  'night_auditor',
  'restaurant',
  'restaurant_manager',
  'waiter',
  'waitress',
  'head_waiter',
  'bartender',
  'bar_manager',
  'barman',
  'barmaid',
  'branch_storekeeper',
  'storekeeper',
  'inventory_clerk',
  'kyogong_spa_cashier',
  'kyogong_executive_bar_cashier',
  'kyogong_sports_bar_cashier',
  'kyogong_reception_cashier'
]);

router.use(protect);
router.use((req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (req.user?.is_pos_login && req.user?.active_outlet_type) return next();
  if (allowedRoles.has(role)) return next();
  logger.warn(`Forbidden: Outlet POS access denied for user ${req.user?.id} with role ${req.user?.role}`);
  return res.status(403).json({ success: false, message: 'Forbidden: POS outlet access required' });
});

router.get('/printer/status', getPrinterStatus);
router.get('/outlets', getOutlets);
router.post('/outlets', createOutlet);
router.get('/staff', getOutletStaff);
router.get('/outlets/:outletId/items', getOutletItems);
router.post('/outlets/:outletId/items', createOutletItem);
router.patch('/outlets/:outletId/items/:itemId', updateOutletItem);
router.post('/outlets/:outletId/sync-items', syncOutletItems);
router.patch('/outlets/:outletId', updateOutlet);
router.get('/outlets/:outletId/shifts/active', getActiveShift);
router.post('/outlets/:outletId/shifts/open', openShift);

router.get('/void-requests/pending', getPendingPosVoidRequests);
router.post('/void-requests/:requestId/review', reviewPosVoidRequest);

router.get('/shifts/:shiftId/orders', getShiftOrders);
router.post('/shifts/:shiftId/orders', recordShiftOrder);
router.post('/shifts/:shiftId/orders/merge', mergeShiftOrders);
router.get('/shifts/:shiftId/orders/:orderId', getShiftOrder);
router.patch('/shifts/:shiftId/orders/:orderId', updateShiftOrder);
router.post('/shifts/:shiftId/orders/:orderId/split', splitShiftOrder);
router.post('/shifts/:shiftId/orders/:orderId/void-request', requestVoidShiftOrder);
router.post('/shifts/:shiftId/orders/:orderId/pay', payShiftOrder);
router.get('/shifts/:shiftId/stock-count', getStockCount);
router.put('/shifts/:shiftId/stock-count', updateStockCount);
router.get('/shifts/:shiftId/summary', getShiftSummary);
router.post('/shifts/:shiftId/close', closeShift);
router.post('/shifts/:shiftId/submit', submitShift);
router.post('/shifts/:shiftId/review', reviewShift);

export default router;
