/**
 * Shift P&L Controller
 * 
 * Handles shift-level Profit & Loss statements and workflow
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import {
  generateShiftPnL,
  submitForAccountantReview,
  accountantApprove,
  auditorAction,
  getShiftPnL,
  getShiftPnLs,
  getMultiShiftSummary,
  getFoodCostTrend
} from '../services/shiftPnLService';
import { ReviewShiftPnLInput, ApproveShiftPnLInput } from '../types/foodControl';

/**
 * @desc    Generate or refresh shift P&L
 * @route   POST /api/v1/finance/shift-pnl/generate/:shiftId
 * @access  Private (System, Manager, Accountant)
 */
export const generatePnL = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { shiftId } = req.params;
    const branchId = (req as any).user?.branch_id;

    const pnl = await generateShiftPnL(parseInt(shiftId), branchId);

    res.json({
      success: true,
      data: pnl,
      message: 'Shift P&L generated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get shift P&L
 * @route   GET /api/v1/finance/shift-pnl/:shiftId
 * @access  Private (Accountant, Auditor, Manager)
 */
export const getPnL = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { shiftId } = req.params;

    const pnl = await getShiftPnL(parseInt(shiftId));

    if (!pnl) {
      throw new AppError('Shift P&L not found', 404);
    }

    res.json({
      success: true,
      data: pnl
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get shift P&Ls with filters
 * @route   GET /api/v1/finance/shift-pnl
 * @access  Private (Accountant, Auditor, Manager)
 */
export const getPnLs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = (req as any).user?.branch_id;
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const result = await getShiftPnLs(branchId, {
      status: status as any,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: parseInt(limit as string),
      offset
    });

    res.json({
      success: true,
      data: result.data,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: result.total,
        totalPages: Math.ceil(result.total / parseInt(limit as string))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit shift P&L for accountant review
 * @route   POST /api/v1/finance/shift-pnl/:shiftId/submit
 * @access  Private (System, Manager)
 */
export const submitPnL = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { shiftId } = req.params;
    const userId = (req as any).user?.id;

    const pnl = await submitForAccountantReview(parseInt(shiftId), userId);

    res.json({
      success: true,
      data: pnl,
      message: 'Shift P&L submitted for review'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Accountant review/approve shift P&L
 * @route   POST /api/v1/finance/shift-pnl/:shiftId/review
 * @access  Private (Accountant)
 */
export const reviewPnL = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { shiftId } = req.params;
    const userId = (req as any).user?.id;
    const input: ReviewShiftPnLInput = req.body;

    const pnl = await accountantApprove(parseInt(shiftId), userId, input.notes);

    res.json({
      success: true,
      data: pnl,
      message: 'Shift P&L reviewed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Auditor approve or flag shift P&L
 * @route   POST /api/v1/finance/shift-pnl/:shiftId/approve
 * @access  Private (Auditor)
 */
export const approvePnL = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { shiftId } = req.params;
    const userId = (req as any).user?.id;
    const input: ApproveShiftPnLInput = req.body;

    if (!input.action || !['approve', 'flag'].includes(input.action)) {
      throw new AppError('Action must be "approve" or "flag"', 400);
    }

    const pnl = await auditorAction(parseInt(shiftId), userId, input.action, input.notes);

    res.json({
      success: true,
      data: pnl,
      message: `Shift P&L ${input.action}ed successfully`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get multi-shift summary
 * @route   GET /api/v1/finance/shift-pnl/summary/branch
 * @access  Private (Accountant, Auditor, Manager)
 */
export const getBranchSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = (req as any).user?.branch_id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw new AppError('Start date and end date are required', 400);
    }

    const summary = await getMultiShiftSummary(
      branchId,
      startDate as string,
      endDate as string
    );

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get food cost trend
 * @route   GET /api/v1/finance/shift-pnl/food-cost-trend
 * @access  Private (Accountant, Auditor, Manager)
 */
export const getFoodCostTrendData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = (req as any).user?.branch_id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw new AppError('Start date and end date are required', 400);
    }

    const trend = await getFoodCostTrend(
      branchId,
      startDate as string,
      endDate as string
    );

    // Calculate trend direction
    let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (trend.length >= 2) {
      const firstHalf = trend.slice(0, Math.floor(trend.length / 2));
      const secondHalf = trend.slice(Math.floor(trend.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, d) => sum + d.foodCostPercentage, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, d) => sum + d.foodCostPercentage, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg + 1) {
        trendDirection = 'increasing';
      } else if (secondAvg < firstAvg - 1) {
        trendDirection = 'decreasing';
      }
    }

    const avgFoodCost = trend.reduce((sum, d) => sum + d.foodCostPercentage, 0) / (trend.length || 1);

    res.json({
      success: true,
      data: {
        dataPoints: trend,
        averageFoodCostPercentage: avgFoodCost,
        trend: trendDirection
      }
    });
  } catch (error) {
    next(error);
  }
};
