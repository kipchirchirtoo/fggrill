import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import * as billsController from '../controllers/restaurant-bills.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ============ BILL MANAGEMENT ============

// Create new bill
router.post('/',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]),
  billsController.createBill
);

// Get bill details
router.get('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR]),
  billsController.getBillDetails
);

// Search for open bills
router.post('/search',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.BRANCH_MANAGER]),
  billsController.searchOpenBills
);

// Get all open bills
router.get('/open',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.BRANCH_MANAGER]),
  billsController.getOpenBills
);

// Add order to existing bill
router.post('/:id/orders',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]),
  billsController.addOrderToBill
);

// Close bill (ready for payment)
router.put('/:id/close',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.CASHIER, UserRole.BRANCH_MANAGER]),
  billsController.closeBill
);

// ============ PAYMENT MANAGEMENT ============

// Record payment
router.post('/:id/payments',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CASHIER, UserRole.BRANCH_MANAGER]),
  billsController.recordPayment
);

// Get payment history
router.get('/:id/payments',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CASHIER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT]),
  billsController.getPaymentHistory
);

// Reverse payment (Manager only)
router.post('/:id/payments/:paymentId/reverse',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]),
  billsController.reversePayment
);

// ============ SPLIT BILLS ============

// Split bill by items
router.post('/:id/split/by-items',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.CASHIER, UserRole.BRANCH_MANAGER]),
  billsController.splitBillByItems
);

// ============ MERGE BILLS ============

// Merge bills
router.post('/merge',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.CASHIER, UserRole.BRANCH_MANAGER]),
  billsController.mergeBills
);

// ============ VOID REQUESTS ============

// Request void order (waiter/cashier)
router.post('/orders/:id/void-request',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.CASHIER, UserRole.BRANCH_MANAGER]),
  billsController.requestVoidOrder
);

// Approve void request (accountant/manager)
router.post('/void-requests/:id/approve',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]),
  billsController.approveVoidRequest
);

// Get pending void requests (accountant/manager)
router.get('/void-requests/pending',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT]),
  billsController.getPendingVoidRequests
);

// ============ AUDIT & REPORTING ============

// Get bill audit log
router.get('/:id/audit-log',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT]),
  billsController.getBillAuditLog
);

export default router;
