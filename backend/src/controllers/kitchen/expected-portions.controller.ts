import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';

// @desc    Get expected portions for a branch
// @route   GET /api/kitchen/expected-portions
// @access  Private
export const getExpectedPortions = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, verified, date_from, date_to } = req.query;

        let query = supabase
            .from('kitchen_expected_portions')
            .select(`
                *,
                dispatch:dispatch_notes(dispatch_number, dispatched_at),
                food_control:kitchen_food_controls(raw_item_name, raw_quantity, raw_unit, produced_item_name, produced_portions),
                received_by_user:users!received_by(first_name, last_name),
                verified_by_user:users!verified_by(first_name, last_name)
            `)
            .order('received_at', { ascending: false });

        if (branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        if (verified === 'true') {
            query = query.not('verified_at', 'is', null);
        } else if (verified === 'false') {
            query = query.is('verified_at', null);
        }

        if (date_from) {
            query = query.gte('received_at', date_from);
        }

        if (date_to) {
            query = query.lte('received_at', date_to);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single expected portion record
// @route   GET /api/kitchen/expected-portions/:id
// @access  Private
export const getExpectedPortion = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('kitchen_expected_portions')
            .select(`
                *,
                dispatch:dispatch_notes(dispatch_number, dispatched_at, from_branch:branches!from_branch_id(name)),
                food_control:kitchen_food_controls(*),
                received_by_user:users!received_by(first_name, last_name),
                verified_by_user:users!verified_by(first_name, last_name)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update actual portions and calculate variance
// @route   PUT /api/kitchen/expected-portions/:id/verify
// @access  Private
export const verifyActualPortions = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { actual_portions, variance_reason } = req.body;
        const userId = (req as any).user?.id;

        if (!actual_portions || actual_portions < 0) {
            res.status(400).json({
                success: false,
                message: 'Valid actual portions count is required'
            });
            return;
        }

        // Get the expected portions record
        const { data: record, error: fetchError } = await supabase
            .from('kitchen_expected_portions')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !record) {
            res.status(404).json({
                success: false,
                message: 'Expected portions record not found'
            });
            return;
        }

        // Calculate variance
        const variance = Number(actual_portions) - Number(record.expected_portions);
        const variancePercentage = (variance / Number(record.expected_portions)) * 100;

        // Update record
        const { data, error } = await supabase
            .from('kitchen_expected_portions')
            .update({
                actual_portions: Number(actual_portions),
                variance: variance,
                variance_percentage: variancePercentage,
                variance_reason: variance_reason || null,
                verified_at: new Date().toISOString(),
                verified_by: userId,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Log significant variances (more than 10% difference)
        if (Math.abs(variancePercentage) > 10) {
            logger.warn(`Significant portion variance detected: ${record.raw_item_name} - Expected: ${record.expected_portions}, Actual: ${actual_portions}, Variance: ${variancePercentage.toFixed(2)}%`);
        }

        res.status(200).json({
            success: true,
            data,
            message: 'Actual portions verified successfully'
        });

        logger.info(`Portions verified for ${record.raw_item_name}: Expected ${record.expected_portions}, Actual ${actual_portions}`);
    } catch (error) {
        next(error);
    }
};

// @desc    Get variance summary/statistics
// @route   GET /api/kitchen/expected-portions/variance/summary
// @access  Private
export const getVarianceSummary = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, date_from, date_to } = req.query;

        let query = supabase
            .from('kitchen_expected_portions')
            .select('*')
            .not('verified_at', 'is', null); // Only verified records

        if (branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        if (date_from) {
            query = query.gte('received_at', date_from);
        }

        if (date_to) {
            query = query.lte('received_at', date_to);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Calculate summary statistics
        const totalRecords = data.length;
        const recordsWithVariance = data.filter(r => Math.abs(r.variance || 0) > 0).length;
        const avgVariancePercentage = data.reduce((sum, r) => sum + (r.variance_percentage || 0), 0) / totalRecords;
        
        const positiveVariance = data.filter(r => (r.variance || 0) > 0);
        const negativeVariance = data.filter(r => (r.variance || 0) < 0);
        
        const itemSummary = data.reduce((acc: any, record) => {
            const key = record.raw_item_name;
            if (!acc[key]) {
                acc[key] = {
                    item_name: record.raw_item_name,
                    produced_item: record.produced_item_name,
                    total_expected: 0,
                    total_actual: 0,
                    total_variance: 0,
                    count: 0
                };
            }
            acc[key].total_expected += Number(record.expected_portions || 0);
            acc[key].total_actual += Number(record.actual_portions || 0);
            acc[key].total_variance += Number(record.variance || 0);
            acc[key].count += 1;
            return acc;
        }, {});

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    total_records: totalRecords,
                    records_with_variance: recordsWithVariance,
                    avg_variance_percentage: avgVariancePercentage.toFixed(2),
                    positive_variance_count: positiveVariance.length,
                    negative_variance_count: negativeVariance.length,
                    accuracy_rate: ((totalRecords - recordsWithVariance) / totalRecords * 100).toFixed(2)
                },
                by_item: Object.values(itemSummary),
                recent_records: data.slice(0, 10)
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get pending verifications (unverified expected portions)
// @route   GET /api/kitchen/expected-portions/pending
// @access  Private
export const getPendingVerifications = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id } = req.query;

        let query = supabase
            .from('kitchen_expected_portions')
            .select(`
                *,
                dispatch:dispatch_notes(dispatch_number, dispatched_at),
                food_control:kitchen_food_controls(raw_item_name, produced_item_name)
            `)
            .is('verified_at', null)
            .order('received_at', { ascending: true });

        if (branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        next(error);
    }
};

