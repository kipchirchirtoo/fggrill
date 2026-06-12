import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { Booking, BookingStatus } from '../models/Booking';
import { Room } from '../models/Room';
import { HousekeepingTask } from '../models/HousekeepingTask';
import { MaintenanceTask } from '../models/MaintenanceTask';
import { InventoryItem } from '../models/Inventory';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import axios from 'axios';
import {
  generateSupplierStatementPDF,
  generateVATReportPDF,
  generateProcurementIntelligencePDF,
  generateHRPerformancePDF,
  generatePayrollPDF,
  generateLeaveManagementPDF,
  generateDocumentationPDF,
} from '../services/native-pdf-reports.service';
import { PYTHON_SERVICE_URL } from '../config/pythonService';

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
      .from('reservations')
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
      .from('reservations')
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
      .from('reservations')
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

    // Get inventory alerts from the current stock table. The legacy
    // inventory_items.current_stock column is no longer part of this schema.
    const { data: lowStockItems, error: invError } = await supabase
      .from('simple_items')
      .select('sku, item_name, quantity, reorder_level')
      .eq('is_active', true);

    if (invError) throw invError;

    const lowStockCount = (lowStockItems || []).filter((item: any) =>
      Number(item.quantity || 0) <= Number(item.reorder_level || 0)
    ).length;

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
        lowStock: lowStockCount
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

