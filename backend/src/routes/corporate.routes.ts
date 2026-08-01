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

// Accountant/Admin/Front-Office/POS routes for fetching Corporate Customers
router.get('/customers', authorize([
    UserRole.SUPER_ADMIN, 
    UserRole.DIRECTOR, 
    UserRole.GENERAL_MANAGER, 
    UserRole.BRANCH_MANAGER, 
    UserRole.ACCOUNTANT,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.FINANCE_MANAGER,
    UserRole.RECEPTIONIST,
    UserRole.FRONT_DESK_SUPERVISOR,
    UserRole.CASHIER,
    UserRole.RESTAURANT_CASHIER,
    UserRole.WAITER,
    UserRole.WAITRESS,
    UserRole.BARTENDER
] as any), getCorporateCustomers);

router.post('/customers', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.FINANCE_MANAGER] as any), createCorporateCustomer);
router.put('/customers/:id', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.FINANCE_MANAGER] as any), updateCorporateCustomer);

// Cashier & Receptionist route to charge a bill to corporate credit
router.post('/charge', authorize([
    UserRole.SUPER_ADMIN, 
    UserRole.DIRECTOR,
    UserRole.GENERAL_MANAGER, 
    UserRole.BRANCH_MANAGER, 
    UserRole.ACCOUNTANT,
    UserRole.CASHIER,
    UserRole.RESTAURANT_CASHIER,
    UserRole.RECEPTIONIST,
    UserRole.FRONT_DESK_SUPERVISOR
] as any), chargeCorporateCredit);

// Accountant routes for Invoicing
router.get('/bills/pending', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT] as any), getPendingCorporateBills);
router.post('/invoices/generate', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT] as any), generateCorporateInvoice);
router.get('/invoices', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT] as any), getCorporateInvoices);
router.post('/invoices/:id/pay', authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT] as any), payCorporateInvoice);

export default router;
