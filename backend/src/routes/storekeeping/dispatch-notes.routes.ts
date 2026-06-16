import express from 'express';
import { protect } from '../../middleware/auth';
import {
    getDispatchNotes,
    getDispatchNote,
    createDispatchNote,
    updateDispatchStatus,
    dispatchItems,
    confirmDelivery,
    deleteDispatchNote
} from '../../controllers/storekeeping/dispatch-notes.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Dispatch Notes routes
router.get('/incoming', getDispatchNotes); // Alias for incoming dispatches (filtered by branch in controller)
router.route('/')
    .get(getDispatchNotes)
    .post(createDispatchNote);

router.route('/:id')
    .get(getDispatchNote)
    .delete(deleteDispatchNote);

router.put('/:id/status', updateDispatchStatus);
router.put('/:id/dispatch', dispatchItems);
router.put('/:id/confirm-delivery', confirmDelivery);
router.put('/:id/confirm', confirmDelivery);

export default router;
