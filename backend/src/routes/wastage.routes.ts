import { Router } from 'express';
import { protect } from '../middleware/auth';
import {
    createWastageRecord,
    getWastageRecords,
    getWastageSummary,
    bulkCreateWastageRecords,
    updateWastageRecord,
    deleteWastageRecord
} from '../controllers/wastage.controller';

const router = Router();

// All routes require authentication
router.use(protect);

// Wastage routes
router.post('/', createWastageRecord);
router.post('/bulk', bulkCreateWastageRecords);
router.get('/', getWastageRecords);
router.get('/summary', getWastageSummary);
router.put('/:id', updateWastageRecord);
router.delete('/:id', deleteWastageRecord);

export default router;
