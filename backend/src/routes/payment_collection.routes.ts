import { Router } from 'express';
import { receivePayment, searchInvoices } from '../controllers/payment_collection.controller';
import { reversePayment } from '../controllers/reversals.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Protect all routes
router.use(authorize('cashier', 'branch_manager', 'director', 'super_admin'));

// Main Collection Point
router.post('/receive', receivePayment);

// Search Invoices
router.get('/invoices/search', searchInvoices);

// Reversals (Usually requires a higher level of approval or just cashier)
router.post('/reverse/:receiptId', reversePayment);

export default router;
