import { Router } from 'express';
import {
    getBillDetails,
    processCashierPayment,
    printCashierReceiptFallback,
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
    recordStaffPaidBill,
    getStaffPaidBills,
    approvePaidBill,
    rejectPaidBill,
    deductCreditBillFromPayroll,
    downloadCustomerCreditInvoice,
    downloadCustomerCreditOutstandingReport,
    getCashierShifts,
    startShift,
    closeShift,
    getCashierStats,
    getCashierLogbookToday,
    saveCashierLogbook,
    submitLogbookForAudit,
    getLogbooksForAudit,
    getCashierLogbookDetail,
    downloadCashierLogbookReport,
    auditLogbook,
    getCashierPOSItems,
    createPOSTransaction,
    initiatePOSTransactionPayment,
    getPOSReconciliation,
    getRecentTransactions,
    getUnpaidPosOrders,
    getUnpaidWaiterOrders,
    markWaiterOrderPaid
} from '../controllers/cashier.controller';
import {
    getShiftLogs,
    getShiftLog,
    startShift as startNewShift,
    closeShift as closeShiftLog,
    approveShiftOpening,
    rejectShiftOpening,
    reconcileShift,
    verifyShift,
    addShiftTransaction
} from '../controllers/cashier-shifts.controller';
import { protect as authenticate, authorize } from '../middleware/auth';
import { optionalIdempotency } from '../middleware/idempotency';
import { UserRole } from '../models/User';
import { logger } from '../utils/logger';

const router = Router();

// Protect all cashier routes
router.use(authenticate);

// Restrict to Cashier, Admin and related roles
router.use((req: any, res, next) => {
    const allowedRoles = [
        'cashier',
        'restaurant_cashier',
        'main_bar_cashier',
        'executive_bar_cashier',
        'non_consumables_cashier',
        'super_admin',
        'accountant',
        'branch_accountant',
        'receptionist',
        'branch_manager',
        'bartender',
        'waiter',
        'restaurant_manager',
        'auditor',
        'general_manager',
        'director',
        'hr_manager',
        'finance_manager',
        'night_auditor',
        'kyogong_spa_cashier',
        'kyogong_executive_bar_cashier',
        'kyogong_sports_bar_cashier',
        'kyogong_reception_cashier',
        // Storekeepers need read access to shifts for the opening-stock gate
        'branch_storekeeper',
        'central_storekeeper',
        'storekeeper'
    ];
    const userRole = req.user?.role?.toString().toLowerCase();
    if (userRole && allowedRoles.includes(userRole)) {
        return next();
    }

    logger.warn(`Forbidden: Cashier access denied for user ${req.user?.id} with role ${req.user?.role}`);
    res.status(403).json({ message: 'Forbidden: Cashier access required' });
});

// ============================================
// LOGBOOK ROUTES
// ============================================
router.get('/logbook/today', getCashierLogbookToday);
router.post('/logbook', saveCashierLogbook);
router.post('/logbook/:id/submit', submitLogbookForAudit);
router.get('/logbook/pending', authorize(['auditor', UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.FINANCE_MANAGER, UserRole.NIGHT_AUDITOR] as any), getLogbooksForAudit);
router.get('/logbook/:id', authorize(['auditor', UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.FINANCE_MANAGER, UserRole.NIGHT_AUDITOR] as any), getCashierLogbookDetail);
router.get('/logbook/:id/pdf', authorize(['auditor', UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.FINANCE_MANAGER, UserRole.NIGHT_AUDITOR] as any), downloadCashierLogbookReport);
router.post('/logbook/:id/audit', authorize(['auditor', UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.HR_MANAGER, UserRole.FINANCE_MANAGER, UserRole.NIGHT_AUDITOR] as any), auditLogbook);

// ============================================
// EXISTING ROUTES
// ============================================

// Get bill details (scan)
router.get('/bill/:bookingId', getBillDetails);

// Process payment
router.post('/pay', processCashierPayment);
router.post('/print-receipt-fallback', printCashierReceiptFallback);

// Verify payment
router.post('/verify-payment/:paymentId', verifyPayment);

// ============================================
// POS TRANSACTIONS ROUTES
// ============================================

router.get('/pos/items', getCashierPOSItems);

router.route('/pos/transactions')
    .post(
        optionalIdempotency({
            scope: 'cashier.create-pos-transaction',
            resourceResolver: (body) => ({
                resourceId: body?.data?.transaction_id || body?.data?.transactionId || body?.data?.id || null,
                resourceType: 'pos_transaction'
            })
        }),
        createPOSTransaction
    );

router.post(
    '/pos/transactions/:id/pay',
    optionalIdempotency({
        scope: 'cashier.pay-pos-transaction',
        resourceResolver: (body) => ({
            resourceId: body?.data?.payment?.id || body?.data?.payment_id || null,
            resourceType: 'pos_payment'
        })
    }),
    initiatePOSTransactionPayment
);
router.get('/pos/reconciliation', getPOSReconciliation);
router.get('/recent-transactions', getRecentTransactions);

// ============================================
// UNPAID WAITER ORDERS ROUTES
// ============================================

router.get('/unpaid-pos-orders', getUnpaidPosOrders);
router.get('/unpaid-orders', getUnpaidWaiterOrders);
router.patch('/unpaid-orders/:source/:id/pay', markWaiterOrderPaid);

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

router.get('/unpaid-bills/:id/pdf', downloadCustomerCreditInvoice);
router.get('/unpaid-bills/outstanding/pdf', downloadCustomerCreditOutstandingReport);

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

// Paid bills: cashier records staff settling money toward their credit during
// the shift (search staff, amount, method). Flows to the branch accountant at
// shift close to reduce outstanding staff credit bills.
router.route('/paid-bills')
    .get(getStaffPaidBills)
    .post(recordStaffPaidBill);

// Approve/Reject paid bills (Branch Accountant only)
router.route('/shifts/:shift_id/paid-bills/:paid_bill_id/approve')
    .post(
        authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, 'branch_accountant'] as any),
        approvePaidBill
    );

router.route('/shifts/:shift_id/paid-bills/:paid_bill_id/reject')
    .post(
        authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, 'branch_accountant'] as any),
        rejectPaidBill
    );

router.route('/credit-bills/:id/payroll-deduct')
    .post(
        authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, 'branch_accountant'] as any),
        deductCreditBillFromPayroll
    );

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

router.route('/shifts/:id/approve-open')
    .put(authorize([UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN] as any), approveShiftOpening);

router.route('/shifts/:id/reject-open')
    .put(authorize([UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN] as any), rejectShiftOpening);

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
