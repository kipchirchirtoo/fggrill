import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

/**
 * @desc    Get revenue oversight dashboard data
 * @route   GET /api/finance/revenue-oversight
 * @access  Private (Branch Manager, Finance, Super Admin)
 */
export const getRevenueOversight = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, period } = req.query;
        const periodDays = parseInt(period as string) || 30;
        const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = new Date().toISOString().split('T')[0];

        console.log('🔍 [Revenue Oversight] Fetching data:', { branch_id, startDate, endDate, periodDays });

        // Fetch revenue targets
        const { data: targets } = await supabase
            .from('revenue_targets')
            .select('*')
            .eq('branch_id', branch_id)
            .gte('target_date', startDate)
            .lte('target_date', endDate);

        const totalTarget = targets?.reduce((sum, t) => sum + Number(t.target_amount || 0), 0) || 0;

        // Fetch actual revenue from multiple sources
        let roomsQuery = supabase
            .from('reservations')
            .select('total_amount, created_at, status')
            .in('status', ['confirmed', 'checked_in', 'checked_out'])
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`);

        let restaurantQuery = supabase
            .from('restaurant_orders')
            .select('total_amount, created_at, status')
            .in('status', ['completed', 'paid', 'delivered'])
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`);

        let barQuery = supabase
            .from('bar_orders')
            .select('total, created_at, status')
            .in('status', ['completed', 'paid', 'closed'])
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`);

        let conferenceQuery = supabase
            .from('conference_bookings')
            .select('total_amount, created_at, status')
            .in('status', ['confirmed', 'completed'])
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`);

        if (branch_id && branch_id !== '0') {
            roomsQuery = roomsQuery.eq('branch_id', branch_id);
            restaurantQuery = restaurantQuery.eq('branch_id', branch_id);
            barQuery = barQuery.eq('branch_id', branch_id);
            conferenceQuery = conferenceQuery.eq('branch_id', branch_id);
        }

        const [roomsRes, restaurantRes, barRes, conferenceRes] = await Promise.all([
            roomsQuery,
            restaurantQuery,
            barQuery,
            conferenceQuery
        ]);

        // Calculate revenue by category
        const roomsRevenue = roomsRes.data?.reduce((sum, r) => sum + Number(r.total_amount || 0), 0) || 0;
        const restaurantRevenue = restaurantRes.data?.reduce((sum, r) => sum + Number(r.total_amount || 0), 0) || 0;
        const barRevenue = barRes.data?.reduce((sum, b) => sum + Number(b.total || 0), 0) || 0;
        const conferenceRevenue = conferenceRes.data?.reduce((sum, c) => sum + Number(c.total_amount || 0), 0) || 0;

        const totalRevenue = roomsRevenue + restaurantRevenue + barRevenue + conferenceRevenue;
        const variance = totalRevenue - totalTarget;
        const variancePercentage = totalTarget > 0 ? (variance / totalTarget) * 100 : 0;

        // Daily trend data
        const dailyData: Record<string, any> = {};
        
        const processDailyData = (items: any[], amountKey: string) => {
            items?.forEach(item => {
                const date = item.created_at.split('T')[0];
                if (!dailyData[date]) {
                    dailyData[date] = {
                        date,
                        rooms: 0,
                        restaurant: 0,
                        bar: 0,
                        conference: 0,
                        total: 0
                    };
                }
                const amount = Number(item[amountKey] || 0);
                dailyData[date].total += amount;
            });
        };

        roomsRes.data?.forEach(item => {
            const date = item.created_at.split('T')[0];
            if (!dailyData[date]) {
                dailyData[date] = { date, rooms: 0, restaurant: 0, bar: 0, conference: 0, total: 0 };
            }
            dailyData[date].rooms += Number(item.total_amount || 0);
            dailyData[date].total += Number(item.total_amount || 0);
        });

        restaurantRes.data?.forEach(item => {
            const date = item.created_at.split('T')[0];
            if (!dailyData[date]) {
                dailyData[date] = { date, rooms: 0, restaurant: 0, bar: 0, conference: 0, total: 0 };
            }
            dailyData[date].restaurant += Number(item.total_amount || 0);
            dailyData[date].total += Number(item.total_amount || 0);
        });

        barRes.data?.forEach(item => {
            const date = item.created_at.split('T')[0];
            if (!dailyData[date]) {
                dailyData[date] = { date, rooms: 0, restaurant: 0, bar: 0, conference: 0, total: 0 };
            }
            dailyData[date].bar += Number(item.total || 0);
            dailyData[date].total += Number(item.total || 0);
        });

        conferenceRes.data?.forEach(item => {
            const date = item.created_at.split('T')[0];
            if (!dailyData[date]) {
                dailyData[date] = { date, rooms: 0, restaurant: 0, bar: 0, conference: 0, total: 0 };
            }
            dailyData[date].conference += Number(item.total_amount || 0);
            dailyData[date].total += Number(item.total_amount || 0);
        });

        const dailyTrend = Object.values(dailyData).sort((a: any, b: any) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Category breakdown
        const categoryBreakdown = [
            {
                category: 'Rooms',
                revenue: roomsRevenue,
                percentage: totalRevenue > 0 ? (roomsRevenue / totalRevenue) * 100 : 0,
                transactions: roomsRes.data?.length || 0
            },
            {
                category: 'Restaurant',
                revenue: restaurantRevenue,
                percentage: totalRevenue > 0 ? (restaurantRevenue / totalRevenue) * 100 : 0,
                transactions: restaurantRes.data?.length || 0
            },
            {
                category: 'Bar',
                revenue: barRevenue,
                percentage: totalRevenue > 0 ? (barRevenue / totalRevenue) * 100 : 0,
                transactions: barRes.data?.length || 0
            },
            {
                category: 'Conference',
                revenue: conferenceRevenue,
                percentage: totalRevenue > 0 ? (conferenceRevenue / totalRevenue) * 100 : 0,
                transactions: conferenceRes.data?.length || 0
            }
        ].sort((a, b) => b.revenue - a.revenue);

        // Calculate growth rate (compare with previous period)
        const previousStartDate = new Date(new Date(startDate).getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const previousEndDate = startDate;

        let prevRoomsQuery = supabase
            .from('reservations')
            .select('total_amount')
            .in('status', ['confirmed', 'checked_in', 'checked_out'])
            .gte('created_at', `${previousStartDate}T00:00:00`)
            .lte('created_at', `${previousEndDate}T23:59:59`);

        if (branch_id && branch_id !== '0') {
            prevRoomsQuery = prevRoomsQuery.eq('branch_id', branch_id);
        }

        const { data: prevRooms } = await prevRoomsQuery;
        const previousRevenue = prevRooms?.reduce((sum, r) => sum + Number(r.total_amount || 0), 0) || 0;
        const growthRate = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

        const data = {
            summary: {
                total_revenue: totalRevenue,
                target_revenue: totalTarget,
                variance,
                variance_percentage: variancePercentage,
                achievement_rate: totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0,
                growth_rate: growthRate,
                period_days: periodDays
            },
            category_breakdown: categoryBreakdown,
            daily_trend: dailyTrend,
            targets: targets || []
        };

        console.log('✅ [Revenue Oversight] Data calculated successfully');

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('❌ [Revenue Oversight] Error:', error);
        logger.error('Error fetching revenue oversight:', error);
        next(error);
    }
};

