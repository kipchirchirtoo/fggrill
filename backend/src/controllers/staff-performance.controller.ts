import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

/**
 * @desc    Get staff performance metrics for a branch
 * @route   GET /api/staff/performance
 * @access  Private (Branch Manager, HR, Super Admin)
 */
export const getStaffPerformance = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, period, department } = req.query;
        const periodDays = parseInt(period as string) || 30;
        const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

        console.log('🔍 [Staff Performance] Fetching performance:', { branch_id, period: periodDays, department });

        // Fetch staff for the branch
        let staffQuery = supabase
            .from('users')
            .select('id, first_name, last_name, email, role, department, branch_id, created_at')
            .eq('status', 'active');

        if (branch_id && branch_id !== '0') {
            staffQuery = staffQuery.eq('branch_id', branch_id);
        }

        if (department) {
            staffQuery = staffQuery.eq('department', department);
        }

        const { data: staff, error: staffError } = await staffQuery;

        if (staffError) {
            console.error('❌ [Staff Performance] Error fetching staff:', staffError);
            throw staffError;
        }

        console.log(`✅ [Staff Performance] Found ${staff?.length || 0} staff members`);

        // Fetch performance data for each staff member
        const performanceData = await Promise.all(
            (staff || []).map(async (member) => {
                // Attendance data
                const { data: attendance } = await supabase
                    .from('staff_attendance')
                    .select('*')
                    .eq('staff_id', member.id)
                    .gte('attendance_date', startDate);

                const totalDays = periodDays;
                const presentDays = attendance?.filter(a => a.status === 'present').length || 0;
                const lateDays = attendance?.filter(a => a.status === 'late').length || 0;
                const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
                const punctualityScore = presentDays > 0 ? ((presentDays - lateDays) / presentDays) * 100 : 100;

                // Task completion (housekeeping tasks)
                const { data: tasks } = await supabase
                    .from('housekeeping_tasks')
                    .select('*')
                    .eq('assigned_to', member.id)
                    .gte('created_at', startDate);

                const totalTasks = tasks?.length || 0;
                const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
                const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

                // Revenue contribution (for waiters/bartenders)
                let revenueContribution = 0;
                if (member.role === 'restaurant' || member.role === 'bartender') {
                    const { data: orders } = await supabase
                        .from(member.role === 'restaurant' ? 'restaurant_orders' : 'bar_orders')
                        .select('total, total_amount')
                        .eq('staff_id', member.id)
                        .gte('created_at', startDate);

                    revenueContribution = orders?.reduce((sum, o) => sum + Number(o.total || o.total_amount || 0), 0) || 0;
                }

                // Calculate overall performance score
                const performanceScore = (
                    attendanceRate * 0.4 +
                    punctualityScore * 0.3 +
                    taskCompletionRate * 0.3
                );

                return {
                    staff_id: member.id,
                    staff_name: `${member.first_name} ${member.last_name}`,
                    email: member.email,
                    role: member.role,
                    department: member.department,
                    attendance_rate: Math.round(attendanceRate * 10) / 10,
                    punctuality_score: Math.round(punctualityScore * 10) / 10,
                    task_completion_rate: Math.round(taskCompletionRate * 10) / 10,
                    performance_score: Math.round(performanceScore * 10) / 10,
                    revenue_contribution: revenueContribution,
                    present_days: presentDays,
                    late_days: lateDays,
                    total_tasks: totalTasks,
                    completed_tasks: completedTasks,
                    period_days: periodDays
                };
            })
        );

        // Sort by performance score
        performanceData.sort((a, b) => b.performance_score - a.performance_score);

        // Calculate summary statistics
        const summary = {
            total_staff: performanceData.length,
            average_attendance: performanceData.reduce((sum, p) => sum + p.attendance_rate, 0) / performanceData.length || 0,
            average_punctuality: performanceData.reduce((sum, p) => sum + p.punctuality_score, 0) / performanceData.length || 0,
            average_task_completion: performanceData.reduce((sum, p) => sum + p.task_completion_rate, 0) / performanceData.length || 0,
            average_performance: performanceData.reduce((sum, p) => sum + p.performance_score, 0) / performanceData.length || 0,
            total_revenue_contribution: performanceData.reduce((sum, p) => sum + p.revenue_contribution, 0),
            top_performers: performanceData.slice(0, 5),
            needs_improvement: performanceData.filter(p => p.performance_score < 60).length
        };

        console.log('✅ [Staff Performance] Performance data calculated successfully');

        res.status(200).json({
            success: true,
            data: {
                performance: performanceData,
                summary,
                period_days: periodDays
            }
        });
    } catch (error) {
        console.error('❌ [Staff Performance] Error:', error);
        logger.error('Error fetching staff performance:', error);
        next(error);
    }
};

