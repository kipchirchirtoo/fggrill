import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// @desc    Get petty cash transactions
// @route   GET /api/petty-cash
// @access  Private
export const getPettyCashTransactions = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const branchId = req.query.branch_id || req.user?.branch_id;
        const { category, status, startDate, endDate } = req.query;

        let query = supabase
            .from('petty_cash_transactions')
            .select('*, requested_by_user:users!requested_by(id, full_name), approved_by_user:users!approved_by(id, full_name)');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }
        if (category) {
            query = query.eq('category', category);
        }
        if (status) {
            query = query.eq('status', status);
        }
        if (startDate) {
            query = query.gte('date', startDate);
        }
        if (endDate) {
            query = query.lte('date', endDate);
        }

        const { data: transactions, error } = await query.order('date', { ascending: false });

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: transactions
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Request petty cash
// @route   POST /api/petty-cash
// @access  Private
export const requestPettyCash = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { amount, category, description, date } = req.body;
        const branch_id = req.user?.branch_id;
        const requested_by = req.user?.id;

        if (!amount || !category || !description) {
            throw new AppError('Missing required fields for petty cash request', 400);
        }

        const { data: transaction, error } = await supabase
            .from('petty_cash_transactions')
            .insert([{
                branch_id,
                amount,
                category,
                description,
                requested_by,
                date: date || new Date().toISOString(),
                status: 'pending'
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data: transaction
        });

        logger.info(`Petty cash request of ${amount} created by ${requested_by}`);
    } catch (error) {
        next(error);
    }
};

// @desc    Approve/Reject petty cash
// @route   PATCH /api/petty-cash/:id/status
// @access  Private (Admin/Manager)
export const updatePettyCashStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;
        const approved_by = req.user?.id;

        if (!['approved', 'rejected'].includes(status)) {
            throw new AppError('Invalid status update for petty cash', 400);
        }

        const { data: transaction, error } = await supabase
            .from('petty_cash_transactions')
            .update({
                status,
                approved_by,
                approved_at: status === 'approved' ? new Date().toISOString() : null,
                notes: remarks // Assuming notes column or similar
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: transaction
        });

        logger.info(`Petty cash transaction ${id} updated to ${status} by ${approved_by}`);
    } catch (error) {
        next(error);
    }
};
