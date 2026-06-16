import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { validateModuleAccess, enforceBranchScoping, SourceModule } from '../middleware/moduleAccess';
import { validateBody, validateQuery, validateParams } from '../middleware/validation';
import { CreatePOSchema, UpdatePOSchema, QueryPOSchema, POIdSchema } from '../schemas/purchaseOrder.schema';

// Import controllers
import {
    getPurchaseOrders,
    getPurchaseOrder,
    createPurchaseOrder,
    approvePurchaseOrder,
    cancelPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    sendPurchaseOrderToSupplier
} from '../controllers/storekeeping/purchase-orders.controller';

import {
    getGRNs,
    getGRN,
    createGRN,
    approveGRN,
    cancelGRN,
    printGRN,
    backfillGRNStock
} from '../controllers/storekeeping/grn.controller';

import {
    getInvoices,
    getInvoice,
    createInvoice,
    getReadyToBillGRNs,
    submitInvoice,
    approveInvoice,
    rejectInvoice
} from '../controllers/storekeeping/supplier-invoices.controller';

import {
    getPayments,
    getPayment,
    createPayment,
    processPayment
} from '../controllers/storekeeping/supplier-payments.controller';

import {
    getAgingAnalysis,
    getVATReport,
    getGRNIReport,
    getAuditTrail,
    getSupplierLedger,
    getSupplierPerformance
} from '../controllers/storekeeping/supplier-reports.controller';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Role abbreviations
const procurementRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.PROCUREMENT,
    UserRole.PURCHASING_MANAGER,
    UserRole.CENTRAL_STOREKEEPER,
    UserRole.BRANCH_STOREKEEPER,
    UserRole.BRANCH_ACCOUNTANT
];
const storeRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.STOREKEEPER,
    UserRole.CENTRAL_STOREKEEPER,
    UserRole.BRANCH_STOREKEEPER
];
const auditorRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.AUDITOR,
    UserRole.ACCOUNTANT,
    UserRole.FINANCE_MANAGER
];
const allProcurementStaff = [...new Set([...procurementRoles, ...storeRoles, ...auditorRoles])];


// =====================================================
// PURCHASE ORDERS
// =====================================================
router.route('/purchase-orders')
    .get(
        authorize(allProcurementStaff), 
        validateModuleAccess([SourceModule.CENTRAL_STORE, SourceModule.BRANCH_STORE, SourceModule.BRANCH_ACCOUNTING]),
        enforceBranchScoping,
        validateQuery(QueryPOSchema),
        getPurchaseOrders
    )
    .post(
        authorize(procurementRoles), 
        validateModuleAccess([SourceModule.CENTRAL_STORE, SourceModule.BRANCH_STORE, SourceModule.BRANCH_ACCOUNTING]),
        enforceBranchScoping,
        validateBody(CreatePOSchema),
        createPurchaseOrder
    );

router.route('/purchase-orders/:id')
    .get(
        authorize(allProcurementStaff), 
        validateModuleAccess([SourceModule.CENTRAL_STORE, SourceModule.BRANCH_STORE, SourceModule.BRANCH_ACCOUNTING]),
        enforceBranchScoping,
        validateParams(POIdSchema),
        getPurchaseOrder
    )
    .put(
        authorize(procurementRoles), 
        validateModuleAccess([SourceModule.CENTRAL_STORE, SourceModule.BRANCH_STORE, SourceModule.BRANCH_ACCOUNTING]),
        enforceBranchScoping,
        validateParams(POIdSchema),
        validateBody(UpdatePOSchema),
        updatePurchaseOrder
    )
    .delete(
        authorize(procurementRoles), 
        validateModuleAccess([SourceModule.CENTRAL_STORE, SourceModule.BRANCH_STORE, SourceModule.BRANCH_ACCOUNTING]),
        enforceBranchScoping,
        validateParams(POIdSchema),
        deletePurchaseOrder
    );

router.put('/purchase-orders/:id/approve', 
    authorize(procurementRoles), 
    validateModuleAccess([SourceModule.CENTRAL_STORE, SourceModule.BRANCH_STORE, SourceModule.BRANCH_ACCOUNTING]),
    enforceBranchScoping,
    validateParams(POIdSchema),
    approvePurchaseOrder
);

router.put('/purchase-orders/:id/cancel', 
    authorize(procurementRoles), 
    validateModuleAccess([SourceModule.CENTRAL_STORE, SourceModule.BRANCH_STORE, SourceModule.BRANCH_ACCOUNTING]),
    enforceBranchScoping,
    validateParams(POIdSchema),
    cancelPurchaseOrder
);

router.post('/purchase-orders/:id/send', 
    authorize(procurementRoles), 
    validateModuleAccess([SourceModule.CENTRAL_STORE, SourceModule.BRANCH_STORE, SourceModule.BRANCH_ACCOUNTING]),
    enforceBranchScoping,
    validateParams(POIdSchema),
    sendPurchaseOrderToSupplier
);

// =====================================================
// GOODS RECEIVED NOTES (GRN)
// =====================================================
router.post('/grn/backfill-stock', authorize(allProcurementStaff), backfillGRNStock);

router.route('/grn')
    .get(authorize(allProcurementStaff), getGRNs)
    .post(authorize(storeRoles), createGRN);

router.route('/grn/:id')
    .get(authorize(allProcurementStaff), getGRN);

router.get('/grn/:id/pdf', authorize(allProcurementStaff), printGRN);
router.put('/grn/:id/approve', authorize(auditorRoles), approveGRN);
router.put('/grn/:id/cancel', authorize(storeRoles), cancelGRN);

// =====================================================
// SUPPLIER INVOICES
// =====================================================
router.get('/ready-to-bill', authorize(allProcurementStaff), getReadyToBillGRNs);

router.route('/invoices')
    .get(authorize(allProcurementStaff), getInvoices)
    .post(authorize(procurementRoles), createInvoice);

router.route('/invoices/:id')
    .get(authorize(allProcurementStaff), getInvoice);

router.put('/invoices/:id/submit', authorize(procurementRoles), submitInvoice);
router.put('/invoices/:id/approve', authorize(auditorRoles), approveInvoice);
router.put('/invoices/:id/reject', authorize(auditorRoles), rejectInvoice);

// =====================================================
// SUPPLIER PAYMENTS
// =====================================================
router.route('/payments')
    .get(authorize(allProcurementStaff), getPayments)
    .post(authorize([...auditorRoles, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_ACCOUNTANT, UserRole.STOREKEEPER, UserRole.PROCUREMENT]), createPayment); // Finance/Auditor/Storekeepers initiates payments

router.route('/payments/:id')
    .get(authorize(allProcurementStaff), getPayment);

router.put(
    '/payments/:id/process',
    authorize([...auditorRoles, UserRole.BRANCH_ACCOUNTANT]),
    processPayment
);

// =====================================================
// REPORTS & COMPLIANCE
// =====================================================
router.get('/reports/aging', authorize(allProcurementStaff), getAgingAnalysis);
router.get('/reports/vat', authorize(allProcurementStaff), getVATReport);
router.get('/reports/grni', authorize(allProcurementStaff), getGRNIReport);
router.get('/reports/audit-trail', authorize(allProcurementStaff), getAuditTrail);
router.get('/ledger/:supplierId', authorize(allProcurementStaff), getSupplierLedger);
router.get('/performance/:supplierId', authorize(allProcurementStaff), getSupplierPerformance);

export default router;
