import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error';

// @desc    Create wastage record
// @route   POST /api/wastage
// @access  Private
export const createWastageRecord = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            item_name,
            item_id,
            item_type,
            quantity,
            unit,
            reason,
            cost_impact,
            description
        } = req.body;

        const branchId = req.user?.branch_id;
        const userId = req.user?.id;

        if (!item_name || !quantity || !unit || !reason) {
            throw new AppError('Item name, quantity, unit, and reason are required', 400);
        }

        const { data: wastage, error } = await supabase
            .from('wastage_records')
            .insert([
                {
                    branch_id: branchId,
                    item_name,
                    item_id,
                    item_type,
                    quantity,
                    unit,
                    reason,
                    cost_impact: cost_impact || 0,
                    description,
                    logged_by: userId
                }
            ])
            .select()
            .single();

        if (error) {
            logger.error('Error creating wastage record:', error);
            throw new AppError('Failed to create wastage record', 500);
        }

        res.status(201).json({
            success: true,
            message: 'Wastage record created successfully',
            data: wastage
        });

        logger.info(`Wastage record created: ${item_name} - ${quantity} ${unit}`);
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
        const { startDate, endDate, reason, logged_by } = req.query;
        const branchId = req.user?.branch_id || req.query.branch_id;

        let query = supabase
            .from('wastage_records')
            .select(`
        *,
        user:users!logged_by(id, first_name, last_name, email)
      `)
            .order('logged_at', { ascending: false });

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        if (startDate) {
            query = query.gte('logged_at', startDate as string);
        }

        if (endDate) {
            query = query.lte('logged_at', endDate as string);
        }

        if (reason) {
            query = query.eq('reason', reason as string);
        }

        if (logged_by) {
            query = query.eq('logged_by', logged_by as string);
        }

        const { data: records, error } = await query;

        if (error) {
            logger.error('Error fetching wastage records:', error);
            throw new AppError('Failed to fetch wastage records', 500);
        }

        res.status(200).json({
            success: true,
            data: records || []
        });
    } catch (error) {
        next(error);
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
        const { period = '30d' } = req.query;
        const branchId = req.user?.branch_id || req.query.branch_id;

        // Calculate date range based on period
        const now = new Date();
        let startDate = new Date();

        switch (period) {
            case '7d':
                startDate.setDate(now.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(now.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(now.getDate() - 90);
                break;
            default:
                startDate.setDate(now.getDate() - 30);
        }

        let query = supabase
            .from('wastage_records')
            .select('*')
            .gte('logged_at', startDate.toISOString());

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data: records, error } = await query;

        if (error) {
            logger.error('Error fetching wastage summary:', error);
            throw new AppError('Failed to fetch wastage summary', 500);
        }

        // Calculate summary statistics
        const totalCost = records?.reduce((sum, r) => sum + (parseFloat(r.cost_impact as string) || 0), 0) || 0;
        const totalItems = records?.length || 0;

        // Group by reason
        const byReason = records?.reduce((acc: any, record) => {
            const reason = record.reason || 'other';
            if (!acc[reason]) {
                acc[reason] = { count: 0, cost: 0 };
            }
            acc[reason].count++;
            acc[reason].cost += parseFloat(record.cost_impact as string) || 0;
            return acc;
        }, {});

        // Top wasted items
        const byItem = records?.reduce((acc: any, record) => {
            const item = record.item_name;
            if (!acc[item]) {
                acc[item] = { quantity: 0, cost: 0, unit: record.unit };
            }
            acc[item].quantity += parseFloat(record.quantity as string) || 0;
            acc[item].cost += parseFloat(record.cost_impact as string) || 0;
            return acc;
        }, {});

        const topItems = Object.entries(byItem || {})
            .map(([name, data]: [string, any]) => ({ name, ...data }))
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 10);

        res.status(200).json({
            success: true,
            data: {
                totalCost,
                totalItems,
                byReason,
                topItems,
                period
            }
        });
    } catch (error) {
        next(error);
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
        const { records } = req.body;
        const branchId = req.user?.branch_id;
        const userId = req.user?.id;

        if (!records || !Array.isArray(records) || records.length === 0) {
            throw new AppError('Records array is required', 400);
        }

        // Add branch_id and logged_by to all records
        const wastageRecords = records.map(record => ({
            ...record,
            branch_id: branchId,
            logged_by: userId,
            cost_impact: record.cost_impact || 0
        }));

        const { data: createdRecords, error } = await supabase
            .from('wastage_records')
            .insert(wastageRecords)
            .select();

        if (error) {
            logger.error('Error bulk creating wastage records:', error);
            throw new AppError('Failed to create wastage records', 500);
        }

        res.status(201).json({
            success: true,
            message: `${createdRecords?.length || 0} wastage records created successfully`,
            data: createdRecords
        });

        logger.info(`Bulk wastage records created: ${createdRecords?.length || 0} records`);
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
        const { id } = req.params;
        const {
            item_name,
            quantity,
            unit,
            reason,
            cost_impact,
            description
        } = req.body;

        const { data: wastage, error } = await supabase
            .from('wastage_records')
            .update({
                item_name,
                quantity,
                unit,
                reason,
                cost_impact,
                description,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error('Error updating wastage record:', error);
            throw new AppError('Failed to update wastage record', 500);
        }

        res.status(200).json({
            success: true,
            message: 'Wastage record updated successfully',
            data: wastage
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
        const { id } = req.params;

        const { error } = await supabase
            .from('wastage_records')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error('Error deleting wastage record:', error);
            throw new AppError('Failed to delete wastage record', 500);
        }

        res.status(200).json({
            success: true,
            message: 'Wastage record deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};
