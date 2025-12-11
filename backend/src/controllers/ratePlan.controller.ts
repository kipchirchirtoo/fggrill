import { Request, Response, NextFunction } from 'express';
import { RatePlan } from '../models/RatePlan';
import { AppError } from '../middleware/errorHandler';

// @desc    Get all rate plans
// @route   GET /api/rate-plans
// @access  Private
export const getRatePlans = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ratePlans = await RatePlan.findAll();
    res.status(200).json({
      success: true,
      count: ratePlans.length,
      data: ratePlans
    });
  } catch (error) {
    next(new AppError('Failed to fetch rate plans', 500));
  }
};

// @desc    Get single rate plan
// @route   GET /api/rate-plans/:id
// @access  Private
export const getRatePlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ratePlan = await RatePlan.findById(req.params.id);
    if (!ratePlan) {
      throw new AppError('Rate plan not found', 404);
    }
    res.status(200).json({
      success: true,
      data: ratePlan
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create rate plan
// @route   POST /api/rate-plans
// @access  Private (Admin)
export const createRatePlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ratePlan = new RatePlan(req.body);
    const savedRatePlan = await ratePlan.save();
    
    res.status(201).json({
      success: true,
      data: savedRatePlan
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update rate plan
// @route   PUT /api/rate-plans/:id
// @access  Private (Admin)
export const updateRatePlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ratePlan = await RatePlan.findById(req.params.id);
    if (!ratePlan) {
      throw new AppError('Rate plan not found', 404);
    }

    Object.assign(ratePlan, req.body);
    const updatedRatePlan = await ratePlan.save();

    res.status(200).json({
      success: true,
      data: updatedRatePlan
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete rate plan
// @route   DELETE /api/rate-plans/:id
// @access  Private (Admin)
export const deleteRatePlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ratePlan = await RatePlan.findById(req.params.id);
    if (!ratePlan) {
      throw new AppError('Rate plan not found', 404);
    }

    await ratePlan.delete();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};