/**
 * @desc    Get revenue targets for a branch
 * @route   GET /api/finance/targets
 * @access  Private
 */
export const getRevenueTargets = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, year, month } = req.query;

        let query = supabase
            .from('revenue_targets')
            .select('*')
            .order('target_date', { ascending: false });

        if (branch_id && branch_id !== '0') {
            query = query.eq('branch_id', branch_id);
        }

        if (year) {
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;
            query = query.gte('target_date', startDate).lte('target_date', endDate);
        }

        if (month) {
            query = query.ilike('target_date', `%-${String(month).padStart(2, '0')}-%`);
        }

        const { data: targets, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: targets || []
        });
    } catch (error) {
        logger.error('Error fetching revenue targets:', error);
        next(error);
    }
};


/**
 * @desc    Get revenue overview for a specific date
 * @route   GET /api/finance/revenue-overview
 * @access  Private (Branch Manager, Finance, Super Admin)
 */
export const getRevenueOverview = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, date } = req.query;
        const targetDate = (date as string) || new Date().toISOString().split('T')[0];

        console.log('🔍 [Revenue Overview] Fetching data:', { branch_id, date: targetDate });

        if (!branch_id || branch_id === '0') {
            res.status(400).json({
                success: false,
                error: 'Branch ID is required'
            });
            return;
        }

        // Fetch revenue for the specific date
        const { data: bookings } = await supabase
            .from('bookings')
            .select('total_amount')
            .eq('branch_id', branch_id)
            .gte('created_at', `${targetDate}T00:00:00`)
            .lte('created_at', `${targetDate}T23:59:59`)
            .in('status', ['confirmed', 'checked_in', 'checked_out']);

        const { data: orders } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('branch_id', branch_id)
            .gte('created_at', `${targetDate}T00:00:00`)
            .lte('created_at', `${targetDate}T23:59:59`)
            .eq('status', 'completed');

        const totalRevenue = 
            (bookings?.reduce((sum, b) => sum + Number(b.total_amount || 0), 0) || 0) +
            (orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0);

        // Get target for the date
        const { data: target } = await supabase
            .from('revenue_targets')
            .select('target_amount')
            .eq('branch_id', branch_id)
            .eq('target_date', targetDate)
            .single();

        const targetAmount = Number(target?.target_amount || 0);
        const achievementPercentage = targetAmount > 0 ? (totalRevenue / targetAmount) * 100 : 0;

        // Calculate growth rate (compare with previous day)
        const previousDate = new Date(new Date(targetDate).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const { data: prevBookings } = await supabase
            .from('bookings')
            .select('total_amount')
            .eq('branch_id', branch_id)
            .gte('created_at', `${previousDate}T00:00:00`)
            .lte('created_at', `${previousDate}T23:59:59`)
            .in('status', ['confirmed', 'checked_in', 'checked_out']);

        const { data: prevOrders } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('branch_id', branch_id)
            .gte('created_at', `${previousDate}T00:00:00`)
            .lte('created_at', `${previousDate}T23:59:59`)
            .eq('status', 'completed');

        const previousRevenue = 
            (prevBookings?.reduce((sum, b) => sum + Number(b.total_amount || 0), 0) || 0) +
            (prevOrders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0);

        const growthRate = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

        res.status(200).json({
            success: true,
            data: {
                total_revenue: totalRevenue,
                target_amount: targetAmount,
                achievement_percentage: achievementPercentage,
                growth_rate: growthRate,
                date: targetDate
            }
        });
    } catch (error) {
        console.error('❌ [Revenue Overview] Error:', error);
        logger.error('Error fetching revenue overview:', error);
        next(error);
    }
};
