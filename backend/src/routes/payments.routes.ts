import { Router } from 'express';
import { PaymentsController } from '../controllers/payments.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
const paymentsController = new PaymentsController();

// All routes require authentication
router.use(protect);

// Get all payments with filters
router.get('/', (req, res) => paymentsController.getPayments(req, res));

// Get payment statistics
router.get('/stats', (req, res) => paymentsController.getPaymentStats(req, res));

// Get single payment by ID
router.get('/:id', (req, res) => paymentsController.getPaymentById(req, res));

// Create new payment
router.post('/', (req, res) => paymentsController.createPayment(req, res));

// Branch Accountant verifies payment
router.put('/:id/verify-accountant', (req, res) => paymentsController.verifyByAccountant(req, res));

// Auditor verifies payment
router.put('/:id/verify-auditor', (req, res) => paymentsController.verifyByAuditor(req, res));

export default router;
