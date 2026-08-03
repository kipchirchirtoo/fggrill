import express from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import {
    listOffers,
    getActiveOffers,
    createOffer,
    updateOffer,
    toggleOffer,
    deleteOffer,
} from '../controllers/offers.controller';

const router = express.Router();

// Mounted at /api/offers in routes/index.ts — paths here are relative.
router.use(protect);

// Managers who may create / manage offers.
const MANAGERS = [
    UserRole.BRANCH_MANAGER,
    UserRole.GENERAL_MANAGER,
    UserRole.SUPER_ADMIN,
    UserRole.RESTAURANT_MANAGER,
];

// Active offers — read-only, available to any authenticated user (POS tills,
// reception, cashiers) so offers can be surfaced and applied.
router.get('/active', getActiveOffers);

// Management (Branch Manager and up).
router.get('/', authorize(MANAGERS), listOffers);
router.post('/', authorize(MANAGERS), createOffer);
router.put('/:id', authorize(MANAGERS), updateOffer);
router.patch('/:id/toggle', authorize(MANAGERS), toggleOffer);
router.delete('/:id', authorize(MANAGERS), deleteOffer);

export default router;
