import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { globalSearch } from '../controllers/search.controller';

const router = express.Router();

// Global search endpoint
router.get('/', authenticate, globalSearch);

export default router;
