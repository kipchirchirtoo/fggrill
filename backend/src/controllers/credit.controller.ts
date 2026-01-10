import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * Confirm Credit Bill (Accountant or Auditor)
 * Handles both 'employee_credit_bills' and 'unpaid_bills' (guests)
 */
export const confirmCreditBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id, type } = req.params; // type: 'employee' or 'guest'
        const { role, notes } = req.body; // role: 'accountant' or 'auditor'

        if (!id || !type || !role) {
            throw new AppError('ID, type, and role are required', 400);
        }

        const tableName = type === 'employee' ? 'employee_credit_bills' : 'unpaid_bills';
        const userId = req.user?.id;

        // Verify permissions
        if (role === 'accountant' && req.user?.role !== 'accountant' && req.user?.role !== 'super_admin') {
            throw new AppError('Unauthorized: Only accountants can perform this confirmation', 403);
        }
        if (role === 'auditor' && req.user?.role !== 'auditor' && req.user?.role !== 'super_admin') {
            throw new AppError('Unauthorized: Only auditors can perform this confirmation', 403);
        }

        // Fetch current bill
        const { data: bill, error: fetchError } = await supabase
            .from(tableName)
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !bill) {
            throw new AppError('Bill not found', 404);
        }

        // Check sequence: Auditor cannot confirm before Accountant
        if (role === 'auditor' && !bill.accountant_confirmed_at) {
            throw new AppError('Cannot audit: Accountant confirmation required first', 400);
        }

        // Prepare update data
        const updateData: any = {};
        const timestamp = new Date().toISOString();

        if (role === 'accountant') {
            if (bill.accountant_confirmed_at) {
                throw new AppError('Already confirmed by accountant', 400);
            }
            updateData.accountant_confirmed_at = timestamp;
            updateData.accountant_id = userId;
        } else if (role === 'auditor') {
            if (bill.auditor_confirmed_at) {
                throw new AppError('Already confirmed by auditor', 400);
            }
            updateData.auditor_confirmed_at = timestamp;
            updateData.auditor_id = userId;
        }

        // Update bill
        const { data: updatedBill, error: updateError } = await supabase
            .from(tableName)
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            throw new AppError(`Confirmation failed: ${updateError.message}`, 500);
        }

        logger.info(`Credit bill ${id} (${type}) confirmed by ${role} (${userId})`);

        res.status(200).json({
            success: true,
            message: `${role === 'accountant' ? 'Accountant' : 'Auditor'} confirmation successful`,
            data: updatedBill
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Get Pending Confirmations
 */
export const getPendingConfirmations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { role } = req.params; // 'accountant' or 'auditor'

        // Fetch Employee Bills
        let empQuery = supabase
            .from('employee_credit_bills')
            .select(`
                *,
                employee:staff_profiles(first_name, last_name)
            `)
            .neq('status', 'paid');

        // Fetch Guest Bills
        let guestQuery = supabase
            .from('unpaid_bills')
            .select('*')
            .neq('status', 'paid');

        if (role === 'accountant') {
            // Pending accountant confirmation
            empQuery = empQuery.is('accountant_confirmed_at', null);
            guestQuery = guestQuery.is('accountant_confirmed_at', null);
        } else if (role === 'auditor') {
            // Confirmed by accountant but pending auditor
            empQuery = empQuery.not('accountant_confirmed_at', 'is', null).is('auditor_confirmed_at', null);
            guestQuery = guestQuery.not('accountant_confirmed_at', 'is', null).is('auditor_confirmed_at', null);
        }

        const [empRes, guestRes] = await Promise.all([empQuery, guestQuery]);

        if (empRes.error) throw empRes.error;
        if (guestRes.error) throw guestRes.error;

        res.status(200).json({
            success: true,
            data: {
                employee_bills: empRes.data,
                guest_bills: guestRes.data
            }
        });

    } catch (error) {
        next(error);
    }
};
