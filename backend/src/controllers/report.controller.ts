import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { Booking, BookingStatus } from '../models/Booking';
import { Room } from '../models/Room';
import { HousekeepingTask } from '../models/HousekeepingTask';
import { MaintenanceTask } from '../models/MaintenanceTask';
import { InventoryItem } from '../models/Inventory';
import { logger } from '../utils/logger';

// @desc    Get occupancy report
// @route   GET /api/reports/occupancy
// @access  Private (Admin/Manager only)
export const getOccupancyReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date();
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Get all bookings in date range
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .or(`check_in.gte.${startDate.toISOString()},check_out.lte.${endDate.toISOString()}`);

    if (bookingsError) throw bookingsError;

    // Get all rooms
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*');

    if (roomsError) throw roomsError;

    const totalRooms = rooms?.length || 0;

    // Calculate daily occupancy
    const occupancyData = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const date = new Date(d);
      const occupiedRooms = (bookings || []).filter((booking: any) => {
        return (
          booking.status === BookingStatus.CHECKED_IN &&
          new Date(booking.check_in) <= date &&
          new Date(booking.check_out) > date
        );
      });

      occupancyData.push({
        date,
        occupiedRooms: occupiedRooms.length,
        occupancyRate: (occupiedRooms.length / totalRooms) * 100,
        revenue: occupiedRooms.reduce((sum: number, booking: any) => sum + (booking.total_amount || 0), 0)
      });
    }

    res.status(200).json({
      success: true,
      data: {
        totalRooms,
        occupancyData
      }
    });

    logger.info('Occupancy report generated');
  } catch (error) {
    next(error);
  }
};

// @desc    Get revenue report
// @route   GET /api/reports/revenue
// @access  Private (Admin/Manager only)
export const getRevenueReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date();
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Get all bookings in date range
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (bookingsError) throw bookingsError;

    // Calculate revenue metrics
    const revenueData = {
      totalRevenue: (bookings || []).reduce((sum: number, booking: any) => sum + (booking.total_amount || 0), 0),
      paidRevenue: (bookings || []).reduce((sum: number, booking: any) => {
        const totalPaid = (booking.payments || []).reduce((psum: number, payment: any) => psum + (payment.amount || 0), 0);
        return sum + totalPaid;
      }, 0),
      outstandingRevenue: (bookings || []).reduce((sum: number, booking: any) => {
        const totalPaid = (booking.payments || []).reduce((psum: number, payment: any) => psum + (payment.amount || 0), 0);
        return sum + ((booking.total_amount || 0) - totalPaid);
      }, 0),
      averageRoomRate: bookings && bookings.length > 0 ? (bookings || []).reduce((sum: number, booking: any) => sum + (booking.total_amount || 0), 0) / bookings.length : 0,
      bookingCount: bookings?.length || 0,
      dailyBreakdown: (() => {
        const daily: Record<string, number> = {};
        const start = new Date(startDate);
        const end = new Date(endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          daily[d.toISOString().split('T')[0]] = 0;
        }
        (bookings || []).forEach((b: any) => {
          const date = b.created_at.split('T')[0];
          if (daily[date] !== undefined) {
            daily[date] += (b.total_amount || 0);
          }
        });
        return Object.entries(daily).map(([date, revenue]) => ({ date, revenue })).sort((a, b) => a.date.localeCompare(b.date));
      })()
    };

    res.status(200).json({
      success: true,
      data: revenueData
    });

    logger.info('Revenue report generated');
  } catch (error) {
    next(error);
  }
};