// @desc    Get conference report data
// @route   GET /api/reports/conference
// @access  Private (Admin/Manager only)
export const getConferenceReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filters = req.query;
    const response = await axios.post(`${PYTHON_SERVICE_URL}/api/reports/data?type=conference_summary`, filters);

    res.status(200).json({
      success: true,
      data: response.data
    });

    logger.info('Conference report generated');
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
    const { id } = req.params;
    const { format = 'pdf' } = req.body;

    // Get report details from database
    const { data: report, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !report) {
      res.status(404).json({ success: false, message: 'Report not found' });
      return;
    }

    const endpoint = format === 'pdf'
      ? '/api/reports/generate/branded-pdf'
      : '/api/reports/generate/excel';

    const response = await axios.post(`${PYTHON_SERVICE_URL}${endpoint}`, {
      reportType: report.type || 'generic',
      filters: report.parameters || {},
      useRealData: true
    }, {
      responseType: 'arraybuffer'
    });

    const contentType = format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const extension = format === 'pdf' ? 'pdf' : 'xlsx';
    const filename = `FG_${report.name || 'Report'}_${new Date().toISOString().split('T')[0]}.${extension}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(response.data);

    logger.info(`Report generated from DB: ${id} (${format})`);
  } catch (error) {
    next(error);
  }
};

// ── Helper: fetch payroll data from Supabase and build Python-ready payload ──
const buildPayrollPayload = async (filters: any): Promise<any> => {
  const month      = Number(filters.month)     || new Date().getMonth() + 1;
  const year       = Number(filters.year)      || new Date().getFullYear();
  const branchId   = filters.branch_id ? Number(filters.branch_id) : null;
  const branchName = filters.branch_name || 'All Branches';

  // Fetch payroll rows — month stored as string, year as number (matches payroll-simple controller)
  let query = supabase.from('staff_payroll').select('*')
    .eq('month', String(month))
    .eq('year', year);
  const { data: payrollRows, error: payrollErr } = await query;
  if (payrollErr) logger.error(`buildPayrollPayload payroll fetch error: ${payrollErr.message}`);
  const rows = payrollRows || [];
  logger.info(`buildPayrollPayload: fetched ${rows.length} payroll rows for ${month}/${year}`);

  // Fetch staff profiles
  const staffIds = [...new Set(rows.map((r: any) => r.staff_id).filter(Boolean))];
  let staffMap: Record<string, any> = {};
  let userMap:  Record<string, any> = {};
  let branchMap: Record<string, string> = {};

  if (staffIds.length) {
    const { data: spRows } = await supabase
      .from('staff_profiles')
      .select('id,role,branch_id,first_name,last_name,user_id,employee_id,phone')
      .in('id', staffIds as string[]);
    (spRows || []).forEach((s: any) => { staffMap[s.id] = s; });

    const userIds = (spRows || []).map((s: any) => s.user_id).filter(Boolean);
    if (userIds.length) {
      const { data: uRows } = await supabase
        .from('users').select('id,first_name,last_name').in('id', userIds);
      (uRows || []).forEach((u: any) => { userMap[u.id] = u; });
    }

    const bIds = [...new Set((spRows || []).map((s: any) => s.branch_id).filter(Boolean))];
    if (bIds.length) {
      const { data: bRows } = await supabase
        .from('branches').select('id,name').in('id', bIds as number[]);
      (bRows || []).forEach((b: any) => { branchMap[b.id] = b.name; });
    }
  }

  const employees: any[] = [];
  rows.forEach((r: any) => {
    const sp   = staffMap[r.staff_id] || {};
    const user = userMap[sp.user_id]  || {};
    // branch filter — compare as numbers to avoid string/number mismatch
    if (branchId && Number(sp.branch_id) !== branchId) return;
    const first = user.first_name || sp.first_name || '';
    const last  = user.last_name  || sp.last_name  || '';
    employees.push({
      no:           employees.length + 1,
      emp_id:       sp.employee_id || '—',
      name:         `${first} ${last}`.trim() || 'Unknown',
      phone:        sp.phone || '',
      role:         sp.role  || '—',
      branch:       branchMap[sp.branch_id] || '—',
      basic_salary: parseFloat(r.basic_salary  || 0),
      nssf:         parseFloat(r.nssf_deduction || r.nssf || 0),
      shif:         parseFloat(r.shif_deduction || 0),
      housing_levy: parseFloat(r.housing_levy_deduction || r.housing_levy || 0),
      paye:         parseFloat(r.paye || 0),
      credit_bills: parseFloat(r.total_credit_bills || 0),
      advances:     parseFloat(r.total_advances || 0),
      loans:        parseFloat(r.loan_deduction  || 0),
    });
  });

  logger.info(`buildPayrollPayload: built ${employees.length} employee records`);

  const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const resolvedBranch = branchId && employees.length
    ? (employees[0].branch !== '—' ? employees[0].branch : branchName)
    : 'All Branches';

  return {
    company_name:    'FAMOUSGATE HOTELS',
    company_address: 'Bomet, Kenya',
    company_email:   'famousgateshotelsbmt@gmail.com',
    company_phone:   '0706 782 828',
    period:          monthName,
    branch:          resolvedBranch,
    generated:       new Date().toLocaleString('en-KE'),
    status:          'DRAFT',
    employees,
  };
};

// @desc    Export report directly
// @route   POST /api/reports/export
// @access  Private
export const exportReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reportType, format, filters, data } = req.body;
    logger.info(`Exporting report: ${reportType} (${format})`);

    // ── Pre-emptive Documentation Check ──
    if (reportType === 'documentation' && format === 'pdf') {
      logger.info('Handling documentation PDF request...');
      try {
        await generateDocumentationPDF(res, filters ?? {});
        logger.info('Documentation PDF generated successfully');
        return;
      } catch (pdfErr: any) {
        logger.error(`Documentation PDF error: ${pdfErr.message}`, pdfErr);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: `PDF generation failed: ${pdfErr.message}` });
        }
        return;
      }
    }

    // ── Native Node.js PDF generation (no Python dependency) ──
    if (format === 'pdf') {
      if (reportType === 'supplier_statement') {
        try {
          await generateSupplierStatementPDF(res, filters ?? {});
        } catch (pdfErr: any) {
          logger.error(`Supplier statement PDF error: ${pdfErr.message}`, pdfErr);
          if (!res.headersSent) {
            res.status(500).json({ success: false, message: `PDF generation failed: ${pdfErr.message}` });
          }
        }
        return;
      }
      if (reportType === 'vat_report') {
        try {
          await generateVATReportPDF(res, filters ?? {});
        } catch (pdfErr: any) {
          logger.error(`VAT report PDF error: ${pdfErr.message}`, pdfErr);
          if (!res.headersSent) {
            res.status(500).json({ success: false, message: `PDF generation failed: ${pdfErr.message}` });
          }
        }
        return;
      }
      if (reportType === 'procurement_intelligence') {
        try {
          await generateProcurementIntelligencePDF(res, filters ?? {});
        } catch (pdfErr: any) {
          logger.error(`Procurement intelligence PDF error: ${pdfErr.message}`, pdfErr);
          if (!res.headersSent) {
            res.status(500).json({ success: false, message: `PDF generation failed: ${pdfErr.message}` });
          }
        }
        return;
      }
      if (reportType === 'hr_performance') {
        try {
          await generateHRPerformancePDF(res, filters ?? {});
        } catch (pdfErr: any) {
          logger.error(`HR performance PDF error: ${pdfErr.message}`, pdfErr);
          if (!res.headersSent) {
            res.status(500).json({ success: false, message: `PDF generation failed: ${pdfErr.message}` });
          }
        }
        return;
      }
      if (reportType === 'leave_management') {
        try {
          await generateLeaveManagementPDF(res, filters ?? {});
        } catch (pdfErr: any) {
          logger.error(`Leave management PDF error: ${pdfErr.message}`, pdfErr);
          if (!res.headersSent) {
            res.status(500).json({ success: false, message: `PDF generation failed: ${pdfErr.message}` });
          }
        }
        return;
      }
      if (reportType === 'payroll') {
        try {
          // If frontend already sent employees array, use it directly; otherwise fetch from DB
          let payload: any;
          if (req.body.employees && Array.isArray(req.body.employees)) {
            payload = {
              employees:       req.body.employees,
              period:          req.body.period          || '',
              branch:          req.body.branch          || 'All Branches',
              generated:       req.body.generated       || new Date().toLocaleString('en-KE'),
              status:          req.body.status          || 'DRAFT',
              company_name:    req.body.company_name    || 'FAMOUSGATE HOTELS',
              company_address: req.body.company_address || 'Bomet, Kenya',
              company_email:   req.body.company_email   || 'famousgateshotelsbmt@gmail.com',
              company_phone:   req.body.company_phone   || '0706 782 828',
            };
            logger.info(`Payroll PDF: using ${payload.employees.length} pre-built employee records from frontend`);
          } else {
            payload = await buildPayrollPayload(filters ?? {});
          }
          const response = await axios.post(`${PYTHON_SERVICE_URL}/api/payroll/generate-pdf`, payload, { responseType: 'arraybuffer' });
          res.setHeader('Content-Type', 'application/pdf');
          const branch = (payload.branch || 'All').replace(/\s+/g,'_');
          const period = (payload.period || '').replace(/\s+/g,'_');
          res.setHeader('Content-Disposition', `attachment; filename=FG_Payroll_${branch}_${period}.pdf`);
          res.send(Buffer.from(response.data));
        } catch (pdfErr: any) {
          logger.error(`Payroll PDF (Python) error: ${pdfErr.message}`, pdfErr);
          try {
            await generatePayrollPDF(res, filters ?? {});
          } catch (fallbackErr: any) {
            if (!res.headersSent) res.status(500).json({ success: false, message: `PDF generation failed: ${fallbackErr.message}` });
          }
        }
        return;
      }
    }

    // ── XLSX export via Python ──
    if (format === 'xlsx' && reportType === 'payroll') {
      try {
        // If frontend already sent employees array, use it directly; otherwise fetch from DB
        let payload: any;
        if (req.body.employees && Array.isArray(req.body.employees)) {
          payload = {
            employees:       req.body.employees,
            period:          req.body.period          || '',
            branch:          req.body.branch          || 'All Branches',
            generated:       req.body.generated       || new Date().toLocaleString('en-KE'),
            status:          req.body.status          || 'DRAFT',
            company_name:    req.body.company_name    || 'FAMOUSGATE HOTELS',
            company_address: req.body.company_address || 'Bomet, Kenya',
            company_email:   req.body.company_email   || 'famousgateshotelsbmt@gmail.com',
            company_phone:   req.body.company_phone   || '0706 782 828',
          };
          logger.info(`Payroll XLSX: using ${payload.employees.length} pre-built employee records from frontend`);
        } else {
          payload = await buildPayrollPayload(filters ?? {});
        }
        const response = await axios.post(`${PYTHON_SERVICE_URL}/api/payroll/generate-xlsx`, payload, { responseType: 'arraybuffer' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        const branch = (payload.branch || 'All').replace(/\s+/g,'_');
        const period = (payload.period || '').replace(/\s+/g,'_');
        res.setHeader('Content-Disposition', `attachment; filename=FG_Payroll_${branch}_${period}.xlsx`);
        res.send(Buffer.from(response.data));
      } catch (xlsxErr: any) {
        logger.error(`Payroll XLSX error: ${xlsxErr.message}`, xlsxErr);
        if (!res.headersSent) res.status(500).json({ success: false, message: `XLSX generation failed: ${xlsxErr.message}` });
      }
      return;
    }

    // ── Fallback: proxy to Python service ──
    const endpoint = format === 'pdf'
      ? '/api/reports/generate/branded-pdf'
      : '/api/reports/generate/excel';

    try {
      const response = await axios.post(`${PYTHON_SERVICE_URL}${endpoint}`, {
        reportType,
        filters,
        data,
        useRealData: !data
      }, {
        responseType: 'arraybuffer'
      });

      const contentType = format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const extension = format === 'pdf' ? 'pdf' : 'xlsx';
      const filename = `FG_${reportType}_${new Date().toISOString().split('T')[0]}.${extension}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.send(response.data);

      logger.info(`Report exported successfully: ${reportType} (${format})`);
    } catch (axiosError: any) {
      if (axiosError.response) {
        const errorData = Buffer.from(axiosError.response.data).toString();
        logger.error(`Python service error (${axiosError.response.status}): ${errorData}`);
        res.status(axiosError.response.status).json({
          success: false,
          message: `Python service error: ${errorData}`
        });
      } else {
        logger.error(`Axios error: ${axiosError.message}`);
        throw axiosError;
      }
    }
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

