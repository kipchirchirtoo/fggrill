import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

// Import controllers
import {
    getPurchaseOrders,
    getPurchaseOrder,
    createPurchaseOrder,
    approvePurchaseOrder,
    cancelPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder
} from '../controllers/storekeeping/purchase-orders.controller';

import {
    getGRNs,
    getGRN,
    createGRN,
    approveGRN,
    cancelGRN
} from '../controllers/storekeeping/grn.controller';

import {
    getInvoices,
    getInvoice,
    createInvoice,
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
    getAuditTrail
} from '../controllers/storekeeping/supplier-reports.controller';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Role abbreviations
const procurementRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.PROCUREMENT, UserRole.PURCHASING_MANAGER];
const storeRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.STOREKEEPER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER];
const auditorRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR, UserRole.ACCOUNTANT];
const allProcurementStaff = [...procurementRoles, ...storeRoles, ...auditorRoles];

// =====================================================
// PURCHASE ORDERS
// =====================================================
router.route('/purchase-orders')
    .get(authorize(allProcurementStaff), getPurchaseOrders)
    .post(authorize(procurementRoles), createPurchaseOrder);

router.route('/purchase-orders/:id')
    .get(authorize(allProcurementStaff), getPurchaseOrder)
    .put(authorize(procurementRoles), updatePurchaseOrder)
    .delete(authorize(procurementRoles), deletePurchaseOrder);

router.put('/purchase-orders/:id/approve', authorize(procurementRoles), approvePurchaseOrder);
router.put('/purchase-orders/:id/cancel', authorize(procurementRoles), cancelPurchaseOrder);

// =====================================================
// GOODS RECEIVED NOTES (GRN)
// =====================================================
router.route('/grn')
    .get(authorize(allProcurementStaff), getGRNs)
    .post(authorize(storeRoles), createGRN);

router.route('/grn/:id')
    .get(authorize(allProcurementStaff), getGRN);

router.put('/grn/:id/approve', authorize(auditorRoles), approveGRN);
router.put('/grn/:id/cancel', authorize(storeRoles), cancelGRN);

// =====================================================
// SUPPLIER INVOICES
// =====================================================
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
    .post(authorize(auditorRoles), createPayment); // Finance/Auditor usually initiates payments

router.route('/payments/:id')
    .get(authorize(allProcurementStaff), getPayment);

router.put('/payments/:id/process', authorize(auditorRoles), processPayment);

// =====================================================
// REPORTS & COMPLIANCE
// =====================================================
router.get('/reports/aging', authorize(auditorRoles), getAgingAnalysis);
router.get('/reports/vat', authorize(auditorRoles), getVATReport);
router.get('/reports/grni', authorize(auditorRoles), getGRNIReport);
router.get('/reports/audit-trail', authorize(auditorRoles), getAuditTrail);

export default router;
