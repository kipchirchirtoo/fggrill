import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import * as orderController from '../controllers/bar/orders.controller';
import * as menuController from '../controllers/bar/menu.controller';
import * as tabController from '../controllers/bar/tabs.controller';
import * as inventoryController from '../controllers/bar/inventory.controller';
import * as reportController from '../controllers/bar/reports.controller';
import * as stockRequestController from '../controllers/bar/stock-requests.controller';
import * as syncController from '../controllers/bar/sync.controller';
import * as poolTokenController from '../controllers/bar/pool-tokens.controller';
import * as stockLedgerController from '../controllers/bar/stock-ledger.controller';

const router = express.Router();

// Middleware for all bar routes
router.use(protect);
// Allow Bartender, Admin, Manager, Branch Manager
// router.use(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RESTAURANT])); // "Bartender" -> Restaurant?

// ====================
// POOL TABLE TOKENS
// ====================
// console.log('Mounting pool table routes at /bar/pool-table');
router.get('/pool-table/earnings', poolTokenController.getSales);
router.post('/pool-table/tokens', poolTokenController.recordSale);

// ====================
// ORDERS
// ====================
router.get('/orders', orderController.getOrders);
router.get('/orders/:id', orderController.getOrder);
router.post('/orders', orderController.createOrder);
router.put('/orders/:id', orderController.updateOrder);
router.put('/orders/:id/status', orderController.updateOrderStatus);

// ====================
// MENU (Categories & Drinks)
// ====================
router.get('/categories', menuController.getCategories);
router.post('/categories', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]), menuController.createCategory);

router.get('/drinks', menuController.getDrinks);
router.get('/drinks/:id', menuController.getDrink);
router.post('/drinks', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_STOREKEEPER, UserRole.CENTRAL_STOREKEEPER]), menuController.createDrink);
router.put('/drinks/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_STOREKEEPER, UserRole.CENTRAL_STOREKEEPER]), menuController.updateDrink);
router.delete('/drinks/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]), menuController.deleteDrink);
router.put('/drinks/:id/toggle', menuController.toggleDrinkAvailability);
router.post('/drinks/:id/image', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]), menuController.uploadDrinkImage);

// ====================
// TABS
// ====================
router.get('/tabs', tabController.getTabs);
router.post('/tabs', tabController.createTab);
router.put('/tabs/:id', tabController.updateTab);
router.delete('/tabs/:id', tabController.deleteTab);
router.post('/tabs/:id/items', tabController.addToTab);
router.post('/tabs/:id/close', tabController.closeTab);

// ====================
// INVENTORY / STOCK
// ====================
router.post('/stock/sync', syncController.syncFromMaster);
router.get('/stock', inventoryController.getStock);
router.get('/stock/logs', inventoryController.getStockLogs);
router.get('/stock/consumption-report', inventoryController.getConsumptionReport);
router.post('/stock/take', inventoryController.submitStockTake);
router.put('/stock/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER]), inventoryController.updateStock);

// ====================
// STOCK LEDGER (storekeeper-managed bar stock: the table actually
// decremented when a bar sale completes — see decrement_bar_stock())
// ====================
const STOCK_LEDGER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.BRANCH_STOREKEEPER,
  UserRole.CENTRAL_STOREKEEPER
];
router.get('/stock-ledger', authorize(STOCK_LEDGER_ROLES), stockLedgerController.getStockLedger);
router.post('/stock-ledger/:drinkId/restock', authorize(STOCK_LEDGER_ROLES), stockLedgerController.addStock);
router.post('/stock-ledger/stock-take', authorize(STOCK_LEDGER_ROLES), stockLedgerController.submitStockTake);
router.get('/stock-ledger/movements', authorize(STOCK_LEDGER_ROLES), stockLedgerController.getMovements);

// ====================
// REPORTS
// ====================
router.get('/reports/daily-sales', reportController.getDailySales);
router.get('/reports/popular-drinks', reportController.getPopularDrinks);

// ====================
// STOCK REQUESTS
// ====================
router.get('/stock-requests/low-stock', stockRequestController.getLowStockItems);
router.get('/stock-requests', stockRequestController.getStockRequests);
router.post('/stock-requests', stockRequestController.createStockRequest);
router.get('/stock-requests/:id', stockRequestController.getStockRequest);
router.put('/stock-requests/:id/status', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]), stockRequestController.updateRequestStatus);
router.put('/stock-requests/:id/fulfill', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]), stockRequestController.fulfillStockRequest);
router.delete('/stock-requests/:id', stockRequestController.deleteStockRequest);



export default router;
