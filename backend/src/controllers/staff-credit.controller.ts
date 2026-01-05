import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// @desc    Get staff credit limits and balances
// @route   GET /api/staff-credit/limits
// @access  Private (Auditor, HR, Manager)
export const getLimits = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, staff_id } = req.query;

        let query = supabase
            .from('staff_credit_limits')
            .select(`
        *,
        staff:staff_profiles!inner(
          id,
          branch_id,
          user:users!user_id(id, first_name, last_name, email)
        )
      `);

        if (branch_id) query = query.eq('staff.branch_id', branch_id);
        if (staff_id) query = query.eq('staff_id', staff_id);

        const { data, error } = await query;
        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// @desc    Set credit limit for employee
// @route   POST /api/staff-credit/limits
// @access  Private (Auditor, HR)
export const setLimit = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { staff_id, monthly_limit } = req.body;

        const { data, error } = await supabase
            .from('staff_credit_limits')
            .upsert({
                staff_id,
                monthly_limit,
                updated_at: new Date().toISOString()
            }, { onConflict: 'staff_id' })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
        logger.info(`Credit limit set for staff ${staff_id}: ${monthly_limit}`);
    } catch (error) {
        next(error);
    }
};

// @desc    Add a credit bill
// @route   POST /api/staff-credit/bills
// @access  Private (Manager, Cashier)
export const addBill = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { staff_id, amount, description, date } = req.body;
        const userId = (req as any).user?.id;

        // Check limit first
        const { data: limitData, error: limitError } = await supabase
            .from('staff_credit_limits')
            .select('monthly_limit, current_balance')
            .eq('staff_id', staff_id)
            .single();

        if (limitError && limitError.code !== 'PGRST116') throw limitError; // Ignore not found, treat as 0 limit

        const limit = limitData?.monthly_limit || 0;
        const balance = limitData?.current_balance || 0;

        if (balance + amount > limit) {
            res.status(400).json({ success: false, message: 'Credit limit exceeded' });
            return;
        }

        // Create bill
        const { data: bill, error: billError } = await supabase
            .from('staff_credit_bills')
            .insert({
                staff_id,
                amount,
                description,
                date: date || new Date().toISOString(),
                status: 'pending',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (billError) throw billError;

        // Update balance
        await supabase
            .from('staff_credit_limits')
            .update({ current_balance: balance + amount })
            .eq('staff_id', staff_id);

        res.status(201).json({ success: true, data: bill });
        logger.info(`Staff bill added: ${amount} for ${staff_id}`);
    } catch (error) {
        next(error);
    }
};

// @desc    Get staff bills
// @route   GET /api/staff-credit/bills
// @access  Private (Auditor, HR, Manager)
export const getBills = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { staff_id, status, start_date, end_date } = req.query;

        let query = supabase
            .from('staff_credit_bills')
            .select(`
        *,
        staff:staff_profiles(
          id,
          user:users!user_id(first_name, last_name)
        ),
        approver:users!approved_by(first_name, last_name)
      `)
            .order('date', { ascending: false });

        if (staff_id) query = query.eq('staff_id', staff_id);
        if (status) query = query.eq('status', status);
        if (start_date) query = query.gte('date', start_date);
        if (end_date) query = query.lte('date', end_date);

        const { data, error } = await query;
        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// @desc    Approve bill (mark as approved/deducted)
// @route   PUT /api/staff-credit/bills/:id/approve
// @access  Private (Auditor, HR)
export const approveBill = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'approved', 'deducted', 'paid'
        const userId = (req as any).user?.id;

        const { data: bill, error } = await supabase
            .from('staff_credit_bills')
            .update({
                status,
                approved_by: userId
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // If paid or deducted, we might want to reduce the current_balance if it's a revolving credit
        // For now, assuming monthly reset or manual management, but let's reduce balance if 'paid'
        if (status === 'paid' || status === 'deducted') {
            const { data: currentBill } = await supabase
                .from('staff_credit_bills')
                .select('staff_id, amount')
                .eq('id', id)
                .single();

            if (currentBill) {
                // Get current balance
                const { data: limitData } = await supabase
                    .from('staff_credit_limits')
                    .select('current_balance')
                    .eq('staff_id', currentBill.staff_id)
                    .single();

                if (limitData) {
                    await supabase
                        .from('staff_credit_limits')
                        .update({ current_balance: Math.max(0, limitData.current_balance - currentBill.amount) })
                        .eq('staff_id', currentBill.staff_id);
                }
            }
        }

        res.json({ success: true, data: bill });
        logger.info(`Staff bill ${id} updated to ${status}`);
    } catch (error) {
        next(error);
    }
};
