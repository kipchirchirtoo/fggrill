import { Request, Response, NextFunction } from 'express';
import { brevoEmailService } from '../services/brevo-email.service';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

/**
 * Controller for handling email requests specifically from the landing page
 * Uses Brevo API for direct email sending
 */
export const sendLandingConfirmation = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const details = req.body;
        logger.info('📧 Landing page booking confirmation request received');
        logger.info(`Guest: ${details.firstName} ${details.lastName}`);
        logger.info(`Email: ${details.email}`);
        logger.info(`Confirmation: ${details.confirmationNumber}`);
        
        await brevoEmailService.sendLandingBookingConfirmation(details.email, details);

        res.status(200).json({
            success: true,
            message: 'Booking confirmation email sent successfully via Brevo API'
        });
    } catch (error) {
        logger.error('❌ Failed to send landing confirmation email:', error);
        next(error);
    }
};

export const sendLandingReservation = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const details = req.body;
        // TODO: Implement sendLandingReservationRequest in brevoEmailService
        throw new AppError('Reservation request emails not yet implemented', 501);

        res.status(200).json({
            success: true,
            message: 'Reservation request email sent successfully'
        });
    } catch (error) {
        next(error);
    }
};

export const sendLandingPromotion = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { recipients, ...details } = req.body;
        // TODO: Implement sendLandingPromotion in brevoEmailService
        throw new AppError('Promotion emails not yet implemented', 501);

        res.status(200).json({
            success: true,
            message: 'Promotion emails sent successfully'
        });
    } catch (error) {
        next(error);
    }
};

export const sendLandingNewsletter = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { recipients, ...details } = req.body;
        // TODO: Implement sendLandingNewsletter in brevoEmailService
        throw new AppError('Newsletter emails not yet implemented', 501);

        res.status(200).json({
            success: true,
            message: 'Newsletter emails sent successfully'
        });
    } catch (error) {
        next(error);
    }
};
