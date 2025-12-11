import { Request, Response, NextFunction } from 'express';
import { calculateDynamicRate } from '../services/pricing.service';
import { AppError } from '../middleware/errorHandler';

// @desc    Get dynamic pricing quote
// @route   POST /api/pricing/quote
// @access  Private
export const getPricingQuote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { checkIn, checkOut, roomTypeId, guests } = req.body;

    if (!checkIn || !checkOut || !roomTypeId) {
      throw new AppError('Missing required fields', 400);
    }

    const quote = await calculateDynamicRate({
      check_in: checkIn,
      check_out: checkOut,
      room_type_id: roomTypeId,
      guests: guests || 1
    });

    if (!quote) {
      // Fallback if service is down
      res.status(200).json({
        success: true,
        data: {
          base_price: 0, // Should fetch real base price here if needed
          recommended_price: 0,
          multiplier: 1.0,
          factors: ['Service Unavailable - Default Rate']
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: quote
    });
  } catch (error) {
    next(error);
  }
};
