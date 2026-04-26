/**
 * Buffet Routes
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getBuffets,
  getBuffet,
  createBuffet,
  updateBuffet,
  openBuffet,
  closeBuffet,
  addMenuItems,
  removeMenuItem,
  cancelBuffet
} from '../controllers/buffet.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Buffet CRUD
router.get('/', getBuffets);
router.get('/:id', getBuffet);
router.post('/', createBuffet);
router.put('/:id', updateBuffet);

// Buffet actions
router.post('/:id/open', openBuffet);
router.post('/:id/close', closeBuffet);
router.post('/:id/cancel', cancelBuffet);

// Menu items
router.post('/:id/menu-items', addMenuItems);
router.delete('/:id/menu-items/:itemId', removeMenuItem);

export default router;
