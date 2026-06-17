import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

/**
 * Helper to parse branch_id from query or body
 */
const parseBranchId = (id: any): number | undefined => {
  if (id === undefined || id === null || id === '' || id === 'null' || id === 'undefined' || id === 'true' || id === 'false') {
    return undefined;
  }
  const parsed = parseInt(id);
  return isNaN(parsed) ? undefined : parsed;
};

// @desc    Create wastage record
// @route   POST /api/wastage
// @access  Private
export const createWastageRecord = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Table wastage_records doesn't exist in new DB
        res.status(501).json({
            success: false,
            message: 'Wastage tracking feature not available - table does not exist in new database'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get wastage records
// @route   GET /api/wastage
// @access  Private
export const getWastageRecords = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Table wastage_records doesn't exist in new DB - return empty array
        logger.info('Wastage records table does not exist in new database');
        
        res.status(200).json({
            success: true,
            data: [],
            message: 'Wastage tracking feature not available - table does not exist in new database'
        });
    } catch (error: any) {
        logger.error('Exception in getWastageRecords:', { message: error?.message, stack: error?.stack });
        res.status(200).json({
            success: true,
            data: [],
            message: 'Error fetching wastage records'
        });
    }
};

// @desc    Get wastage summary
// @route   GET /api/wastage/summary
// @access  Private
export const getWastageSummary = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Table wastage_records doesn't exist in new DB - return empty summary
        res.status(200).json({
            success: true,
            data: {
                totalCost: 0,
                totalItems: 0,
                byReason: {},
                topItems: [],
                period: req.query.period || '30d',
                message: 'Wastage tracking feature not available - table does not exist in new database'
            }
        });
    } catch (error: any) {
        logger.error('Exception in getWastageSummary:', { message: error?.message });
        res.status(200).json({
            success: true,
            data: {
                totalCost: 0,
                totalItems: 0,
                byReason: {},
                topItems: [],
                period: req.query.period || '30d'
            }
        });
    }
};

// @desc    Bulk create wastage records (for delivery confirmations)
// @route   POST /api/wastage/bulk
// @access  Private
export const bulkCreateWastageRecords = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Table wastage_records doesn't exist in new DB
        res.status(501).json({
            success: false,
            message: 'Wastage tracking feature not available - table does not exist in new database'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update wastage record
// @route   PUT /api/wastage/:id
// @access  Private
export const updateWastageRecord = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Table wastage_records doesn't exist in new DB
        res.status(501).json({
            success: false,
            message: 'Wastage tracking feature not available - table does not exist in new database'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete wastage record
// @route   DELETE /api/wastage/:id
// @access  Private
export const deleteWastageRecord = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Table wastage_records doesn't exist in new DB
        res.status(501).json({
            success: false,
            message: 'Wastage tracking feature not available - table does not exist in new database'
        });
    } catch (error) {
        next(error);
    }
};
