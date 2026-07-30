import { Router } from 'express';
import { protect } from '../middleware/auth';
import { withCache } from '../middleware/cacheMiddleware';
import { CacheKeys, CACHE_TTL } from '../services/cacheService';
import { logger } from '../utils/logger';
import {
  approveItemExchange,
  approveItemVoidRequest,
  cashierAcknowledgeItemVoid,
  cashierAcknowledgeVoidRequest,
  cashierDeclineItemVoid,
  cashierDeclineVoidRequest,
  cashierVoidLineItems,
  cashierVoidWholeBill,
  closeShift,
  createOutlet,
  createOutletItem,
  deleteOutletItem,
  getActiveShift,
  getBarCaptainOrders,
  getWaiterOpenBills,
  getConsolidatedBill,
  linkOrdersIntoBill,
  unlinkOrderFromBill,
  payConsolidatedBill,
  getCrossOutletSettlements,
  confirmCrossOutletSettlement,
  disputeCrossOutletSettlement,
  resolveDisputedSettlement,
  addItemsToMasterBill,
  transferMasterBillWaiter,
  moveMasterBillTable,
  getExchangeHistory,
  getItemVoidHistoryForWaiter,
  getItemVoidRequestsForShift,
  getPendingExchangesCashier,
  getPendingItemVoidsForShift,
  getPendingPosVoidRequests,
  getPendingVoidsCashier,
  getPendingVoidsCashierWholeBill,
  getPendingVoidsKitchen,
  getPendingVoidsKitchenWholeBill,
  getPendingVoidsManager,
  getPosBootstrap,
  getOutletItems,
  getOutletStaff,
  getOutlets,
  getPrinterStatus,
  getShiftOrder,
  getShiftOrders,
  getShiftSummary,
  getStockCount,
  getVoidHistory,
  issueExchangeRefund,
  kitchenAcknowledgeItemVoid,
  kitchenAcknowledgeVoidRequest,
  kitchenDeclineItemVoid,
  kitchenDeclineVoidRequest,
  markCaptainOrderPrinted,
  markOriginalBillPrinted,
  mergeShiftOrders,
  nullifyZeroShiftOrder,
  openShift,
  payShiftOrder,
  recordShiftOrder,
  rejectItemExchange,
  rejectItemVoidRequest,
  reprintShiftOrderBill,
  requestItemExchange,
  requestItemVoid,
  requestVoidShiftOrder,
  reviewPosVoidRequest,
  reviewShift,
  searchVoidableBills,
  splitShiftOrder,
  syncOutletItems,
  submitShift,
  updateOutlet,
  updateOutletItem,
  updateShiftOrder,
  updateStockCount
} from '../controllers/outlet-pos.controller';
import {
  addVoidAuditNote,
  flagVoidAuditForManager,
  getVoidAuditDetail,
  listVoidAudits,
  markVoidAuditReviewed,
} from '../controllers/cashier-void-audit-review.controller';

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
  'kitchen',
  'pos_kitchen',
  'kitchen_operations',
  'choma_zone_kds',
  'head_chef',
  'sous_chef',
  'kyogong_spa_cashier',
  'kyogong_executive_bar_cashier',
  'kyogong_sports_bar_cashier',
  'kyogong_reception_cashier',
  'choma_zone_cashier',
  'receptionist',
  'reception',
  'front_desk',
  'front_desk_supervisor',
  'guest_services'
]);

const resolveBootstrapCacheKey = (req: any): string => {
  const userId = String(req.user?.id || 'anonymous');
  const signature = [
    `branch=${String(req.query.branch_id || req.user?.branch_id || 0)}`,
    `outlet=${String(req.query.outlet_id || req.query.outletId || 'auto').trim().toLowerCase()}`,
    `type=${String(req.query.outlet_type || 'all').trim().toLowerCase()}`,
    `selected=${String(req.query.selected_outlet_type || 'auto').trim().toLowerCase()}`,
    `all=${String(req.query.all_outlets || 'false').trim().toLowerCase()}`,
  ].join('|');
  return CacheKeys.posBootstrap(userId, signature);
};

const resolveOutletItemsCacheKey = (req: any): string => {
  const userId = String(req.user?.id || 'anonymous');
  const outletId = String(req.params?.outletId || '').trim().toLowerCase();
  const includeRelated = String(req.query?.include_related ?? req.query?.unified ?? 'false')
    .trim()
    .toLowerCase();
  const sync = String(req.query?.sync || 'false').trim().toLowerCase();
  return `${CacheKeys.posBootstrap(userId, `outlet-items|${outletId}|related=${includeRelated}|sync=${sync}`)}`;
};

router.use(protect);
router.use((req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (req.user?.is_pos_login && req.user?.active_outlet_type) return next();
  if (allowedRoles.has(role)) return next();
  logger.warn(`Forbidden: Outlet POS access denied for user ${req.user?.id} with role ${req.user?.role}`);
  return res.status(403).json({ success: false, message: 'Forbidden: POS outlet access required' });
});

router.get('/printer/status', getPrinterStatus);
router.get('/captain-orders', getBarCaptainOrders);
router.get(
  '/bootstrap',
  withCache(resolveBootstrapCacheKey, CACHE_TTL.POS_BOOTSTRAP, {
    skipCache: (req) => String(req.query.sync || '').toLowerCase() === 'true',
  }),
  getPosBootstrap,
);

