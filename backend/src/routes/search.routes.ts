import express from 'express';
import { protect } from '../middleware/auth.middleware';
import { globalSearch } from '../controllers/search.controller';

const router = express.Router();

// Global search endpoint
router.get('/', protect, globalSearch);

export default router;