/**
 * @desc    Get individual staff member KPIs
 * @route   GET /api/staff/:id/kpis
 * @access  Private
 */
export const getStaffKPIs = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { period } = req.query;
        const periodDays = parseInt(period as string) || 30;
        const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

        console.log('🔍 [Staff KPIs] Fetching KPIs for staff:', id, 'period:', periodDays);

        // Fetch staff details
        const { data: staff, error: staffError } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (staffError || !staff) {
            res.status(404).json({
                success: false,
                message: 'Staff member not found'
            });
            return;
        }

        // Attendance details
        const { data: attendance } = await supabase
            .from('staff_attendance')
            .select('*')
            .eq('staff_id', id)
            .gte('attendance_date', startDate)
            .order('attendance_date', { ascending: false });

        const presentDays = attendance?.filter(a => a.status === 'present').length || 0;
        const absentDays = attendance?.filter(a => a.status === 'absent').length || 0;
        const lateDays = attendance?.filter(a => a.status === 'late').length || 0;
        const onTimeDays = presentDays - lateDays;

        // Task performance
        const { data: tasks } = await supabase
            .from('housekeeping_tasks')
            .select('*')
            .eq('assigned_to', id)
            .gte('created_at', startDate)
            .order('created_at', { ascending: false });

        const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
        const pendingTasks = tasks?.filter(t => t.status === 'pending').length || 0;
        const overdueTasks = tasks?.filter(t => t.status === 'overdue').length || 0;

        // Revenue contribution (role-specific)
        let revenueData = null;
        if (staff.role === 'restaurant' || staff.role === 'bartender') {
            const tableName = staff.role === 'restaurant' ? 'restaurant_orders' : 'bar_orders';
            const { data: orders } = await supabase
                .from(tableName)
                .select('*')
                .eq('staff_id', id)
                .gte('created_at', startDate)
                .order('created_at', { ascending: false });

            const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total || o.total_amount || 0), 0) || 0;
            const orderCount = orders?.length || 0;
            const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

            revenueData = {
                total_revenue: totalRevenue,
                order_count: orderCount,
                average_order_value: averageOrderValue,
                recent_orders: orders?.slice(0, 10) || []
            };
        }

        // Shift coverage (cashier)
        let shiftData = null;
        if (staff.role === 'cashier') {
            const { data: shifts } = await supabase
                .from('cashier_shifts')
                .select('*')
                .eq('cashier_id', id)
                .gte('shift_start', startDate)
                .order('shift_start', { ascending: false });

            const totalShifts = shifts?.length || 0;
            const totalSales = shifts?.reduce((sum, s) => sum + Number(s.total_sales || 0), 0) || 0;
            const averageVariance = shifts?.reduce((sum, s) => {
                const variance = Number(s.actual_cash || 0) - Number(s.expected_cash || 0);
                return sum + variance;
            }, 0) || 0;

            shiftData = {
                total_shifts: totalShifts,
                total_sales: totalSales,
                average_variance: totalShifts > 0 ? averageVariance / totalShifts : 0,
                recent_shifts: shifts?.slice(0, 10) || []
            };
        }

        const kpis = {
            staff_info: {
                id: staff.id,
                name: `${staff.first_name} ${staff.last_name}`,
                email: staff.email,
                role: staff.role,
                department: staff.department,
                branch_id: staff.branch_id
            },
            attendance: {
                present_days: presentDays,
                absent_days: absentDays,
                late_days: lateDays,
                on_time_days: onTimeDays,
                attendance_rate: periodDays > 0 ? (presentDays / periodDays) * 100 : 0,
                punctuality_rate: presentDays > 0 ? (onTimeDays / presentDays) * 100 : 0,
                recent_attendance: attendance?.slice(0, 10) || []
            },
            tasks: {
                total_tasks: tasks?.length || 0,
                completed_tasks: completedTasks,
                pending_tasks: pendingTasks,
                overdue_tasks: overdueTasks,
                completion_rate: tasks?.length ? (completedTasks / tasks.length) * 100 : 0,
                recent_tasks: tasks?.slice(0, 10) || []
            },
            revenue: revenueData,
            shifts: shiftData,
            period_days: periodDays
        };

        console.log('✅ [Staff KPIs] KPIs calculated successfully');

        res.status(200).json({
            success: true,
            data: kpis
        });
    } catch (error) {
        console.error('❌ [Staff KPIs] Error:', error);
        logger.error('Error fetching staff KPIs:', error);
        next(error);
    }
};