// @desc    Get housekeeping report
// @route   GET /api/reports/housekeeping
// @access  Private (Admin/Manager only)
export const getHousekeepingReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date();
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Get all housekeeping tasks in date range
    const { data: tasks, error: tasksError } = await supabase
      .from('housekeeping_tasks')
      .select('*, assigned_user:users!assigned_to(id, first_name, last_name)')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (tasksError) throw tasksError;

    // Calculate metrics
    const completedTasks = (tasks || []).filter((task: any) => task.status === 'completed');
    const tasksWithTime = (tasks || []).filter((task: any) => task.completed_at && task.started_at);
    
    const metrics = {
      totalTasks: tasks?.length || 0,
      completedTasks: completedTasks.length,
      averageCompletionTime: tasksWithTime.length > 0 
        ? tasksWithTime.reduce((sum: number, task: any) => {
            const completed = new Date(task.completed_at).getTime();
            const started = new Date(task.started_at).getTime();
            return sum + (completed - started) / (1000 * 60); // in minutes
          }, 0) / tasksWithTime.length
        : 0,
      staffPerformance: (tasks || []).reduce((acc: any, task: any) => {
        if (task.assigned_to) {
          const staffId = task.assigned_to;
          if (!acc[staffId]) {
            const user = task.assigned_user;
            acc[staffId] = {
              name: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
              totalTasks: 0,
              completedTasks: 0
            };
          }
          acc[staffId].totalTasks++;
          if (task.status === 'completed') {
            acc[staffId].completedTasks++;
          }
        }
        return acc;
      }, {})
    };

    res.status(200).json({
      success: true,
      data: metrics
    });

    logger.info('Housekeeping report generated');
  } catch (error) {
    next(error);
  }
};

// @desc    Get maintenance report
// @route   GET /api/reports/maintenance
// @access  Private (Admin/Manager only)
export const getMaintenanceReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date();
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Get all maintenance tasks in date range
    const { data: tasks, error: tasksError } = await supabase
      .from('maintenance_tasks')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (tasksError) throw tasksError;

    // Calculate metrics
    const tasksWithTime = (tasks || []).filter((task: any) => task.completed_at && task.started_at);
    
    const metrics = {
      totalTasks: tasks?.length || 0,
      byType: (tasks || []).reduce((acc: any, task: any) => {
        acc[task.type] = (acc[task.type] || 0) + 1;
        return acc;
      }, {}),
      byStatus: (tasks || []).reduce((acc: any, task: any) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {}),
      averageResolutionTime: tasksWithTime.length > 0
        ? tasksWithTime.reduce((sum: number, task: any) => {
            const completed = new Date(task.completed_at).getTime();
            const started = new Date(task.started_at).getTime();
            return sum + (completed - started) / (1000 * 60); // in minutes
          }, 0) / tasksWithTime.length
        : 0,
      totalCost: (tasks || []).reduce((sum: number, task: any) => sum + (task.total_cost || 0), 0)
    };

    res.status(200).json({
      success: true,
      data: metrics
    });

    logger.info('Maintenance report generated');
  } catch (error) {
    next(error);
  }
};

// @desc    Get inventory report
// @route   GET /api/reports/inventory
// @access  Private (Admin/Manager only)
export const getInventoryReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get all inventory items
    const { data: items, error: itemsError } = await supabase
      .from('inventory_items')
      .select('*');

    if (itemsError) throw itemsError;

    // Calculate metrics
    const metrics = {
      totalItems: items?.length || 0,
      totalValue: (items || []).reduce((sum: number, item: any) => sum + (item.current_stock || 0) * (item.unit_cost || 0), 0),
      lowStockItems: (items || []).filter((item: any) => (item.current_stock || 0) <= (item.minimum_stock || 0)),
      outOfStockItems: (items || []).filter((item: any) => (item.current_stock || 0) === 0),
      byCategory: (items || []).reduce((acc: any, item: any) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {}),
      stockMovements: (items || []).reduce((acc: any, item: any) => {
        const movements = item.stock_movements || [];
        return {
          in: acc.in + movements.filter((m: any) => m.type === 'in').reduce((sum: number, m: any) => sum + (m.quantity || 0), 0),
          out: acc.out + movements.filter((m: any) => m.type === 'out').reduce((sum: number, m: any) => sum + (m.quantity || 0), 0)
        };
      }, { in: 0, out: 0 })
    };

    res.status(200).json({
      success: true,
      data: metrics
    });

    logger.info('Inventory report generated');
  } catch (error) {
    next(error);
  }
};

