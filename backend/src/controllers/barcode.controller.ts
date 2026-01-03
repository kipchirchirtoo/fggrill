import { Request, Response, NextFunction } from 'express';
import { barcodeGeneratorService } from '../services/barcodeGenerator.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// @desc    Generate barcode for booking ID
// @route   POST /api/barcode/generate
// @access  Public
export const generateBarcode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { booking_id, format = 'code128', include_text = true } = req.body;

    if (!booking_id) {
      throw new AppError('Booking ID is required', 400);
    }

    const barcode = await barcodeGeneratorService.generateBarcode(
      booking_id,
      format,
      include_text
    );

    if (!barcode) {
      throw new AppError('Failed to generate barcode', 500);
    }

    res.status(200).json({
      success: true,
      data: {
        barcode,
        booking_id,
        format: 'image/png'
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Generate QR code for booking
// @route   POST /api/barcode/generate-qr
// @access  Public
export const generateQRCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { booking_id, booking_url } = req.body;

    if (!booking_id) {
      throw new AppError('Booking ID is required', 400);
    }

    const qrCode = await barcodeGeneratorService.generateQRCode(
      booking_id,
      booking_url
    );

    if (!qrCode) {
      throw new AppError('Failed to generate QR code', 500);
    }

    res.status(200).json({
      success: true,
      data: {
        qr_code: qrCode,
        booking_id,
        format: 'image/png'
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Generate booking card with barcode
// @route   POST /api/barcode/generate-card
// @access  Public
export const generateBookingCard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const bookingData = req.body;

    if (!bookingData.booking_id) {
      throw new AppError('Booking data with booking_id is required', 400);
    }

    const bookingCard = await barcodeGeneratorService.generateBookingCard(bookingData);

    if (!bookingCard) {
      throw new AppError('Failed to generate booking card', 500);
    }

    res.status(200).json({
      success: true,
      data: {
        booking_card: bookingCard,
        booking_id: bookingData.booking_id,
        format: 'image/png'
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get barcode image URL
// @route   GET /api/barcode/image-url/:bookingId
// @access  Public
export const getBarcodeImageUrl = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const { format = 'code128', include_text = 'true' } = req.query;

    if (!bookingId) {
      throw new AppError('Booking ID is required', 400);
    }

    const imageUrl = barcodeGeneratorService.getBarcodeImageUrl(
      bookingId,
      format as string,
      include_text === 'true'
    );

    res.status(200).json({
      success: true,
      data: {
        image_url: imageUrl,
        booking_id: bookingId
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Test barcode service connection
// @route   GET /api/barcode/health
// @access  Public
export const testBarcodeService = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const isHealthy = await barcodeGeneratorService.testConnection();

    res.status(200).json({
      success: true,
      data: {
        service: 'barcode_generator',
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    next(error);
  }
};
