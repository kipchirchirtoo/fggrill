import { Request, Response, NextFunction } from 'express';
import { Guest } from '../models/Guest';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// @desc    Get all guests
// @route   GET /api/guests
// @access  Private
export const getGuests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const search = req.query.search as string;
    
    if (search) {
      const guests = await Guest.search(search);
      res.status(200).json({
        success: true,
        count: guests.length,
        data: guests
      });
      return;
    }
    
    // Default to recent guests if no search (limit 20 from model)
    const guests = await Guest.search('');
    res.status(200).json({
      success: true,
      count: guests.length,
      data: guests
    });
  } catch (error) {
    next(new AppError('Failed to fetch guests', 500));
  }
};

// @desc    Get single guest
// @route   GET /api/guests/:id
// @access  Private
export const getGuest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const guest = await Guest.findById(req.params.id);
    
    if (!guest) {
      throw new AppError('Guest not found', 404);
    }

    res.status(200).json({
      success: true,
      data: guest
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create guest
// @route   POST /api/guests
// @access  Private
export const createGuest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const guest = new Guest(req.body);
    const savedGuest = await guest.save();
    
    res.status(201).json({
      success: true,
      data: savedGuest
    });
    
    logger.info(`New guest created: ${savedGuest.id}`);
  } catch (error) {
    next(new AppError('Failed to create guest', 500));
  }
};

// @desc    Update guest
// @route   PUT /api/guests/:id
// @access  Private
export const updateGuest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const existingGuest = await Guest.findById(req.params.id);
    
    if (!existingGuest) {
      throw new AppError('Guest not found', 404);
    }

    // Merge existing data with updates
    const updatedGuest = new Guest({
      ...existingGuest,
      ...req.body,
      id: req.params.id // Ensure ID doesn't change
    });
    
    const savedGuest = await updatedGuest.save();

    res.status(200).json({
      success: true,
      data: savedGuest
    });
    
    logger.info(`Guest updated: ${savedGuest.id}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete guest
// @route   DELETE /api/guests/:id
// @access  Private (Admin only)
export const deleteGuest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const guest = await Guest.findById(req.params.id);
    
    if (!guest) {
      throw new AppError('Guest not found', 404);
    }

    await guest.delete();

    res.status(200).json({
      success: true,
      data: {}
    });
    
    logger.info(`Guest deleted: ${req.params.id}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Update guest preferences
// @route   PUT /api/guests/:id/preferences
// @access  Private
export const updateGuestPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const guest = await Guest.findById(req.params.id);
    
    if (!guest) {
      throw new AppError('Guest not found', 404);
    }

    guest.preferences = { ...guest.preferences, ...req.body.preferences };
    const savedGuest = await guest.save();

    res.status(200).json({
      success: true,
      data: savedGuest.preferences
    });
    
    logger.info(`Guest preferences updated: ${req.params.id}`);
  } catch (error) {
    next(error);
  }
};