// @desc    Get consolidated dashboard report
// @route   GET /api/reports/dashboard
// @access  Private (Admin/Manager only)
export const getDashboardReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get recent bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (bookingsError) throw bookingsError;

    // Get active tasks
    const { data: housekeepingTasks, error: hkError } = await supabase
      .from('housekeeping_tasks')
      .select('*')
      .in('status', ['pending', 'in_progress']);

    if (hkError) throw hkError;

    const { data: maintenanceTasks, error: mtError } = await supabase
      .from('maintenance_tasks')
      .select('*')
      .in('status', ['pending', 'in_progress']);

    if (mtError) throw mtError;

    // Get inventory alerts
    const { data: lowStockItems, error: invError } = await supabase
      .from('inventory_items')
      .select('*')
      .filter('current_stock', 'lte', 'minimum_stock');

    if (invError) throw invError;

    // Calculate metrics
    const metrics = {
      bookings: {
        total: bookings?.length || 0,
        revenue: (bookings || []).reduce((sum: number, booking: any) => sum + (booking.total_amount || 0), 0),
        upcoming: (bookings || []).filter((booking: any) => new Date(booking.check_in) > today).length
      },
      tasks: {
        housekeeping: housekeepingTasks?.length || 0,
        maintenance: maintenanceTasks?.length || 0
      },
      inventory: {
        lowStock: lowStockItems?.length || 0
      },
      occupancy: {
        current: await calculateCurrentOccupancy()
      }
    };

    res.status(200).json({
      success: true,
      data: metrics
    });

    logger.info('Dashboard report generated');
  } catch (error) {
    next(error);
  }
};

// Helper function to calculate current occupancy
const calculateCurrentOccupancy = async (): Promise<number> => {
  const today = new Date();
  
  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('*');

  if (roomsError || !rooms) return 0;

  const { count: occupiedRooms, error: bookingsError } = await supabase
    .from('bookings')
    .select('*', { count: 'exact' })
    .eq('status', BookingStatus.CHECKED_IN)
    .lte('check_in', today.toISOString())
    .gt('check_out', today.toISOString())
    .limit(0);

  if (bookingsError) return 0;

  return ((occupiedRooms || 0) / rooms.length) * 100;
};

// @desc    Get all reports
// @route   GET /api/reports
// @access  Private
export const getReports = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single report
// @route   GET /api/reports/:id
// @access  Private
export const getReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', req.params.id)
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

// @desc    Create report
// @route   POST /api/reports
// @access  Private
export const createReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .insert([req.body])
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

// @desc    Update report
// @route   PUT /api/reports/:id
// @access  Private
export const updateReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .update(req.body)
      .eq('id', req.params.id)
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

// @desc    Delete report
// @route   DELETE /api/reports/:id
// @access  Private
export const deleteReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate report
// @route   POST /api/reports/:id/generate
// @access  Private
export const generateReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: 'Report generation started'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Schedule report
// @route   POST /api/reports/:id/schedule
// @access  Private
export const scheduleReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: 'Report scheduled'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send report
// @route   POST /api/reports/:id/send
// @access  Private
export const sendReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: 'Report sent'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get report templates
// @route   GET /api/reports/templates
// @access  Private
export const getReportTemplates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('is_template', true);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create report template
// @route   POST /api/reports/templates
// @access  Private
export const createReportTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .insert([{ ...req.body, is_template: true }])
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

// @desc    Update report template
// @route   PUT /api/reports/templates/:id
// @access  Private
export const updateReportTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('is_template', true)
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

// @desc    Delete report template
// @route   DELETE /api/reports/templates/:id
// @access  Private
export const deleteReportTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', req.params.id)
      .eq('is_template', true);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get report history
// @route   GET /api/reports/history
// @access  Private
export const getReportHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('is_template', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get report statistics
// @route   GET /api/reports/stats
// @access  Private
export const getReportStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { count: totalReports, error } = await supabase
      .from('reports')
      .select('*', { count: 'exact' })
      .limit(0);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: {
        totalReports
      }
    });
  } catch (error) {
    next(error);
  }
};
