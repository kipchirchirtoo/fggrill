import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { applyBranchFilter } from '../utils/branchIsolation';
import notificationService from '../services/notification.service';

export const createAdvance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, amount, reason, advance_date, month_to_deduct, year_to_deduct } = req.body;

        if (!staff_id || !amount || !reason || !month_to_deduct || !year_to_deduct) {
            throw new AppError('Missing required fields: staff_id, amount, reason, month_to_deduct, year_to_deduct', 400);
        }

        const { data, error } = await supabase
            .from('staff_advances')
            .insert({
                staff_id,
                amount,
                reason,
                advance_date: advance_date || new Date().toISOString().split('T')[0],
                month_to_deduct: Number(month_to_deduct),
                year_to_deduct: Number(year_to_deduct),
                status: 'pending',
                branch_id: (req as any).user?.branch_id
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getAdvances = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, status } = req.query;

        let query = supabase
            .from('staff_advances')
            .select('*')
            .order('created_at', { ascending: false });

        query = applyBranchFilter(query, req);

        if (staff_id) query = query.eq('staff_id', staff_id);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) throw error;

        const staffIds = [...new Set((data || []).map((a: any) => a.staff_id).filter(Boolean))];
        const { data: staffProfiles, error: staffError } = staffIds.length > 0
            ? await supabase.from('staff_profiles').select('id, role, position, department, id_number, national_id, first_name, last_name, user_id').in('id', staffIds)
            : { data: [], error: null };
        if (staffError) throw staffError;
        
        const userIds = (staffProfiles || []).map((s: any) => s.user_id).filter(Boolean);
        const { data: users, error: usersError } = userIds.length > 0
            ? await supabase.from('users').select('id, first_name, last_name, employee_id').in('id', userIds)
            : { data: [], error: null };
        if (usersError) throw usersError;

        const staffMap = new Map((staffProfiles || []).map((s: any) => [s.id, s]));
        const userMap = new Map((users || []).map((u: any) => [u.id, u]));

        const transformed = (data || []).map((advance: any) => {
            const sp = staffMap.get(advance.staff_id);
            const user = sp ? userMap.get(sp.user_id) : null;
            return {
                ...advance,
                staff_name: `${user?.first_name || sp?.first_name || ''} ${user?.last_name || sp?.last_name || ''}`.trim(),
                employee_id: user?.employee_id || sp?.id_number || sp?.national_id || null,
                department: sp?.department || null,
                staff: sp ? {
                    id: sp.id,
                    role: sp.role || sp.position,
                    department: sp.department,
                    employee_id: user?.employee_id || sp.id_number || sp.national_id,
                    first_name: user?.first_name || sp.first_name || '',
                    last_name: user?.last_name || sp.last_name || ''
                } : null
            };
        });

        res.status(200).json({ success: true, data: transformed });
    } catch (error) {
        next(error);
    }
};

export const approveAdvance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        console.log('[approveAdvance] id:', id, 'userId:', userId, 'userRole:', userRole);

        // Determine if this is an auditor approval
        const isAuditor = userRole === 'auditor';

        const updateData: any = {
            status: isAuditor ? 'auditor_confirmed' : 'accountant_confirmed',
        };

        if (isAuditor) {
            updateData.auditor_id = userId;
            updateData.auditor_confirmed_at = new Date().toISOString();
        } else {
            updateData.accountant_id = userId;
            updateData.accountant_confirmed_at = new Date().toISOString();
        }

        console.log('[approveAdvance] updateData:', JSON.stringify(updateData));

        // First verify the user exists in users table
        const { data: userCheck, error: userCheckError } = await supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .single();

        console.log('[approveAdvance] userCheck:', userCheck ? 'EXISTS' : 'NOT FOUND', 'userCheckError:', userCheckError);

        const { data, error } = await supabase
            .from('staff_advances')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[approveAdvance] Supabase error:', JSON.stringify(error));
            console.error('[approveAdvance] Error details:', error.message, error.code, error.hint);
            throw error;
        }

        // Send notification to branch accountant when auditor approves
        if (isAuditor && data) {
            try {
                const { data: staffData } = await supabase
                    .from('staff_profiles')
                    .select('first_name, last_name')
                    .eq('id', data.staff_id)
                    .single();

                const staffName = staffData ? `${staffData.first_name} ${staffData.last_name}` : 'Staff member';
                
                await notificationService.notifyRole(
                    'branch_accountant',
                    'Advance Approved by Auditor',
                    `A salary advance of KES ${data.amount.toLocaleString()} for ${staffName} has been approved by the auditor and requires your final approval.`,
                    {
                        type: 'info',
                        category: 'payroll',
                        branchId: data.branch_id,
                        metadata: {
                            advance_id: data.id,
                            staff_id: data.staff_id,
                            amount: data.amount
                        }
                    }
                );
            } catch (notifError) {
                // Don't fail the approval if notification fails
                console.error('Failed to send notification:', notifError);
            }
        }

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};


export const rejectAdvance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new AppError('Advance ID is required', 400);
        }

        const { data, error } = await supabase
            .from('staff_advances')
            .update({ status: 'cancelled' })
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
