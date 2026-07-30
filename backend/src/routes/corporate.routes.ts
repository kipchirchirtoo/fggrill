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

// Accountant/Admin routes for managing Corporate Customers
router.get('/customers', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT] as any), getCorporateCustomers);
router.post('/customers', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT] as any), createCorporateCustomer);
router.put('/customers/:id', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT] as any), updateCorporateCustomer);

// Cashier route to charge a bill to corporate credit
router.post('/charge', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CASHIER] as any), chargeCorporateCredit);

// Accountant routes for Invoicing
router.get('/bills/pending', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT] as any), getPendingCorporateBills);
router.post('/invoices/generate', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT] as any), generateCorporateInvoice);
router.get('/invoices', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT] as any), getCorporateInvoices);
router.post('/invoices/:id/pay', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT] as any), payCorporateInvoice);

export default router;
