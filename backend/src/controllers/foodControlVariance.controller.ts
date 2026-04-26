/**
 * Food Control Variance Controller
 * 
 * Handles variance reporting, explanation, and flagging
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import {
  computeVariance,
  explainVariance,
  flagVariance,
  getUnexplainedVariances,
  getPortionOutputConversion
} from '../services/foodControlService';
import { ExplainVarianceInput } from '../types/foodControl';

/**
 * @desc    Get variance report for a shift
 * @route   GET /api/v1/food-control/variance/shift/:shiftId
 * @access  Private (Manager, Accountant, Auditor)
 */
export const getShiftVarianceReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { shiftId } = req.params;
    const branchId = (req as any).user?.branch_id;
    const { referenceType, referenceId } = req.query;

    // Get variance records from database
    let query = supabase
      .from('food_control_variance')
      .select('*')
      .eq('shift_id', shiftId)
      .eq('branch_id', branchId)
      .order('variance_cost', { ascending: false });

    if (referenceType) {
      query = query.eq('reference_type', referenceType);
    }

    if (referenceId) {
      query = query.eq('reference_id', referenceId);
    }

    const { data: variances, error } = await query;

    if (error) throw error;

    // Calculate summary
    const totalVarianceCost = variances?.reduce((sum, v) => sum + Number(v.variance_cost || 0), 0) || 0;
    const flaggedItems = variances?.filter(v => v.status === 'flagged' || v.requires_explanation) || [];
    const unexplainedItems = variances?.filter(v => v.status === 'pending' && v.requires_explanation) || [];

    res.json({
      success: true,
      data: {
        shiftId: parseInt(shiftId),
        items: variances || [],
        totalVarianceCost,
        flaggedItems,
        unexplainedItems,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Compute/refresh variance for a shift
 * @route   POST /api/v1/food-control/variance/compute
 * @access  Private (Manager, System)
 */
export const computeShiftVariance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { shiftId, referenceType, referenceId } = req.body;
    const branchId = (req as any).user?.branch_id;

    if (!shiftId || !referenceType) {
      throw new AppError('Shift ID and reference type are required', 400);
    }

    const report = await computeVariance(
      parseInt(shiftId),
      referenceType,
      referenceId,
      branchId
    );

    res.json({
      success: true,
      data: report,
      message: 'Variance computed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Explain a variance item
 * @route   POST /api/v1/food-control/variance/:id/explain
 * @access  Private (Chef, Storekeeper, Manager)
 */
export const explainVarianceItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const input: ExplainVarianceInput = req.body;

    if (!input.varianceReason || !input.reasonDescription) {
      throw new AppError('Variance reason and description are required', 400);
    }

    const variance = await explainVariance(
      id,
      userId,
      input.varianceReason,
      input.reasonDescription
    );

    logger.info(`Variance ${id} explained by user ${userId}`);

    res.json({
      success: true,
      data: variance,
      message: 'Variance explained successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Flag a variance for audit
 * @route   POST /api/v1/food-control/variance/:id/flag
 * @access  Private (Auditor)
 */
export const flagVarianceItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const { notes } = req.body;

    const variance = await flagVariance(id, userId, notes);

    logger.info(`Variance ${id} flagged by auditor ${userId}`);

    res.json({
      success: true,
      data: variance,
      message: 'Variance flagged successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve a variance explanation
 * @route   POST /api/v1/food-control/variance/:id/approve
 * @access  Private (Manager, Auditor)
 */
export const approveVariance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const { data, error } = await supabase
      .from('food_control_variance')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Variance ${id} approved by user ${userId}`);

    res.json({
      success: true,
      data,
      message: 'Variance approved successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get unexplained variances
 * @route   GET /api/v1/food-control/variance/pending
 * @access  Private (Manager, Accountant, Auditor)
 */
export const getPendingVariances = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = (req as any).user?.branch_id;
    const { shiftId } = req.query;

    const variances = await getUnexplainedVariances(
      branchId,
      shiftId ? parseInt(shiftId as string) : undefined
    );

    res.json({
      success: true,
      data: variances
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get portion output conversion for a shift
 * @route   GET /api/v1/food-control/portion-output/shift/:shiftId
 * @access  Private (Manager, Accountant, Auditor)
 */
export const getShiftPortionOutput = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { shiftId } = req.params;
    const branchId = (req as any).user?.branch_id;

    const outputs = await getPortionOutputConversion(
      parseInt(shiftId),
      branchId
    );

    res.json({
      success: true,
      data: outputs
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get variance statistics
 * @route   GET /api/v1/food-control/variance/stats
 * @access  Private (Manager, Accountant, Auditor)
 */
export const getVarianceStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = (req as any).user?.branch_id;
    const { startDate, endDate } = req.query;

    let query = supabase
      .from('food_control_variance')
      .select('*')
      .eq('branch_id', branchId);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: variances, error } = await query;

    if (error) throw error;

    // Calculate statistics
    const totalVariances = variances?.length || 0;
    const totalVarianceCost = variances?.reduce((sum, v) => sum + Number(v.variance_cost || 0), 0) || 0;
    const pendingCount = variances?.filter(v => v.status === 'pending').length || 0;
    const explainedCount = variances?.filter(v => v.status === 'explained').length || 0;
    const approvedCount = variances?.filter(v => v.status === 'approved').length || 0;
    const flaggedCount = variances?.filter(v => v.status === 'flagged').length || 0;

    // Group by reason
    const byReason: Record<string, { count: number; totalCost: number }> = {};
    for (const variance of variances || []) {
      const reason = variance.variance_reason || 'unknown';
      if (!byReason[reason]) {
        byReason[reason] = { count: 0, totalCost: 0 };
      }
      byReason[reason].count++;
      byReason[reason].totalCost += Number(variance.variance_cost || 0);
    }

    res.json({
      success: true,
      data: {
        totalVariances,
        totalVarianceCost,
        pendingCount,
        explainedCount,
        approvedCount,
        flaggedCount,
        byReason
      }
    });
  } catch (error) {
    next(error);
  }
};
