import express from 'express';
import {
  getFolio,
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from '../controllers/folio.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

router.use(protect);

router.get('/reservation/:reservationId', 
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]),
  getFolio
);

router.post('/reservation/:reservationId/transaction',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]),
  addTransaction
);

router.put('/reservation/:reservationId/transaction/:transactionId',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]),
  updateTransaction
);

router.delete('/reservation/:reservationId/transaction/:transactionId',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]),
  deleteTransaction
);

export default router;
