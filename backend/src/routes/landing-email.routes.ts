import express from 'express';
import {
    sendLandingConfirmation,
    sendLandingReservation,
    sendLandingPromotion,
    sendLandingNewsletter
} from '../controllers/landing-email.controller';

const router = express.Router();

/**
 * Public routes for landing page email triggers
 * These are unauthenticated as the landing page does not have user sessions
 */
router.post('/confirmation', sendLandingConfirmation);
router.post('/reservation', sendLandingReservation);
router.post('/promotion', sendLandingPromotion);
router.post('/newsletter', sendLandingNewsletter);

export default router;
