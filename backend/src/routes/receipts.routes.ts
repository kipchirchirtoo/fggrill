import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  getReceipts,
  getReceiptById,
  createReceipt,
  updateReceipt,
  getDailyRevenue,
  getReceiptStats
} from '../controllers/receipts.controller';

const router = Router();

// All routes require authentication
router.use(protect);

// Get receipts with filters
router.get('/', getReceipts);

// Get receipt statistics
router.get('/stats', getReceiptStats);

// Get daily revenue summary
router.get('/revenue', getDailyRevenue);

// Get single receipt
router.get('/:id', getReceiptById);

// Create new receipt
router.post('/', createReceipt);

// Update receipt
router.put('/:id', updateReceipt);

export default router;
