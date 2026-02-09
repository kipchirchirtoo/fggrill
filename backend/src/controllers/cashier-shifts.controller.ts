import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

// ==========================================
// SHIFT LOGBOOK
// ==========================================

// @desc    Get shift logs
// @route   GET /api/cashier/shifts
// @access  Private
export const getShiftLogs = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, cashier_id, status, from_date, to_date } = req.query;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        let query = supabase
            .from('cashier_shift_logs')
            .select(`
                *,
                cashier:users!cashier_id(first_name, last_name),
                reconciler:users!reconciled_by(first_name, last_name),
                verifier:users!verified_by(first_name, last_name)
            `)
            .order('shift_start', { ascending: false });

        // Filter by branch
        if (branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        // Cashiers can only see their own shifts unless they're admin/accountant/auditor
        if (userRole === 'cashier' && !cashier_id) {
            query = query.eq('cashier_id', userId);
        } else if (cashier_id) {
            query = query.eq('cashier_id', cashier_id);
        }

        // Filter by status
        if (status) {
            query = query.eq('status', status);
        }

        // Filter by date range
        if (from_date) {
            query = query.gte('shift_start', from_date);
        }
        if (to_date) {
            query = query.lte('shift_start', to_date);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: data || []
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single shift log with transactions
// @route   GET /api/cashier/shifts/:id
// @access  Private
export const getShiftLog = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const { data: shift, error: shiftError } = await supabase
            .from('cashier_shift_logs')
            .select(`
                *,
                cashier:users!cashier_id(first_name, last_name),
                reconciler:users!reconciled_by(first_name, last_name),
                verifier:users!verified_by(first_name, last_name)
            `)
            .eq('id', id)
            .single();

        if (shiftError) throw shiftError;
        if (!shift) throw new AppError('Shift not found', 404);

        // Get transactions
        const { data: transactions, error: txError } = await supabase
            .from('cashier_shift_transactions')
            .select('*')
            .eq('shift_id', id)
            .order('transaction_time', { ascending: false });

        if (txError) throw txError;

        res.status(200).json({
            success: true,
            data: {
                ...shift,
                transactions: transactions || []
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Start a new shift
// @route   POST /api/cashier/shifts/start
// @access  Private (Cashier)
export const startShift = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { opening_float, notes } = req.body;
        const userId = req.user?.id;
        const userName = `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim();
        const branchId = req.user?.branch_id;

        if (!branchId) {
            throw new AppError('Branch ID is required', 400);
        }

        // Check if cashier has an open shift
        const { data: openShift } = await supabase
            .from('cashier_shift_logs')
            .select('id')
            .eq('cashier_id', userId)
            .eq('status', 'open')
            .single();

        if (openShift) {
            throw new AppError('You already have an open shift. Please close it first.', 400);
        }

        // Generate shift number
        const { data: shiftNumber, error: numberError } = await supabase
            .rpc('generate_shift_number');

        if (numberError) throw numberError;

        // Create shift
        const { data: newShift, error: shiftError } = await supabase
            .from('cashier_shift_logs')
            .insert({
                shift_number: shiftNumber,
                branch_id: branchId,
                cashier_id: userId,
                cashier_name: userName,
                shift_start: new Date().toISOString(),
                opening_float: opening_float || 0,
                notes
            })
            .select()
            .single();

        if (shiftError) throw shiftError;

        res.status(201).json({
            success: true,
            data: newShift
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Close shift
// @route   PUT /api/cashier/shifts/:id/close
// @access  Private (Cashier)
export const closeShift = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const {
            closing_float,
            notes,
            // Revenue by source
            swimming_pool_revenue,
            pool_token_revenue,
            conference_revenue,
            room_booking_revenue,
            restaurant_revenue,
            bar_revenue,
            other_revenue,
            // Credit & bills
            credit_bills_taken,
            credit_bills_count,
            unpaid_bills_value,
            unpaid_bills_count,
            // Cash management
            cash_at_hand,
            cash_deposited,
            bank_deposit_ref,
            // N/A flags
            pool_na,
            conference_na,
            rooms_na
        } = req.body;
        const userId = req.user?.id;

        // Get shift
        const { data: shift, error: shiftError } = await supabase
            .from('cashier_shift_logs')
            .select('*')
            .eq('id', id)
            .single();

        if (shiftError) throw shiftError;
        if (!shift) throw new AppError('Shift not found', 404);

        // Verify ownership
        if (shift.cashier_id !== userId && req.user?.role !== 'super_admin') {
            throw new AppError('You can only close your own shifts', 403);
        }

        if (shift.status !== 'open') {
            throw new AppError('Shift is already closed', 400);
        }

        // Calculate summary from transactions
        const { data: summary } = await supabase
            .rpc('calculate_shift_summary', { p_shift_id: id });

        const expectedClosingFloat = shift.opening_float + (summary?.total_cash || 0);
        const variance = closing_float - expectedClosingFloat;

        // Update shift with all revenue breakdown
        const { data: updatedShift, error: updateError } = await supabase
            .from('cashier_shift_logs')
            .update({
                shift_end: new Date().toISOString(),
                closing_float,
                expected_closing_float: expectedClosingFloat,
                variance,
                // Payment method totals
                total_cash_sales: summary?.total_cash || 0,
                total_mpesa_sales: summary?.total_mpesa || 0,
                total_card_sales: summary?.total_card || 0,
                total_sales: summary?.total_sales || 0,
                transaction_count: summary?.transaction_count || 0,
                // Revenue by source
                swimming_pool_revenue: swimming_pool_revenue || 0,
                pool_token_revenue: pool_token_revenue || 0,
                conference_revenue: conference_revenue || 0,
                room_booking_revenue: room_booking_revenue || 0,
                restaurant_revenue: restaurant_revenue || 0,
                bar_revenue: bar_revenue || 0,
                other_revenue: other_revenue || 0,
                // Credit & bills
                credit_bills_taken: credit_bills_taken || 0,
                credit_bills_count: credit_bills_count || 0,
                unpaid_bills_value: unpaid_bills_value || 0,
                unpaid_bills_count: unpaid_bills_count || 0,
                // Cash management
                cash_at_hand: cash_at_hand || 0,
                cash_deposited: cash_deposited || 0,
                bank_deposit_ref,
                // N/A flags
                pool_na: pool_na || false,
                conference_na: conference_na || false,
                rooms_na: rooms_na || false,
                // Status
                status: 'closed',
                notes: notes || shift.notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        res.status(200).json({
            success: true,
            data: updatedShift
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Reconcile shift (Branch Accountant)
// @route   PUT /api/cashier/shifts/:id/reconcile
// @access  Private (Accountant)
export const reconcileShift = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { reconciliation_notes } = req.body;
        const userId = req.user?.id;

        const { data, error } = await supabase
            .from('cashier_shift_logs')
            .update({
                status: 'reconciled',
                reconciled_by: userId,
                reconciled_at: new Date().toISOString(),
                reconciliation_notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
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

// @desc    Verify shift (Auditor)
// @route   PUT /api/cashier/shifts/:id/verify
// @access  Private (Auditor)
export const verifyShift = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { verification_notes } = req.body;
        const userId = req.user?.id;

        const { data, error } = await supabase
            .from('cashier_shift_logs')
            .update({
                status: 'verified',
                verified_by: userId,
                verified_at: new Date().toISOString(),
                verification_notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
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

// @desc    Add transaction to shift
// @route   POST /api/cashier/shifts/:id/transactions
// @access  Private
export const addShiftTransaction = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { transaction_id, transaction_ref, payment_method, amount } = req.body;

        const { data, error } = await supabase
            .from('cashier_shift_transactions')
            .insert({
                shift_id: id,
                transaction_id,
                transaction_ref,
                payment_method,
                amount,
                transaction_time: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};
