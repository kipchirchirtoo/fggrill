import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * Confirm Credit Bill (Accountant or Auditor)
 * Handles both staff payroll credit bills and unpaid guest bills.
 */
export const confirmCreditBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id, type } = req.params; // type: 'employee' or 'guest'
        const { role, notes } = req.body; // role: 'accountant' or 'auditor'

        if (!id || !type || !role) {
            throw new AppError('ID, type, and role are required', 400);
        }

        const tableName = type === 'employee' ? 'staff_credit_bills' : 'unpaid_bills';
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

        // Fetch staff credit bills without embedded joins. The live Supabase
        // schema cache does not expose a relationship here reliably.
        let empQuery = supabase
            .from('staff_credit_bills')
            .select('*')
            .not('status', 'in', '("paid","paid_cash","deducted","cancelled")');

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

        const staffIds = [...new Set((empRes.data || [])
            .map((bill: any) => bill.staff_id)
            .filter(Boolean))];

        const { data: staffProfiles, error: staffError } = staffIds.length
            ? await supabase
                .from('staff_profiles')
                .select('id, first_name, last_name, user_id, national_id, position, branch_id')
                .in('id', staffIds)
            : { data: [], error: null };

        if (staffError) throw staffError;

        const userIds = [...new Set((staffProfiles || [])
            .map((staff: any) => staff.user_id)
            .filter(Boolean))];

        const { data: users, error: usersError } = userIds.length
            ? await supabase
                .from('users')
                .select('id, first_name, last_name, email')
                .in('id', userIds)
            : { data: [], error: null };

        if (usersError) throw usersError;

        const staffMap = new Map((staffProfiles || []).map((staff: any) => [staff.id, staff]));
        const userMap = new Map((users || []).map((user: any) => [user.id, user]));

        const employeeBills = (empRes.data || []).map((bill: any) => {
            const staff: any = staffMap.get(bill.staff_id);
            const user: any = staff?.user_id ? userMap.get(staff.user_id) : null;
            const firstName = user?.first_name || staff?.first_name || '';
            const lastName = user?.last_name || staff?.last_name || '';
            const employeeName = `${firstName} ${lastName}`.trim() || bill.staff_name || 'Unknown Staff';

            return {
                ...bill,
                type: 'employee',
                employee_name: employeeName,
                customer_name: employeeName,
                employee: staff ? {
                    ...staff,
                    first_name: firstName,
                    last_name: lastName,
                    email: user?.email,
                } : null,
                staff: staff ? {
                    ...staff,
                    first_name: firstName,
                    last_name: lastName,
                    email: user?.email,
                } : null,
            };
        });

        const guestBills = (guestRes.data || []).map((bill: any) => ({
            ...bill,
            type: 'guest',
            customer_name: bill.customer_name || bill.guest_name || bill.name || 'Guest Bill'
        }));

        res.status(200).json({
            success: true,
            data: {
                employee_bills: employeeBills,
                guest_bills: guestBills
            }
        });

    } catch (error) {
        next(error);
    }
};
