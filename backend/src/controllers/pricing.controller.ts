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
    const {
      checkIn, checkOut, check_in, check_out,
      roomTypeId, room_type_id, roomType,
      guests, adults
    } = req.body;

    const checkInDate = checkIn || check_in;
    const checkOutDate = checkOut || check_out;
    const roomTypeValue = roomTypeId || room_type_id || roomType;
    const guestCount = guests || adults || 1;

    if (!checkInDate || !checkOutDate || !roomTypeValue) {
      throw new AppError(`Missing required fields. Received: checkIn=${checkInDate}, checkOut=${checkOutDate}, roomType=${roomTypeValue}`, 400);
    }

    const quote = await calculateDynamicRate({
      check_in: checkInDate,
      check_out: checkOutDate,
      room_type_id: roomTypeValue,
      guests: guestCount
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