/**
 * @desc    Get staff performance leaderboard
 * @route   GET /api/staff/performance/leaderboard
 * @access  Private
 */
export const getPerformanceLeaderboard = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, period, limit } = req.query;
        const periodDays = parseInt(period as string) || 30;
        const maxResults = parseInt(limit as string) || 10;
        const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

        console.log('🔍 [Performance Leaderboard] Fetching leaderboard:', { branch_id, period: periodDays, limit: maxResults });

        // Fetch staff for the branch
        let staffQuery = supabase
            .from('users')
            .select('id, first_name, last_name, email, role, department, branch_id, created_at')
            .eq('status', 'active');

        if (branch_id && branch_id !== '0') {
            staffQuery = staffQuery.eq('branch_id', branch_id);
        }

        const { data: staff, error: staffError } = await staffQuery;

        if (staffError) {
            console.error('❌ [Performance Leaderboard] Error fetching staff:', staffError);
            throw staffError;
        }

        // Calculate performance scores (simplified version)
        const performanceData = await Promise.all(
            (staff || []).map(async (member) => {
                const { data: attendance } = await supabase
                    .from('staff_attendance')
                    .select('*')
                    .eq('staff_id', member.id)
                    .gte('attendance_date', startDate);

                const presentDays = attendance?.filter(a => a.status === 'present').length || 0;
                const lateDays = attendance?.filter(a => a.status === 'late').length || 0;
                const attendanceRate = periodDays > 0 ? (presentDays / periodDays) * 100 : 0;
                const punctualityScore = presentDays > 0 ? ((presentDays - lateDays) / presentDays) * 100 : 100;

                const { data: tasks } = await supabase
                    .from('housekeeping_tasks')
                    .select('*')
                    .eq('assigned_to', member.id)
                    .gte('created_at', startDate);

                const totalTasks = tasks?.length || 0;
                const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
                const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

                const performanceScore = (
                    attendanceRate * 0.4 +
                    punctualityScore * 0.3 +
                    taskCompletionRate * 0.3
                );

                return {
                    staff_id: member.id,
                    staff_name: `${member.first_name} ${member.last_name}`,
                    role: member.role,
                    performance_score: Math.round(performanceScore * 10) / 10
                };
            })
        );

        // Sort by performance score and take top N
        performanceData.sort((a, b) => b.performance_score - a.performance_score);
        const leaderboard = performanceData.slice(0, maxResults);

        console.log('✅ [Performance Leaderboard] Leaderboard calculated successfully');

        res.status(200).json({
            success: true,
            data: {
                leaderboard,
                period_days: periodDays
            }
        });
    } catch (error) {
        console.error('❌ [Performance Leaderboard] Error:', error);
        logger.error('Error fetching performance leaderboard:', error);
        next(error);
    }
};


/**
 * @desc    Get overall staff performance metrics
 * @route   GET /api/staff/performance
 * @access  Private (Branch Manager, HR, Super Admin)
 */
export const getOverallPerformance = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, period } = req.query;

        console.log('🔍 [Staff Performance] Fetching overall performance:', { branch_id, period });

        if (!branch_id || branch_id === '0') {
            res.status(400).json({
                success: false,
                error: 'Branch ID is required'
            });
            return;
        }

        // Get all staff for the branch
        const { data: staff, error: staffError } = await supabase
            .from('users')
            .select('id, first_name, last_name, role')
            .eq('branch_id', branch_id)
            .eq('is_active', true);

        if (staffError) throw staffError;

        if (!staff || staff.length === 0) {
            res.status(200).json({
                success: true,
                data: {
                    average_score: 0,
                    performance_change: 0,
                    total_staff: 0
                }
            });
            return;
        }

        // Calculate average performance score (simplified)
        // In a real system, this would aggregate from performance_reviews table
        const averageScore = 75; // Placeholder
        const performanceChange = 5; // Placeholder

        res.status(200).json({
            success: true,
            data: {
                average_score: averageScore,
                performance_change: performanceChange,
                total_staff: staff.length
            }
        });
    } catch (error) {
        console.error('❌ [Staff Performance] Error:', error);
        logger.error('Error fetching overall performance:', error);
        next(error);
    }
};
