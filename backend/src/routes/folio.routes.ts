import express from 'express';
import { getFolio, addTransaction } from '../controllers/folio.controller';
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

export default router;
