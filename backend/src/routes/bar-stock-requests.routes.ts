import { Router } from 'express';
import { protect as authenticate } from '../middleware/auth';
import {
  getStockRequests,
  getStockRequest,
  createStockRequest,
  updateRequestStatus,
  fulfillStockRequest,
  getLowStockItems,
  deleteStockRequest
} from '../controllers/bar/stock-requests.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/bar/stock-requests/low-stock
 * @desc    Get low stock items for bar
 * @access  Private (Bartender)
 */
router.get('/low-stock', getLowStockItems);

/**
 * @route   GET /api/bar/stock-requests
 * @desc    Get all stock requests (filtered by role)
 * @access  Private
 */
router.get('/', getStockRequests);

/**
 * @route   POST /api/bar/stock-requests
 * @desc    Create new stock request
 * @access  Private (Bartender)
 */
router.post('/', createStockRequest);

/**
 * @route   GET /api/bar/stock-requests/:id
 * @desc    Get single stock request by ID
 * @access  Private
 */
router.get('/:id', getStockRequest);

/**
 * @route   PUT /api/bar/stock-requests/:id/status
 * @desc    Update request status (approve/reject)
 * @access  Private (Storekeeper/Manager)
 */
router.put('/:id/status', updateRequestStatus);

/**
 * @route   PUT /api/bar/stock-requests/:id/fulfill
 * @desc    Fulfill stock request (mark as delivered)
 * @access  Private (Storekeeper)
 */
router.put('/:id/fulfill', fulfillStockRequest);

/**
 * @route   DELETE /api/bar/stock-requests/:id
 * @desc    Delete stock request (only if pending)
 * @access  Private
 */
router.delete('/:id', deleteStockRequest);

export default router;