// Master bills across outlets (waiter recalls their own orders from any outlet
// and combines them into ONE master bill for the customer; the origin cashier
// settles the whole bill and each outlet cashier confirms their part).
router.get('/waiter/open-bills', getWaiterOpenBills);
router.post('/bills/link', linkOrdersIntoBill);
router.get('/bills/:masterBillId', getConsolidatedBill);
router.post('/bills/:masterBillId/unlink-order', unlinkOrderFromBill);
router.post('/bills/:masterBillId/add-items', addItemsToMasterBill);
router.post('/bills/:masterBillId/transfer-waiter', transferMasterBillWaiter);
router.post('/bills/:masterBillId/move-table', moveMasterBillTable);
router.post('/bills/:masterBillId/pay', payConsolidatedBill);

// Cross-outlet settlement confirmation (outlet cashier confirms/disputes their
// allocated share collected by the origin/settlement cashier).
router.get('/settlements/cross-outlet', getCrossOutletSettlements);
router.post('/settlements/:settlementId/confirm', confirmCrossOutletSettlement);
router.post('/settlements/:settlementId/dispute', disputeCrossOutletSettlement);
router.post('/settlements/:settlementId/resolve', resolveDisputedSettlement);
router.get('/outlets', getOutlets);
router.post('/outlets', createOutlet);
router.get('/staff', getOutletStaff);
router.get(
  '/outlets/:outletId/items',
  withCache(resolveOutletItemsCacheKey, CACHE_TTL.MENU, {
    skipCache: (req) => String(req.query.sync || '').toLowerCase() === 'true',
  }),
  getOutletItems
);
router.post('/outlets/:outletId/items', createOutletItem);
router.patch('/outlets/:outletId/items/:itemId', updateOutletItem);
router.delete('/outlets/:outletId/items/:itemId', deleteOutletItem);
router.post('/outlets/:outletId/sync-items', syncOutletItems);
router.patch('/outlets/:outletId', updateOutlet);
router.get('/outlets/:outletId/shifts/active', getActiveShift);
router.post('/outlets/:outletId/shifts/open', openShift);

// Whole-bill void chain: Kitchen (KDS) ack/decline -> Cashier ack/decline
// (financial effect applied) -> Branch Accountant final review.
router.get('/void-requests/pending/kitchen', getPendingVoidsKitchenWholeBill);
router.patch('/void-requests/:requestId/kitchen-acknowledge', kitchenAcknowledgeVoidRequest);
router.patch('/void-requests/:requestId/kitchen-decline', kitchenDeclineVoidRequest);
router.get('/void-requests/pending/cashier', getPendingVoidsCashierWholeBill);
router.patch('/void-requests/:requestId/cashier-acknowledge', cashierAcknowledgeVoidRequest);
router.patch('/void-requests/:requestId/cashier-decline', cashierDeclineVoidRequest);
router.get('/void-requests/pending', getPendingPosVoidRequests);
router.post('/void-requests/:requestId/review', reviewPosVoidRequest);

// Cashier Void Management — cashier searches a bill and voids it immediately
// (no bartender/waiter request, no separate manager-approval wait).
router.get('/voids/cashier/search', searchVoidableBills);
router.post('/voids/cashier/whole-bill', cashierVoidWholeBill);
router.post('/voids/cashier/items', cashierVoidLineItems);

// Branch Accountant — read-only Void Audit drill-down, populated automatically
// on cashier shift close (see compileShiftVoidAudit).
router.get('/void-audits', listVoidAudits);
router.get('/void-audits/:id', getVoidAuditDetail);
router.patch('/void-audits/:id/review', markVoidAuditReviewed);
router.patch('/void-audits/:id/flag', flagVoidAuditForManager);
router.patch('/void-audits/:id/note', addVoidAuditNote);

router.post('/voids/request', requestItemVoid);
router.patch('/voids/:id/kitchen-acknowledge', kitchenAcknowledgeItemVoid);
router.patch('/voids/:id/kitchen-decline', kitchenDeclineItemVoid);
router.patch('/voids/:id/cashier-acknowledge', cashierAcknowledgeItemVoid);
router.patch('/voids/:id/cashier-decline', cashierDeclineItemVoid);
router.patch('/voids/:id/approve', approveItemVoidRequest);
router.patch('/voids/:id/reject', rejectItemVoidRequest);
router.get('/voids/pending/kitchen', getPendingVoidsKitchen);
router.get('/voids/pending/cashier', getPendingVoidsCashier);
router.get('/voids/pending/manager', getPendingVoidsManager);
router.get('/voids/history', getVoidHistory);
router.get('/voids/shift/:shiftId', getItemVoidRequestsForShift);
router.get('/voids/waiter/:waiterId', getItemVoidHistoryForWaiter);
router.get('/shifts/:shiftId/pending-voids', getPendingItemVoidsForShift);

router.post('/exchanges/request', requestItemExchange);
router.patch('/exchanges/:id/approve', approveItemExchange);
router.patch('/exchanges/:id/reject', rejectItemExchange);
router.patch('/exchanges/:id/issue-refund', issueExchangeRefund);
router.get('/exchanges/pending/cashier', getPendingExchangesCashier);
router.get('/exchanges/history', getExchangeHistory);

router.get('/shifts/:shiftId/orders', getShiftOrders);
router.post('/shifts/:shiftId/orders', recordShiftOrder);
router.post('/shifts/:shiftId/orders/merge', mergeShiftOrders);
router.get('/shifts/:shiftId/orders/:orderId', getShiftOrder);
router.patch('/shifts/:shiftId/orders/:orderId', updateShiftOrder);
router.post('/shifts/:shiftId/orders/:orderId/nullify-zero', nullifyZeroShiftOrder);
router.patch('/shifts/:shiftId/orders/:orderId/captain-printed', markCaptainOrderPrinted);
router.post('/shifts/:shiftId/orders/:orderId/original-printed', markOriginalBillPrinted);
router.post('/shifts/:shiftId/orders/:orderId/reprint-bill', reprintShiftOrderBill);
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
