import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

const getBranchUserIds = async (branchId: string | number) => {
    const { data: users, error } = await supabase
        .from('users')
        .select('id')
        .eq('branch_id', branchId);

    if (error) {
        logger.error('Error fetching branch users for staff audit:', error);
        return null;
    }

    return (users || []).map((user: any) => user.id).filter(Boolean);
};

const getUserMap = async (logs: any[]) => {
    const userIds = [...new Set(
        (logs || [])
            .flatMap((log: any) => [log.user_id, log.target_user_id])
            .filter(Boolean)
    )];

    if (userIds.length === 0) {
        return new Map<string, any>();
    }

    const { data: users, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role')
        .in('id', userIds);

    if (error) {
        logger.error('Error fetching users for staff audit enrichment:', error);
        return new Map<string, any>();
    }

    return new Map((users || []).map((user: any) => [user.id, user]));
};

const enrichLogs = (logs: any[], usersById: Map<string, any>) => {
    return (logs || []).map((log: any) => {
        const user = log.user_id ? (usersById.get(log.user_id) || null) : null;
        const targetUser = log.target_user_id ? (usersById.get(log.target_user_id) || null) : null;

        return {
            ...log,
            user,
            target_user: targetUser,
            user_name: user ? `${user.first_name} ${user.last_name}` : 'System',
            user_email: user?.email || null,
            user_role: user?.role || null,
            target_user_name: targetUser ? `${targetUser.first_name} ${targetUser.last_name}` : null,
            target_user_email: targetUser?.email || null,
            is_critical: ['delete', 'void', 'discount', 'refund', 'role_change', 'permission_change'].includes(log.action?.toLowerCase() || ''),
            formatted_date: new Date(log.created_at).toLocaleString()
        };
    });
};

/**
 * @desc    Get staff audit trail
 * @route   GET /api/staff/audit
 * @access  Private (Branch Manager, Auditor, Super Admin)
 */
export const getStaffAuditTrail = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, staff_id, action_type, from_date, to_date, limit = 100 } = req.query;

        console.log('🔍 [Staff Audit] Fetching audit trail:', { branch_id, staff_id, action_type, from_date, to_date });

        // Calculate date range (default: last 30 days)
        const endDate = (to_date as string) || new Date().toISOString();
        const startDate = (from_date as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // Build query for audit logs
        let auditQuery = supabase
            .from('audit_logs')
            .select('*')
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: false })
            .limit(Number(limit));

        if (branch_id && branch_id !== '0') {
            const branchUserIds = await getBranchUserIds(branch_id as string);

            if (branchUserIds === null) {
                throw new Error('Failed to resolve branch users for audit trail');
            }

            if (branchUserIds.length === 0) {
                res.status(200).json({
                    success: true,
                    data: {
                        logs: [],
                        summary: {
                            total_actions: 0,
                            critical_actions: 0,
                            unique_users: 0,
                            action_types: [],
                            date_range: { from: startDate, to: endDate }
                        }
                    }
                });
                return;
            }

            auditQuery = auditQuery.in('user_id', branchUserIds);
        }

        if (staff_id) {
            auditQuery = auditQuery.or(`user_id.eq.${staff_id},target_user_id.eq.${staff_id}`);
        }

        if (action_type) {
            auditQuery = auditQuery.eq('action', action_type);
        }

        const { data: logs, error: logsError } = await auditQuery;

        if (logsError) {
            console.error('❌ [Staff Audit] Error fetching logs:', logsError);
            throw logsError;
        }

        console.log(`✅ [Staff Audit] Found ${logs?.length || 0} audit logs`);

        const usersById = await getUserMap(logs || []);
        const enrichedLogs = enrichLogs(logs || [], usersById);

        // Calculate summary stats
        const summary = {
            total_actions: enrichedLogs.length,
            critical_actions: enrichedLogs.filter(l => l.is_critical).length,
            unique_users: new Set(enrichedLogs.map(l => l.user_id)).size,
            action_types: Array.from(new Set(enrichedLogs.map(l => l.action))),
            date_range: { from: startDate, to: endDate }
        };

        res.status(200).json({
            success: true,
            data: {
                logs: enrichedLogs,
                summary
            }
        });
    } catch (error) {
        console.error('❌ [Staff Audit] Error:', error);
        logger.error('Error fetching staff audit trail:', error);
        next(error);
    }
};

/**
 * @desc    Get critical actions only
 * @route   GET /api/staff/audit/critical
 * @access  Private (Branch Manager, Auditor, Super Admin)
 */
export const getCriticalActions = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, from_date, to_date, limit = 50 } = req.query;

        console.log('🔍 [Staff Audit] Fetching critical actions:', { branch_id, from_date, to_date });

        const endDate = (to_date as string) || new Date().toISOString();
        const startDate = (from_date as string) || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const criticalActions = ['delete', 'void', 'discount', 'refund', 'role_change', 'permission_change', 'data_export'];

        let criticalQuery = supabase
            .from('audit_logs')
            .select('*')
            .in('action', criticalActions)
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: false })
            .limit(Number(limit));

        if (branch_id && branch_id !== '0') {
            const branchUserIds = await getBranchUserIds(branch_id as string);

            if (branchUserIds === null) {
                throw new Error('Failed to resolve branch users for critical actions');
            }

            if (branchUserIds.length === 0) {
                res.status(200).json({
                    success: true,
                    data: {
                        logs: [],
                        count: 0
                    }
                });
                return;
            }

            criticalQuery = criticalQuery.in('user_id', branchUserIds);
        }

        const { data: logs, error } = await criticalQuery;

        if (error) {
            console.error('❌ [Staff Audit] Error fetching critical actions:', error);
            throw error;
        }

        console.log(`✅ [Staff Audit] Found ${logs?.length || 0} critical actions`);

        const usersById = await getUserMap(logs || []);
        const enrichedLogs = enrichLogs(logs || [], usersById).map(log => ({
            ...log,
            severity: log.action === 'delete' || log.action === 'role_change' ? 'high' : 'medium'
        }));

        res.status(200).json({
            success: true,
            data: {
                logs: enrichedLogs,
                count: enrichedLogs.length
            }
        });
    } catch (error) {
        console.error('❌ [Staff Audit] Error:', error);
        logger.error('Error fetching critical actions:', error);
        next(error);
    }
};

/**
 * @desc    Get audit summary for a specific staff member
 * @route   GET /api/staff/:id/audit-summary
 * @access  Private
 */
export const getStaffAuditSummary = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { from_date, to_date } = req.query;

        console.log('🔍 [Staff Audit] Fetching summary for staff:', id);

        const endDate = (to_date as string) || new Date().toISOString();
        const startDate = (from_date as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // Get all actions by this staff member
        const { data: logs, error } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('user_id', id)
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Calculate summary
        const actionCounts: Record<string, number> = {};
        (logs || []).forEach(log => {
            const action = log.action || 'unknown';
            actionCounts[action] = (actionCounts[action] || 0) + 1;
        });

        const criticalActions = ['delete', 'void', 'discount', 'refund', 'role_change', 'permission_change'];
        const criticalCount = (logs || []).filter(l => criticalActions.includes(l.action?.toLowerCase() || '')).length;

        const summary = {
            staff_id: id,
            total_actions: logs?.length || 0,
            critical_actions: criticalCount,
            action_breakdown: actionCounts,
            most_common_action: Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
            date_range: { from: startDate, to: endDate },
            recent_actions: (logs || []).slice(0, 10)
        };

        res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        logger.error('Error fetching staff audit summary:', error);
        next(error);
    }
};
