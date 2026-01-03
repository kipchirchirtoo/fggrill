import { Router } from 'express';
import { getBillDetails, processCashierPayment, verifyPayment } from '../controllers/cashier.controller';
import { protect as authenticate } from '../middleware/auth';

const router = Router();

// Protect all cashier routes
router.use(authenticate);

// Restrict to Cashier and Admin
router.use((req: any, res, next) => {
    if (req.user.role === 'cashier' || req.user.role === 'super_admin' || req.user.role === 'accountant') {
        return next();
    }
    res.status(403).json({ message: 'Forbidden: Cashier access required' });
});

// Get bill details (scan)
router.get('/bill/:bookingId', getBillDetails);

// Process payment
router.post('/pay', processCashierPayment);

// Verify payment
router.post('/verify-payment/:paymentId', verifyPayment);

export default router;
