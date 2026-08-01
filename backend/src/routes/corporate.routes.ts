import { Router } from 'express';
import { 
    getCorporateCustomers,
    createCorporateCustomer,
    updateCorporateCustomer,
    chargeCorporateCredit,
    getPendingCorporateBills,
    generateCorporateInvoice,
    getCorporateInvoices,
    payCorporateInvoice
} from '../controllers/corporate.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();
router.use(protect);

const corporateAccountants = [
    UserRole.SUPER_ADMIN, 
    UserRole.DIRECTOR, 
    UserRole.GENERAL_MANAGER, 
    UserRole.BRANCH_MANAGER, 
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.FINANCE_MANAGER,
    UserRole.AUDITOR
];

// Accountant/Admin/Front-Office/POS routes for fetching Corporate Customers
router.get('/customers', authorize([
    ...corporateAccountants,
    UserRole.RECEPTIONIST,
    UserRole.FRONT_DESK_SUPERVISOR,
    UserRole.CASHIER,
    UserRole.RESTAURANT_CASHIER,
    UserRole.WAITER,
    UserRole.WAITRESS,
    UserRole.BARTENDER
] as any), getCorporateCustomers);

router.post('/customers', authorize(corporateAccountants as any), createCorporateCustomer);
router.put('/customers/:id', authorize(corporateAccountants as any), updateCorporateCustomer);

// Cashier & Receptionist route to charge a bill to corporate credit
router.post('/charge', authorize([
    ...corporateAccountants,
    UserRole.CASHIER,
    UserRole.RESTAURANT_CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.FRONT_DESK_SUPERVISOR
] as any), chargeCorporateCredit);

// Accountant routes for Invoicing
router.get('/bills/pending', authorize(corporateAccountants as any), getPendingCorporateBills);
router.post('/invoices/generate', authorize(corporateAccountants as any), generateCorporateInvoice);
router.get('/invoices', authorize(corporateAccountants as any), getCorporateInvoices);
router.post('/invoices/:id/pay', authorize(corporateAccountants as any), payCorporateInvoice);

export default router;
