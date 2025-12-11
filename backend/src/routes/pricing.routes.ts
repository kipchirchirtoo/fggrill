import express from 'express';
import { getPricingQuote } from '../controllers/pricing.controller';
import { protect } from '../middleware/auth';

const router = express.Router();

router.use(protect);

router.post('/quote', getPricingQuote);

export default router;
