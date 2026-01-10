import { Router } from 'express';
import {
    getBillDetails,
    processCashierPayment,
    verifyPayment,
    getUnpaidBills,
    createUnpaidBill,
    recordBillPayment,
    confirmUnpaidBill,
    getCreditBills,
    createCreditBill,
    confirmCreditBill,
    recordCreditPayment,
    getCashierShifts,
    startShift,
    closeShift,
    getCashierStats
} from '../controllers/cashier.controller';
import { protect as authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

// Protect all cashier routes
router.use(authenticate);

// Restrict to Cashier and Admin
router.use((req: any, res, next) => {
    const allowedRoles = ['cashier', 'super_admin', 'accountant', 'branch_accountant', 'receptionist', 'branch_manager'];
    if (allowedRoles.includes(req.user.role)) {
        return next();
    }
    res.status(403).json({ message: 'Forbidden: Cashier access required' });
});

// ============================================
// EXISTING ROUTES
// ============================================

// Get bill details (scan)
router.get('/bill/:bookingId', getBillDetails);

// Process payment
router.post('/pay', processCashierPayment);

// Verify payment
router.post('/verify-payment/:paymentId', verifyPayment);

// ============================================
// UNPAID BILLS ROUTES
// ============================================

router.route('/unpaid-bills')
    .get(getUnpaidBills)
    .post(createUnpaidBill);

router.route('/unpaid-bills/:id/payment')
    .post(recordBillPayment);

router.route('/unpaid-bills/:id/confirm')
    .patch(
        authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, 'auditor', 'branch_accountant'] as any),
        confirmUnpaidBill
    );

// ============================================
// CREDIT BILLS ROUTES
// ============================================

router.route('/credit-bills')
    .get(getCreditBills)
    .post(createCreditBill);

router.route('/credit-bills/:id/confirm')
    .patch(
        authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, 'auditor', 'branch_accountant'] as any),
        confirmCreditBill
    );

router.route('/credit-bills/:id/payment')
    .post(recordCreditPayment);

// ============================================
// CASHIER SHIFTS ROUTES
// ============================================

router.route('/shifts')
    .get(getCashierShifts)
    .post(startShift);

router.route('/shifts/:id/close')
    .post(closeShift);

// ============================================
// DASHBOARD STATS
// ============================================

router.route('/stats')
    .get(getCashierStats);

export default router;
