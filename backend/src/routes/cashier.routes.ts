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
    getLoans,
    getAdvances,
    createCreditBill,
    confirmCreditBill,
    recordCreditPayment,
    getCashierShifts,
    startShift,
    closeShift,
    getCashierStats,
    getCashierLogbookToday,
    saveCashierLogbook,
    submitLogbookForAudit,
    getLogbooksForAudit,
    auditLogbook,
    createPOSTransaction,
    initiatePOSTransactionPayment,
    getPOSReconciliation
} from '../controllers/cashier.controller';
import {
    getShiftLogs,
    getShiftLog,
    startShift as startNewShift,
    closeShift as closeShiftLog,
    reconcileShift,
    verifyShift,
    addShiftTransaction
} from '../controllers/cashier-shifts.controller';
import { protect as authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

// Protect all cashier routes
router.use(authenticate);

// Restrict to Cashier, Admin and related roles
router.use((req: any, res, next) => {
    const allowedRoles = [
        'cashier',
        'super_admin',
        'accountant',
        'branch_accountant',
        'receptionist',
        'branch_manager',
        'bartender',
        'waiter',
        'restaurant_manager',
        'auditor',
        'general_manager'
    ];
    if (allowedRoles.includes(req.user.role)) {
        return next();
    }
    res.status(403).json({ message: 'Forbidden: Cashier access required' });
});

// ============================================
// LOGBOOK ROUTES
// ============================================
router.get('/logbook/today', getCashierLogbookToday);
router.post('/logbook', saveCashierLogbook);
router.post('/logbook/:id/submit', submitLogbookForAudit);
router.get('/logbook/pending', authorize(['auditor', UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT] as any), getLogbooksForAudit);
router.post('/logbook/:id/audit', authorize(['auditor', UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT] as any), auditLogbook);

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
// POS TRANSACTIONS ROUTES
// ============================================

router.route('/pos/transactions')
    .post(createPOSTransaction);

router.post('/pos/transactions/:id/pay', initiatePOSTransactionPayment);
router.get('/pos/reconciliation', getPOSReconciliation);

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

router.route('/credit-bills/loans')
    .get(getLoans);

router.route('/credit-bills/advances')
    .get(getAdvances);

router.route('/credit-bills/:id/confirm')
    .patch(
        authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, 'auditor', 'branch_accountant'] as any),
        confirmCreditBill
    );

router.route('/credit-bills/:id/payment')
    .post(recordCreditPayment);

// ============================================
// CASHIER SHIFTS ROUTES (New Shift Logbook System)
// ============================================

router.route('/shifts')
    .get(getShiftLogs)
    .post(startNewShift);

router.route('/shifts/start')
    .post(startNewShift);

router.route('/shifts/:id')
    .get(getShiftLog);

router.route('/shifts/:id/close')
    .put(closeShiftLog);

router.route('/shifts/:id/reconcile')
    .put(authorize([UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.SUPER_ADMIN] as any), reconcileShift);

router.route('/shifts/:id/verify')
    .put(authorize(['auditor', UserRole.SUPER_ADMIN] as any), verifyShift);

router.route('/shifts/:id/transactions')
    .post(addShiftTransaction);

// ============================================
// DASHBOARD STATS
// ============================================

router.route('/stats')
    .get(getCashierStats);

export default router;