// @desc    Start async branded PDF report generation
// @route   POST /api/reports/generate/async
// @access  Private
export const generateAsyncReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reportType, filters, useRealData, data } = req.body;
    logger.info(`Starting async report generation: ${reportType}`);

    const response = await axios.post(`${PYTHON_SERVICE_URL}/api/reports/generate/branded-pdf/async`, {
      reportType,
      filters,
      useRealData,
      data
    }, { timeout: 15000 });

    res.status(202).json({
      success: true,
      data: response.data
    });
  } catch (error: any) {
    const pythonError =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.response?.data ||
      error.message;
    const message = typeof pythonError === 'string'
      ? pythonError
      : JSON.stringify(pythonError);
    logger.error(`Error starting async report via ${PYTHON_SERVICE_URL}: ${message}`);
    next(new AppError(`Failed to start async report generation: ${message}`, error.response?.status || 500));
  }
};

// @desc    Check status of an async report generation job
// @route   GET /api/reports/jobs/:id/status
// @access  Private
export const getReportJobStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const jobId = req.params.id;

    const response = await axios.get(`${PYTHON_SERVICE_URL}/api/reports/jobs/${jobId}`, {
      timeout: 15000
    });

    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error: any) {
    if (error.response?.status === 404) {
      next(new AppError('Report job not found', 404));
      return;
    }
    const pythonError =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.response?.data ||
      error.message;
    const message = typeof pythonError === 'string'
      ? pythonError
      : JSON.stringify(pythonError);
    logger.error(`Error checking report job status via ${PYTHON_SERVICE_URL}: ${message}`);
    next(new AppError(`Failed to check report job status: ${message}`, error.response?.status || 500));
  }
};
