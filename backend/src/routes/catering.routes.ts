/**
 * Catering Routes
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getCateringEvents,
  getCateringEvent,
  createCateringEvent,
  updateCateringEvent,
  allocateStock,
  recordActual,
  completeEvent,
  cancelEvent,
  addMenuItems
} from '../controllers/catering.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Catering event CRUD
router.get('/events', getCateringEvents);
router.get('/events/:id', getCateringEvent);
router.post('/events', createCateringEvent);
router.put('/events/:id', updateCateringEvent);

// Catering event actions
router.post('/events/:id/allocate-stock', allocateStock);
router.post('/events/:id/record-actual', recordActual);
router.post('/events/:id/complete', completeEvent);
router.post('/events/:id/cancel', cancelEvent);

// Menu items
router.post('/events/:id/menu-items', addMenuItems);

export default router;
