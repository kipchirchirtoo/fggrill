import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export const getStaffPerformance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { month, year, branch_id } = req.query;

        if (!month || !year) {
            throw new AppError('Month and Year are required', 400);
        }

        const startDate = new Date(Number(year), Number(month) - 1, 1).toISOString();
        const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59).toISOString();
        const daysInMonth = new Date(Number(year), Number(month), 0).getDate();

        // 1. Fetch Staff with User Details
        let staffQuery = supabase
            .from('staff_profiles')
            .select(`
                id,
                role,
                department,
                branch_id,
                first_name,
                last_name,
                user:users!user_id(id, first_name, last_name, email)
            `);

        if (branch_id) {
            staffQuery = staffQuery.eq('branch_id', branch_id);
        }

        const { data: staffList, error: staffError } = await staffQuery;
        if (staffError) throw staffError;

        // 2. Fetch Sales Data (Restaurant Orders)
        const { data: salesData, error: salesError } = await supabase
            .from('restaurant_orders')
            .select('created_by, grand_total, tip_amount')
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .eq('status', 'completed');

        if (salesError) throw salesError;

        // 3. Fetch Attendance Data
        const { data: attendanceData, error: attendanceError } = await supabase
            .from('staff_attendance')
            .select('staff_id, status')
            .gte('attendance_date', startDate.split('T')[0])
            .lte('attendance_date', endDate.split('T')[0]);

        if (attendanceError) throw attendanceError;

        // 4. Fetch Manual Ratings
        const { data: ratingsData, error: ratingsError } = await supabase
            .from('staff_performance')
            .select('staff_id, rating')
            .eq('review_period_month', Number(month))
            .eq('review_period_year', Number(year));

        if (ratingsError) throw ratingsError;

        // 5. Aggregate and Rank
        const performance = staffList.map((staff: any) => {
            const user = Array.isArray(staff.user) ? staff.user[0] : staff.user;
            const userId = user?.id;

            // Sales Metrics
            const staffSales = salesData?.filter(o => o.created_by === userId) || [];
            const totalSales = staffSales.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
            const totalTips = staffSales.reduce((sum, o) => sum + Number(o.tip_amount || 0), 0);
            const orderCount = staffSales.length;

            // Attendance Metrics
            const staffAttendance = attendanceData?.filter(a => a.staff_id === staff.id) || [];
            const presentDays = staffAttendance.filter(a =>
                ['present', 'active', 'late', 'half_day'].includes(a.status?.toLowerCase())
            ).length;
            const attendanceRate = daysInMonth > 0 ? (presentDays / daysInMonth) * 100 : 0;

            // Scoring Logic (0-100 scale)
            const salesScore = Math.min((totalSales / 200000) * 100, 100); // 200k target
            const attendanceScore = Math.min((presentDays / (daysInMonth * 0.85)) * 100, 100); // 85% attendance target
            const tipScore = Math.min((totalTips / 10000) * 100, 100); // 10k target

            // Manual rating (if exists)
            const staffRatings = ratingsData?.filter(r => r.staff_id === staff.id) || [];
            const manualRating = staffRatings.length > 0
                ? staffRatings.reduce((sum, r) => sum + r.rating, 0) / staffRatings.length
                : null;

            // Initial weighted score (without manual rating)
            // Weight components: Sales (50%), Attendance (40%), Tips (10%)
            const baseScore = (salesScore * 0.5) + (attendanceScore * 0.4) + (tipScore * 0.1);

            // System Rating (0-5 stars)
            const systemRating = Number((baseScore / 20).toFixed(1));
            const avgRating = manualRating !== null ? manualRating : systemRating;

            // Final Rank Score (including rating factor)
            const finalScore = (baseScore * 0.8) + ((avgRating * 20) * 0.2);

            // Name Fallback: User Table -> Staff Profile Table -> Unknown
            const name = (
                (user?.first_name ? `${user.first_name} ${user.last_name || ''}` : null) ||
                (staff.first_name ? `${staff.first_name} ${staff.last_name || ''}` : null) ||
                'Unknown Staff'
            ).trim();

            return {
                staff_id: staff.id,
                name,
                role: staff.role,
                department: staff.department,
                branch_id: staff.branch_id,
                metrics: {
                    totalSales,
                    totalTips,
                    orderCount,
                    presentDays,
                    attendanceRate,
                    avgRating: Number(avgRating.toFixed(1)),
                    scores: {
                        sales: salesScore,
                        attendance: attendanceScore,
                        tips: tipScore,
                        system: systemRating,
                        final: finalScore
                    }
                }
            };
        });

        // Sort by final score descending
        performance.sort((a, b) => b.metrics.scores.final - a.metrics.scores.final);

        res.status(200).json({
            success: true,
            data: performance
        });
    } catch (error) {
        next(error);
    }
};
