import { Request, Response } from 'express';
import { supabase } from '../config/database';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// ── Branding constants (mirrors native-pdf-reports.service.ts) ────────────────
const DIR_PRIMARY    = '#1e293b';
const DIR_SECONDARY  = '#64748b';
const DIR_HEADER_BG  = '#1e293b';
const DIR_ROW_BG     = '#f1f5f9';
const DIR_BORDER     = '#e2e8f0';
const DIR_GOLD       = '#c8a84b';
const DIR_SUCCESS    = '#15803d';
const DIR_DANGER     = '#dc2626';

const COMPANY_NAME    = 'FamousGate Hotels';
const COMPANY_ADDRESS = 'Bomet, Kenya  |  famousgateshotelsbmt@gmail.com  |  0706 782 828';

function getDirectorLogoPath() {
  return path.join(process.cwd(), '../frontend/public/fglogo.png');
}

function dirFmt(n: number | null | undefined): string {
  return `KES ${(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
// ─────────────────────────────────────────────────────────────────────────────

const toNumber = (value: any): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const REVENUE_STREAM_KEYS = [
  'restaurant',
  'bar',
  'executive_bar',
  'sports_bar',
  'pool_table',
  'spa_sauna',
  'carwash',
  'conferences',
  'outside_catering',
  'rooms',
  'paid_bills',
  'non_consumables',
  'swimming_pool',
  'other'
];

const normalizeRevenueData = (raw: any = {}) => ({
  restaurant: toNumber(raw.restaurant),
  bar: toNumber(raw.bar),
  executive_bar: toNumber(raw.executive_bar),
  sports_bar: toNumber(raw.sports_bar),
  pool_table: toNumber(raw.pool_table ?? raw.pool),
  spa_sauna: toNumber(raw.spa_sauna ?? raw.spa),
  carwash: toNumber(raw.carwash ?? raw.wash),
  conferences: toNumber(raw.conferences ?? raw.conf),
  outside_catering: toNumber(raw.outside_catering ?? raw.catering),
  rooms: toNumber(raw.rooms),
  paid_bills: toNumber(raw.paid_bills ?? raw.bills),
  non_consumables: toNumber(raw.non_consumables),
  swimming_pool: toNumber(raw.swimming_pool),
  other: toNumber(raw.other)
});

const normalizePaymentData = (raw: any = {}) => {
  const swipe = toNumber(raw.swipe ?? raw.card);
  return {
    cash: toNumber(raw.cash),
    mpesa: toNumber(raw.mpesa),
    swipe,
    card: swipe,
    other: toNumber(raw.other)
  };
};

const normalizeBankingEntries = (raw: any = {}) => {
  const sourceEntries = Array.isArray(raw.entries)
    ? raw.entries
    : Array.isArray(raw.history)
    ? raw.history
    : [];

  return sourceEntries.map((entry: any) => ({
    amount: toNumber(entry?.amount ?? entry?.banked),
    account: String(entry?.account ?? entry?.bank_account ?? ''),
    reference: String(entry?.reference ?? entry?.ref ?? ''),
    time: String(entry?.time ?? entry?.date_time ?? ''),
    method: String(entry?.method ?? 'cash')
  }));
};

/**
 * Enhanced Director Controller
 * Aggregates data from all branches for the hotel owner
 */
export class DirectorEnhancedController {
  /**
   * Get comprehensive dashboard overview
   * Aggregates: Revenue, Expenses, Profit, Occupancy, Staff, Inventory
   */
  static async getComprehensiveDashboard(req: Request, res: Response) {
    try {
      const { startDate, endDate, branchId } = req.query;
      
      const [
        financialData,
        occupancyData,
        staffData,
        inventoryData,
        discrepancyData,
        submissionData
      ] = await Promise.all([
        DirectorEnhancedController.getFinancialMetrics(startDate as string, endDate as string, branchId as string),
        DirectorEnhancedController.getOccupancyMetrics(startDate as string, endDate as string, branchId as string),
        DirectorEnhancedController.getStaffMetrics(branchId as string),
        DirectorEnhancedController.getInventoryMetrics(branchId as string),
        DirectorEnhancedController.getDiscrepancyMetrics(branchId as string),
        DirectorEnhancedController.getBranchSubmissions(startDate as string, endDate as string)
      ]);

      return res.status(200).json({
        success: true,
        data: {
          financial: financialData,
          occupancy: occupancyData,
          staff: staffData,
          inventory: inventoryData,
          discrepancies: discrepancyData,
          submissions: submissionData,
          lastUpdated: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('Comprehensive Dashboard Error:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  /**
   * Get financial metrics from accounting system
   */
  private static async getFinancialMetrics(startDate?: string, endDate?: string, branchId?: string) {
    let dailyQuery = supabase
      .from('daily_financial_records')
      .select('total_revenue, total_expenses, total_cogs, total_payments, net_profit, record_date, status, branch_id, revenue_data, payment_data, banking_data, expected_cash, unbanked_cash, branches(name)');
    
    if (startDate && endDate) {
      dailyQuery = dailyQuery.gte('record_date', startDate).lte('record_date', endDate);
    }
    if (branchId) {
      dailyQuery = dailyQuery.eq('branch_id', branchId);
    }

    const { data: dailyRecords } = await dailyQuery;

    let monthlyQuery = supabase
      .from('monthly_financial_adjustments')
      .select('total_monthly_expenses, monthly_profit, fiscal_year, fiscal_month, branch_id, branches(name)');

    if (startDate && endDate) {
      monthlyQuery = monthlyQuery.gte('created_at', startDate).lte('created_at', endDate);
    }
    if (branchId) {
      monthlyQuery = monthlyQuery.eq('branch_id', branchId);
    }

    const { data: monthlyAdjustments } = await monthlyQuery;

    let invoiceQuery = supabase
      .from('invoices')
      .select('total_amount, status, created_at, branch_id, branches(name)');
    
    if (startDate && endDate) {
      invoiceQuery = invoiceQuery.gte('created_at', startDate).lte('created_at', endDate);
    }
    if (branchId) {
      invoiceQuery = invoiceQuery.eq('branch_id', branchId);
    }

    const { data: invoices } = await invoiceQuery;

    let expenseQuery = supabase
      .from('expenses')
      .select('amount, status, created_at, branch_id, branches(name)');
    
    if (startDate && endDate) {
      expenseQuery = expenseQuery.gte('created_at', startDate).lte('created_at', endDate);
    }
    if (branchId) {
      expenseQuery = expenseQuery.eq('branch_id', branchId);
    }

    const { data: expenses } = await expenseQuery;

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalExpenses = 0;
    let netProfit = 0;

    const monthlyAdjustmentTotal = monthlyAdjustments?.reduce((sum, row) => sum + toNumber(row.total_monthly_expenses), 0) || 0;

    if (dailyRecords && dailyRecords.length > 0) {
      const directExpenses = dailyRecords.reduce((sum, rec) => sum + toNumber(rec.total_expenses), 0);
      totalCogs = dailyRecords.reduce((sum, rec) => sum + toNumber(rec.total_cogs), 0);
      totalRevenue = dailyRecords.reduce((sum, rec) => sum + toNumber(rec.total_revenue), 0);
      totalExpenses = directExpenses + totalCogs + monthlyAdjustmentTotal;
      netProfit = totalRevenue - totalExpenses;
    } else {
      totalRevenue = invoices?.reduce((sum, inv) => sum + toNumber(inv.total_amount), 0) || 0;
      totalExpenses = expenses?.reduce((sum, exp) => sum + toNumber(exp.amount), 0) || 0;
      netProfit = totalRevenue - totalExpenses;
    }

    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const revenueByBranch: any = {};
    const branchDepartmentBreakdown: any = {};
    const departmentTotals: Record<string, number> = REVENUE_STREAM_KEYS.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
    const paymentMethodTotals = { cash: 0, mpesa: 0, swipe: 0, card: 0, other: 0 };
    const bankingTotals = { expectedCash: 0, totalBanked: 0, totalUnbanked: 0, recordsWithVariance: 0 };
    const trendByDate: any = {};
    const statusBreakdown: any = {};

    dailyRecords?.forEach(rec => {
      const branchName = (rec.branches as any)?.name || 'Unknown';
      const revenueData = normalizeRevenueData(rec.revenue_data || {});
      const paymentData = normalizePaymentData(rec.payment_data || {});
      const bankingEntries = normalizeBankingEntries(rec.banking_data || {});
      const recordDate = String(rec.record_date);

      if (!revenueByBranch[branchName]) {
        revenueByBranch[branchName] = { name: branchName, revenue: 0, count: 0, profit: 0, expenses: 0, cogs: 0 };
      }

      if (!branchDepartmentBreakdown[branchName]) {
        branchDepartmentBreakdown[branchName] = {
          name: branchName,
          revenueStreams: REVENUE_STREAM_KEYS.reduce((acc: any, key) => ({ ...acc, [key]: 0 }), {}),
          paymentMethods: { cash: 0, mpesa: 0, swipe: 0, card: 0, other: 0 },
          expectedCash: 0,
          bankedCash: 0,
          unbankedCash: 0,
          records: 0
        };
      }

      if (!trendByDate[recordDate]) {
        trendByDate[recordDate] = {
          date: recordDate,
          revenue: 0,
          expenses: 0,
          cogs: 0,
          profit: 0,
          expectedCash: 0,
          bankedCash: 0
        };
      }

      revenueByBranch[branchName].revenue += toNumber(rec.total_revenue);
      revenueByBranch[branchName].profit += toNumber(rec.net_profit);
      revenueByBranch[branchName].expenses += toNumber(rec.total_expenses);
      revenueByBranch[branchName].cogs += toNumber(rec.total_cogs);
      revenueByBranch[branchName].count += 1;

      REVENUE_STREAM_KEYS.forEach((key) => {
        const amount = toNumber((revenueData as any)[key]);
        departmentTotals[key] += amount;
        branchDepartmentBreakdown[branchName].revenueStreams[key] += amount;
      });

      paymentMethodTotals.cash += toNumber(paymentData.cash);
      paymentMethodTotals.mpesa += toNumber(paymentData.mpesa);
      paymentMethodTotals.swipe += toNumber(paymentData.swipe);
      paymentMethodTotals.card += toNumber(paymentData.card);
      paymentMethodTotals.other += toNumber(paymentData.other);

      branchDepartmentBreakdown[branchName].paymentMethods.cash += toNumber(paymentData.cash);
      branchDepartmentBreakdown[branchName].paymentMethods.mpesa += toNumber(paymentData.mpesa);
      branchDepartmentBreakdown[branchName].paymentMethods.swipe += toNumber(paymentData.swipe);
      branchDepartmentBreakdown[branchName].paymentMethods.card += toNumber(paymentData.card);
      branchDepartmentBreakdown[branchName].paymentMethods.other += toNumber(paymentData.other);

      const bankedFromEntries = bankingEntries.reduce((sum: number, entry: any) => sum + toNumber(entry.amount), 0);
      const bankedCash = bankedFromEntries > 0 ? bankedFromEntries : toNumber((rec.banking_data as any)?.banked);
      const expectedCash = toNumber(rec.expected_cash);
      const unbankedCash = toNumber(rec.unbanked_cash);

      bankingTotals.expectedCash += expectedCash;
      bankingTotals.totalBanked += bankedCash;
      bankingTotals.totalUnbanked += unbankedCash;
      if (Math.abs(unbankedCash) > 0.01 || Math.abs(toNumber(rec.total_revenue) - toNumber(rec.total_payments)) > 1) {
        bankingTotals.recordsWithVariance += 1;
      }

      branchDepartmentBreakdown[branchName].expectedCash += expectedCash;
      branchDepartmentBreakdown[branchName].bankedCash += bankedCash;
      branchDepartmentBreakdown[branchName].unbankedCash += unbankedCash;
      branchDepartmentBreakdown[branchName].records += 1;

      trendByDate[recordDate].revenue += toNumber(rec.total_revenue);
      trendByDate[recordDate].expenses += toNumber(rec.total_expenses);
      trendByDate[recordDate].cogs += toNumber(rec.total_cogs);
      trendByDate[recordDate].profit += toNumber(rec.net_profit);
      trendByDate[recordDate].expectedCash += expectedCash;
      trendByDate[recordDate].bankedCash += bankedCash;

      const status = rec.status || 'UNKNOWN';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    });

    invoices?.forEach(inv => {
      const branchName = (inv.branches as any)?.name || 'Unknown';
      if (!revenueByBranch[branchName]) {
        revenueByBranch[branchName] = { name: branchName, revenue: 0, count: 0, profit: 0, expenses: 0, cogs: 0 };
      }
      if (!dailyRecords?.some(r => (r.branches as any)?.name === branchName)) {
        revenueByBranch[branchName].revenue += toNumber(inv.total_amount);
        revenueByBranch[branchName].count += 1;
      }
    });

    return {
      totalRevenue,
      totalExpenses,
      totalCogs,
      netProfit,
      profitMargin,
      invoiceCount: invoices?.length || 0,
      expenseCount: expenses?.length || 0,
      monthlyAdjustmentCount: monthlyAdjustments?.length || 0,
      monthlyAdjustmentsTotal: monthlyAdjustmentTotal,
      dailyRecordCount: dailyRecords?.length || 0,
      revenueByBranch: Object.values(revenueByBranch),
      revenueByDepartment: departmentTotals,
      branchDepartmentBreakdown: Object.values(branchDepartmentBreakdown),
      paymentMethodTotals,
      bankingTotals,
      statusBreakdown,
      trendByDate: Object.values(trendByDate).sort((a: any, b: any) => a.date.localeCompare(b.date)),
      paidInvoices: invoices?.filter(i => i.status === 'paid').length || 0,
      pendingInvoices: invoices?.filter(i => i.status === 'pending').length || 0
    };
  }

  /**
   * Get occupancy metrics from rooms/bookings
   */
  private static async getOccupancyMetrics(startDate?: string, endDate?: string, branchId?: string) {
    let roomQuery = supabase
      .from('rooms')
      .select('id, status, branch_id, branches(name)');
    
    if (branchId) {
      roomQuery = roomQuery.eq('branch_id', branchId);
    }

    const { data: rooms } = await roomQuery;

    let bookingQuery = supabase
      .from('bookings')
      .select('id, status, check_in, check_out, branch_id, branches(name)');
    
    if (startDate && endDate) {
      bookingQuery = bookingQuery.gte('check_in', startDate).lte('check_out', endDate);
    }
    if (branchId) {
      bookingQuery = bookingQuery.eq('branch_id', branchId);
    }

    const { data: bookings } = await bookingQuery;

    const totalRooms = rooms?.length || 0;
    const occupiedRooms = rooms?.filter(r => r.status === 'occupied').length || 0;
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    const occupancyByBranch: any = {};
    rooms?.forEach(room => {
      const branchName = (room.branches as any)?.name || 'Unknown';
      if (!occupancyByBranch[branchName]) {
        occupancyByBranch[branchName] = { name: branchName, total: 0, occupied: 0 };
      }
      occupancyByBranch[branchName].total += 1;
      if (room.status === 'occupied') occupancyByBranch[branchName].occupied += 1;
    });

    return {
      totalRooms,
      occupiedRooms,
      availableRooms: totalRooms - occupiedRooms,
      occupancyRate,
      totalBookings: bookings?.length || 0,
      confirmedBookings: bookings?.filter(b => b.status === 'confirmed').length || 0,
      occupancyByBranch: Object.values(occupancyByBranch)
    };
  }

  /**
   * Get staff metrics from HR system
   */
  private static async getStaffMetrics(branchId?: string) {
    let staffQuery = supabase
      .from('staff')
      .select('id, status, branch_id, branches(name), position');
    
    if (branchId) {
      staffQuery = staffQuery.eq('branch_id', branchId);
    }

    const { data: staff } = await staffQuery;

    let attendanceQuery = supabase
      .from('attendance')
      .select('id, status, date')
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    
    if (branchId) {
      attendanceQuery = attendanceQuery.eq('branch_id', branchId);
    }

    const { data: attendance } = await attendanceQuery;

    const totalStaff = staff?.length || 0;
    const activeStaff = staff?.filter(s => s.status === 'active').length || 0;
    const attendanceRate = (attendance && attendance.length > 0) 
      ? (attendance.filter(a => a.status === 'present').length / attendance.length) * 100 
      : 0;

    const staffByBranch: any = {};
    staff?.forEach(s => {
      const branchName = (s.branches as any)?.name || 'Unknown';
      if (!staffByBranch[branchName]) {
        staffByBranch[branchName] = { name: branchName, count: 0 };
      }
      staffByBranch[branchName].count += 1;
    });

    return {
      totalStaff,
      activeStaff,
      inactiveStaff: totalStaff - activeStaff,
      attendanceRate,
      staffByBranch: Object.values(staffByBranch)
    };
  }

  /**
   * Get inventory metrics from central store
   */
  private static async getInventoryMetrics(branchId?: string) {
    let query = supabase
      .from('inventory_items')
      .select('id, quantity, reorder_level, unit_cost, branch_id');
    
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data: inventory } = await query;

    const totalItems = inventory?.length || 0;
    const lowStockItems = inventory?.filter(i => Number(i.quantity) <= Number(i.reorder_level)).length || 0;
    const totalValue = inventory?.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_cost || 0)), 0) || 0;

    return {
      totalItems,
      lowStockItems,
      totalValue,
      stockHealthRate: totalItems > 0 ? ((totalItems - lowStockItems) / totalItems) * 100 : 100
    };
  }

  /**
   * Get discrepancy metrics from auditor
   */
  private static async getDiscrepancyMetrics(branchId?: string) {
    let query = supabase
      .from('discrepancy_flags')
      .select('id, status, severity, created_at, branch_id');
    
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data: flags } = await query;

    const totalFlags = flags?.length || 0;
    const pendingFlags = flags?.filter(f => f.status === 'PENDING').length || 0;
    const criticalFlags = flags?.filter(f => f.severity === 'CRITICAL').length || 0;
    const resolvedFlags = flags?.filter(f => f.status === 'RESOLVED').length || 0;

    return {
      totalFlags,
      pendingFlags,
      criticalFlags,
      resolvedFlags,
      resolutionRate: totalFlags > 0 ? (resolvedFlags / totalFlags) * 100 : 100
    };
  }

  /**
   * Get submission status by branch
   */
  private static async getBranchSubmissions(startDate?: string, endDate?: string) {
    const { data: branches } = await supabase.from('branches').select('id, name');
    
    let query = supabase
      .from('daily_financial_records')
      .select('branch_id, record_date, status');
    
    if (startDate && endDate) {
      query = query.gte('record_date', startDate).lte('record_date', endDate);
    }

    const { data: records } = await query;

    return (branches || []).map(branch => {
      const branchRecords = (records || []).filter(r => r.branch_id === branch.id);
      const submittedCount = branchRecords.filter(r => r.status === 'SUBMITTED' || r.status === 'REVIEWED').length;
      const draftCount = branchRecords.filter(r => r.status === 'DRAFT').length;
      
      return {
        id: branch.id,
        name: branch.name,
        totalDays: branchRecords.length,
        submitted: submittedCount,
        draft: draftCount,
        pending: Math.max(0, (startDate && endDate ? 1 : 0) - branchRecords.length) // Simplistic
      };
    });
  }

  /**
   * Get detailed payment breakdown
   */
  static async getPaymentBreakdown(req: Request, res: Response) {
    try {
      const { startDate, endDate, branchId } = req.query;

      let dailyQuery = supabase
        .from('daily_financial_records')
        .select('id, payment_data, total_payments, record_date, branch_id, branches(name)');

      if (startDate && endDate) {
        dailyQuery = dailyQuery.gte('record_date', startDate).lte('record_date', endDate);
      }
      if (branchId) {
        dailyQuery = dailyQuery.eq('branch_id', branchId);
      }

      const { data: dailyRecords } = await dailyQuery;

      let paymentsQuery = supabase
        .from('payments')
        .select('id, amount, payment_method, status, created_at, branch_id, branches(name)');

      if (startDate && endDate) {
        paymentsQuery = paymentsQuery.gte('created_at', startDate).lte('created_at', endDate);
      }
      if (branchId) {
        paymentsQuery = paymentsQuery.eq('branch_id', branchId);
      }

      const { data: payments } = await paymentsQuery;

      const breakdown: any = {
        mpesa: 0,
        cash: 0,
        swipe: 0,
        card: 0,
        bank_transfer: 0,
        other: 0
      };

      const byBranch: any = {};
      const byDate: any = {};
      const history: any[] = [];

      dailyRecords?.forEach(record => {
        const paymentData = normalizePaymentData(record.payment_data || {});
        const branchName = (record.branches as any)?.name || 'Unknown';
        const date = new Date(record.record_date).toISOString().split('T')[0];

        breakdown.mpesa += toNumber(paymentData.mpesa);
        breakdown.cash += toNumber(paymentData.cash);
        breakdown.swipe += toNumber(paymentData.swipe);
        breakdown.card += toNumber(paymentData.card);
        breakdown.other += toNumber(paymentData.other);

        if (!byBranch[branchName]) {
          byBranch[branchName] = { name: branchName, total: 0, methods: {} };
        }
        byBranch[branchName].total += toNumber(record.total_payments);
        byBranch[branchName].methods.mpesa = (byBranch[branchName].methods.mpesa || 0) + toNumber(paymentData.mpesa);
        byBranch[branchName].methods.cash = (byBranch[branchName].methods.cash || 0) + toNumber(paymentData.cash);
        byBranch[branchName].methods.swipe = (byBranch[branchName].methods.swipe || 0) + toNumber(paymentData.swipe);
        byBranch[branchName].methods.card = (byBranch[branchName].methods.card || 0) + toNumber(paymentData.card);
        byBranch[branchName].methods.other = (byBranch[branchName].methods.other || 0) + toNumber(paymentData.other);

        if (!byDate[date]) {
          byDate[date] = { date, total: 0 };
        }
        byDate[date].total += toNumber(record.total_payments);

        history.push({
          date,
          branch: branchName,
          cash: toNumber(paymentData.cash),
          mpesa: toNumber(paymentData.mpesa),
          swipe: toNumber(paymentData.swipe),
          total: toNumber(record.total_payments)
        });
      });

      if (!dailyRecords || dailyRecords.length === 0) {
        payments?.forEach(payment => {
          const amount = toNumber(payment.amount);
          const method = (payment.payment_method || 'other').toLowerCase().replace(/[^a-z_]/g, '_');
          const branchName = (payment.branches as any)?.name || 'Unknown';
          const date = new Date(payment.created_at).toISOString().split('T')[0];

          if (method.includes('mpesa') || method.includes('m_pesa')) {
            breakdown.mpesa += amount;
          } else if (method.includes('cash')) {
            breakdown.cash += amount;
          } else if (method.includes('card') || method.includes('swipe')) {
            breakdown.swipe += amount;
            breakdown.card += amount;
          } else if (method.includes('bank') || method.includes('transfer')) {
            breakdown.bank_transfer += amount;
          } else {
            breakdown.other += amount;
          }

          if (!byBranch[branchName]) {
            byBranch[branchName] = { name: branchName, total: 0, methods: {} };
          }
          byBranch[branchName].total += amount;
          byBranch[branchName].methods[method] = (byBranch[branchName].methods[method] || 0) + amount;

          if (!byDate[date]) {
            byDate[date] = { date, total: 0 };
          }
          byDate[date].total += amount;

          history.push({
            date,
            branch: branchName,
            cash: method.includes('cash') ? amount : 0,
            mpesa: method.includes('mpesa') || method.includes('m_pesa') ? amount : 0,
            swipe: method.includes('card') || method.includes('swipe') ? amount : 0,
            total: amount
          });
        });
      }

      const totalTransactions = (dailyRecords?.length || 0) + (payments?.length || 0);

      return res.status(200).json({
        success: true,
        data: {
          breakdown,
          total: Object.values(breakdown).reduce((sum: number, val: any) => sum + val, 0),
          byBranch: Object.values(byBranch),
          byDate: Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date)),
          history: history.sort((a, b) => a.date.localeCompare(b.date)),
          transactionCount: totalTransactions,
          source: dailyRecords && dailyRecords.length > 0 ? 'daily_records' : 'payments_table'
        }
      });
    } catch (error: any) {
      console.error('Payment Breakdown Error:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  /**
   * Get banking reconciliation data
   */
  static async getBankingReconciliation(req: Request, res: Response) {
    try {
      const { startDate, endDate, branchId } = req.query;

      let dailyQuery = supabase
        .from('daily_financial_records')
        .select('id, expected_cash, banking_data, unbanked_cash, record_date, branch_id, branches(name)');

      if (startDate && endDate) {
        dailyQuery = dailyQuery.gte('record_date', startDate).lte('record_date', endDate);
      }
      if (branchId) {
        dailyQuery = dailyQuery.eq('branch_id', branchId);
      }

      const { data: dailyRecords } = await dailyQuery;

      let txnQuery = supabase
        .from('bank_transactions')
        .select('id, amount, type, status, transaction_date, branch_id, branches(name)');

      if (startDate && endDate) {
        txnQuery = txnQuery.gte('transaction_date', startDate).lte('transaction_date', endDate);
      }
      if (branchId) {
        txnQuery = txnQuery.eq('branch_id', branchId);
      }

      const { data: transactions } = await txnQuery;

      const byBranch: any = {};
      const history: any[] = [];
      const totals = {
        expectedCash: 0,
        totalBanked: 0,
        totalUnbanked: 0
      };

      dailyRecords?.forEach(rec => {
        const branchName = (rec.branches as any)?.name || 'Unknown';
        if (!byBranch[branchName]) {
          byBranch[branchName] = {
            name: branchName,
            expectedCash: 0,
            totalExpected: 0,
            totalBanked: 0,
            totalUnbanked: 0,
            deposits: 0,
            withdrawals: 0,
            pending: 0,
            reconciled: 0,
            discrepancyCount: 0
          };
        }

        const expectedCash = toNumber(rec.expected_cash);
        const entries = normalizeBankingEntries(rec.banking_data || {});
        const bankedFromEntries = entries.reduce((sum: number, entry: any) => sum + toNumber(entry.amount), 0);
        const banked = bankedFromEntries > 0 ? bankedFromEntries : toNumber(rec.banking_data?.banked);
        const unbanked = toNumber(rec.unbanked_cash);

        byBranch[branchName].expectedCash += expectedCash;
        byBranch[branchName].totalExpected += expectedCash;
        byBranch[branchName].totalBanked += banked;
        byBranch[branchName].totalUnbanked += unbanked;
        byBranch[branchName].deposits += banked;
        byBranch[branchName].reconciled += banked;
        
        if (unbanked > 0) {
          byBranch[branchName].pending += unbanked;
          byBranch[branchName].discrepancyCount += 1;
        }

        totals.expectedCash += expectedCash;
        totals.totalBanked += banked;
        totals.totalUnbanked += unbanked;

        if (entries.length > 0) {
          entries.forEach((entry: any) => {
            history.push({
              branch: branchName,
              date: rec.record_date,
              amount: toNumber(entry.amount),
              account: entry.account,
              reference: entry.reference,
              method: entry.method,
              expectedCash
            });
          });
        } else {
          history.push({
            branch: branchName,
            date: rec.record_date,
            amount: banked,
            account: rec.banking_data?.account || rec.banking_data?.primary_account || '',
            reference: rec.banking_data?.ref || rec.banking_data?.primary_reference || '',
            method: 'cash',
            expectedCash
          });
        }
      });

      if (!dailyRecords || dailyRecords.length === 0) {
        transactions?.forEach(txn => {
          const branchName = (txn.branches as any)?.name || 'Unknown';
          if (!byBranch[branchName]) {
            byBranch[branchName] = {
              name: branchName,
              expectedCash: 0,
              totalExpected: 0,
              totalBanked: 0,
              totalUnbanked: 0,
              deposits: 0,
              withdrawals: 0,
              pending: 0,
              reconciled: 0,
              discrepancyCount: 0
            };
          }

          const amount = toNumber(txn.amount);
          if (txn.type === 'deposit') {
            byBranch[branchName].deposits += amount;
            byBranch[branchName].totalBanked += amount;
            totals.totalBanked += amount;
            history.push({
              branch: branchName,
              date: txn.transaction_date,
              amount,
              account: '',
              reference: '',
              method: 'bank_deposit',
              expectedCash: 0
            });
          } else if (txn.type === 'withdrawal') {
            byBranch[branchName].withdrawals += amount;
          }

          if (txn.status === 'pending') {
            byBranch[branchName].pending += amount;
            byBranch[branchName].totalUnbanked += amount;
            byBranch[branchName].discrepancyCount += 1;
            totals.totalUnbanked += amount;
          } else if (txn.status === 'reconciled') {
            byBranch[branchName].reconciled += amount;
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          branches: Object.values(byBranch),
          history: history.sort((a, b) => String(a.date).localeCompare(String(b.date))),
          totals,
          totalTransactions: (dailyRecords?.length || 0) + (transactions?.length || 0),
          source: dailyRecords && dailyRecords.length > 0 ? 'daily_records' : 'bank_transactions'
        }
      });
    } catch (error: any) {
      console.error('Banking Reconciliation Error:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  /**
   * Export comprehensive branded PDF report — matches Payroll Summary UI
   */
  static async exportPDFReport(req: Request, res: Response) {
    try {
      const { startDate, endDate, reportType, branchId } = req.query;

      let data: any = {};

      if (reportType === 'financial' || reportType === 'comprehensive') {
        data.financial = await DirectorEnhancedController.getFinancialMetrics(startDate as string, endDate as string, branchId as string);
      }
      if (reportType === 'occupancy' || reportType === 'comprehensive') {
        data.occupancy = await DirectorEnhancedController.getOccupancyMetrics(startDate as string, endDate as string, branchId as string);
      }
      if (reportType === 'staff' || reportType === 'comprehensive') {
        data.staff = await DirectorEnhancedController.getStaffMetrics(branchId as string);
      }

      // ── Document Setup ──────────────────────────────────────────────────────
      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      const PAGE_W = 595; // A4 portrait width in pts
      const MARGIN = 40;
      const CONTENT_W = PAGE_W - MARGIN * 2;
      const dateStr = new Date().toISOString().split('T')[0];

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Director_Executive_Report_${dateStr}.pdf"`);
      doc.pipe(res);

      // ── Branded Header ──────────────────────────────────────────────────────
      const drawHeader = () => {
        const logoPath = getDirectorLogoPath();
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, MARGIN, 25, { height: 50 });
        } else {
          // Fallback circle monogram
          doc.circle(MARGIN + 25, 50, 25).fill(DIR_PRIMARY);
          doc.fillColor('white').fontSize(12).font('Helvetica-Bold').text('FG', MARGIN + 12, 43);
        }

        // Company name & address (right of logo)
        doc.fillColor(DIR_PRIMARY).fontSize(16).font('Helvetica-Bold')
          .text(COMPANY_NAME, MARGIN + 65, 26, { width: CONTENT_W - 65 });
        doc.fillColor(DIR_SECONDARY).fontSize(8).font('Helvetica')
          .text(COMPANY_ADDRESS, MARGIN + 65, 46, { width: CONTENT_W - 65 });

        // Report title block (right-aligned)
        doc.fillColor(DIR_PRIMARY).fontSize(11).font('Helvetica-Bold')
          .text('DIRECTOR EXECUTIVE REPORT', MARGIN, 26, { width: CONTENT_W, align: 'right' });
        const periodLabel = `${startDate || 'All Time'} – ${endDate || 'Present'}`;
        doc.fillColor(DIR_SECONDARY).fontSize(8).font('Helvetica')
          .text(`Period: ${periodLabel}`, MARGIN, 42, { width: CONTENT_W, align: 'right' });
        doc.fillColor(DIR_SECONDARY).fontSize(8)
          .text(`Generated: ${new Date().toLocaleString('en-US')}`, MARGIN, 54, { width: CONTENT_W, align: 'right' });

        // Divider
        doc.strokeColor(DIR_BORDER).lineWidth(1)
          .moveTo(MARGIN, 82).lineTo(PAGE_W - MARGIN, 82).stroke();
        // Gold accent bar
        doc.rect(MARGIN, 83, CONTENT_W, 3).fill(DIR_GOLD);

        return 100; // y after header
      };

      // ── Section Heading ─────────────────────────────────────────────────────
      const drawSectionHeading = (title: string, y: number): number => {
        doc.rect(MARGIN, y, CONTENT_W, 22).fill(DIR_HEADER_BG);
        doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
          .text(title.toUpperCase(), MARGIN + 8, y + 6, { width: CONTENT_W - 16 });
        return y + 22;
      };

      // ── Metric Row ──────────────────────────────────────────────────────────
      const drawMetricRow = (
        label: string, value: string, y: number, index: number, highlight?: 'success' | 'danger'
      ): number => {
        if (index % 2 === 0) doc.rect(MARGIN, y, CONTENT_W, 20).fill(DIR_ROW_BG);
        doc.strokeColor(DIR_BORDER).lineWidth(0.3)
          .moveTo(MARGIN, y + 20).lineTo(PAGE_W - MARGIN, y + 20).stroke();
        doc.fillColor(DIR_SECONDARY).fontSize(9).font('Helvetica')
          .text(label, MARGIN + 8, y + 5, { width: CONTENT_W * 0.55 });
        const valueColor = highlight === 'success' ? DIR_SUCCESS : highlight === 'danger' ? DIR_DANGER : DIR_PRIMARY;
        doc.fillColor(valueColor).fontSize(9).font('Helvetica-Bold')
          .text(value, MARGIN + 8, y + 5, { width: CONTENT_W - 16, align: 'right' });
        return y + 20;
      };

      // ── Summary KPI Cards (2×N grid) ────────────────────────────────────────
      const drawKpiCards = (items: { label: string; value: string; sub?: string; accent?: string }[], startY: number): number => {
        const cardW = (CONTENT_W - 10) / 2;
        const cardH = 52;
        let cx = MARGIN;
        let cy = startY;
        items.forEach((item, i) => {
          const accent = item.accent || DIR_GOLD;
          doc.rect(cx, cy, cardW, cardH).fillAndStroke('#ffffff', DIR_BORDER);
          doc.rect(cx, cy, 4, cardH).fill(accent);
          doc.fillColor(DIR_SECONDARY).fontSize(8).font('Helvetica')
            .text(item.label.toUpperCase(), cx + 12, cy + 8, { width: cardW - 20 });
          doc.fillColor(DIR_PRIMARY).fontSize(14).font('Helvetica-Bold')
            .text(item.value, cx + 12, cy + 20, { width: cardW - 20 });
          if (item.sub) {
            doc.fillColor(DIR_SECONDARY).fontSize(7.5).font('Helvetica')
              .text(item.sub, cx + 12, cy + 38, { width: cardW - 20 });
          }
          if (i % 2 === 0) {
            cx += cardW + 10;
          } else {
            cx = MARGIN;
            cy += cardH + 8;
          }
        });
        if (items.length % 2 !== 0) cy += cardH + 8;
        return cy + 8;
      };

      // ── Footer ───────────────────────────────────────────────────────────────
      const drawFooter = () => {
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.strokeColor(DIR_BORDER).lineWidth(0.5)
            .moveTo(MARGIN, doc.page.height - 42).lineTo(PAGE_W - MARGIN, doc.page.height - 42).stroke();
          doc.fillColor(DIR_SECONDARY).fontSize(7.5).font('Helvetica')
            .text(
              `${COMPANY_NAME}  ·  Director Executive Report  ·  Confidential`,
              MARGIN, doc.page.height - 32, { width: CONTENT_W * 0.65 }
            );
          doc.fillColor(DIR_SECONDARY).fontSize(7.5)
            .text(`Page ${i + 1} of ${range.count}`, MARGIN, doc.page.height - 32, { width: CONTENT_W, align: 'right' });
        }
      };

      // ── Build Page ───────────────────────────────────────────────────────────
      let y = drawHeader();

      // Financial section
      if (data.financial) {
        y = drawSectionHeading('Financial Overview', y);
        y += 10;

        const netProfit = toNumber(data.financial.netProfit);
        const kpis = [
          { label: 'Total Revenue', value: dirFmt(data.financial.totalRevenue), accent: DIR_SUCCESS },
          { label: 'Net Profit', value: dirFmt(netProfit), accent: netProfit >= 0 ? DIR_SUCCESS : DIR_DANGER },
          { label: 'Total COGS', value: dirFmt(data.financial.totalCogs), accent: DIR_GOLD },
          { label: 'Total Expenses', value: dirFmt(data.financial.totalExpenses), accent: DIR_GOLD },
        ];
        y = drawKpiCards(kpis, y);

        const metrics = [
          { label: 'Profit Margin', value: `${toNumber(data.financial.profitMargin).toFixed(2)}%` },
          { label: 'Total Banked', value: dirFmt(data.financial.totalBanked) },
          { label: 'Unbanked Cash', value: dirFmt(data.financial.totalUnbanked) },
          { label: 'Pending Discrepancies', value: String(data.financial.pendingDiscrepancies || 0) },
        ];
        metrics.forEach((m, i) => { y = drawMetricRow(m.label, m.value, y, i); });
        y += 18;
      }

      // Occupancy section
      if (data.occupancy) {
        if (y > 640) { doc.addPage(); y = drawHeader(); }
        y = drawSectionHeading('Occupancy Overview', y);
        y += 10;

        const occ = toNumber(data.occupancy.occupancyRate);
        const occKpis = [
          { label: 'Occupancy Rate', value: `${occ.toFixed(1)}%`, accent: occ >= 70 ? DIR_SUCCESS : DIR_GOLD },
          { label: 'Occupied Rooms', value: `${data.occupancy.occupiedRooms} / ${data.occupancy.totalRooms}`, accent: DIR_PRIMARY },
        ];
        y = drawKpiCards(occKpis, y);

        const occMetrics = [
          { label: 'Total Rooms', value: String(data.occupancy.totalRooms) },
          { label: 'Available Rooms', value: String(toNumber(data.occupancy.totalRooms) - toNumber(data.occupancy.occupiedRooms)) },
          { label: 'Revenue Per Room', value: dirFmt(data.occupancy.revenuePerRoom) },
        ];
        occMetrics.forEach((m, i) => { y = drawMetricRow(m.label, m.value, y, i); });
        y += 18;
      }

      // Staff section
      if (data.staff) {
        if (y > 640) { doc.addPage(); y = drawHeader(); }
        y = drawSectionHeading('Staff Overview', y);
        y += 10;

        const attRate = toNumber(data.staff.attendanceRate);
        const staffKpis = [
          { label: 'Active Staff', value: String(data.staff.activeStaff), accent: DIR_SUCCESS },
          { label: 'Attendance Rate', value: `${attRate.toFixed(1)}%`, accent: attRate >= 80 ? DIR_SUCCESS : DIR_DANGER },
        ];
        y = drawKpiCards(staffKpis, y);

        const staffMetrics = [
          { label: 'Total Staff', value: String(data.staff.totalStaff) },
          { label: 'Inactive Staff', value: String(toNumber(data.staff.totalStaff) - toNumber(data.staff.activeStaff)) },
        ];
        staffMetrics.forEach((m, i) => { y = drawMetricRow(m.label, m.value, y, i); });
      }

      drawFooter();
      doc.end();

    } catch (error: any) {
      console.error('PDF Export Error:', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Transaction-level drill-down data for a specific branch, date, and stream
   * @route GET /api/finance/director/drill-down
   */
  static async getDrillDownData(req: Request, res: Response) {
    try {
      const { branch_id, date, stream } = req.query as Record<string, string>;

      if (!branch_id || !date || !stream) {
        return res.status(400).json({ success: false, message: 'branch_id, date, and stream are required' });
      }

      // Fetch the daily record for that branch/date
      const { data: record, error } = await supabase
        .from('daily_financial_records')
        .select('*, branches(name)')
        .eq('branch_id', branch_id)
        .eq('record_date', date)
        .maybeSingle();

      if (error) throw error;

      const branchName = (record?.branches as any)?.name || `Branch ${branch_id}`;

      if (!record) {
        return res.status(200).json({
          success: true,
          data: { rows: [], summary: {}, branchName, date, stream, hasRecord: false }
        });
      }

      const streamLower = (stream as string).toLowerCase();
      let rows: any[] = [];
      let summary: any = {};

      if (streamLower.includes('revenue')) {
        const rev = normalizeRevenueData(record.revenue_data || {});
        const labels: Record<string, string> = {
          restaurant: 'Restaurant', bar: 'Bar', executive_bar: 'Executive Bar',
          sports_bar: 'Sports Bar', pool_table: 'Pool Table', spa_sauna: 'Spa & Sauna',
          carwash: 'Carwash', conferences: 'Conferences', outside_catering: 'Outside Catering',
          rooms: 'Rooms', paid_bills: 'Paid Bills', non_consumables: 'Non-Consumables',
          swimming_pool: 'Swimming Pool', other: 'Other'
        };
        rows = Object.entries(rev).map(([key, value]) => ({
          stream: labels[key] || key,
          amount: toNumber(value),
          percentage: toNumber(record.total_revenue) > 0
            ? ((toNumber(value) / toNumber(record.total_revenue)) * 100).toFixed(1) + '%'
            : '0%'
        })).filter(r => r.amount > 0);
        summary = { total: toNumber(record.total_revenue), label: 'Total Revenue' };

      } else if (streamLower.includes('payment')) {
        const pay = normalizePaymentData(record.payment_data || {});
        rows = [
          { method: 'Cash', amount: pay.cash },
          { method: 'MPESA', amount: pay.mpesa },
          { method: 'Swipe / Card', amount: pay.swipe },
          { method: 'Other', amount: pay.other },
        ].filter(r => r.amount > 0);
        summary = { total: pay.cash + pay.mpesa + pay.swipe + pay.other, label: 'Total Payments' };

      } else if (streamLower.includes('expense') || streamLower.includes('cost')) {
        const exp = record.expenses_data || {};
        const cogs = record.cogs_data || {};
        const allEntries = { ...exp, ...cogs };
        rows = Object.entries(allEntries).map(([key, value]) => ({
          category: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          amount: toNumber(value)
        })).filter(r => r.amount > 0);
        // Also show petty cash and cost lines from record
        if (rows.length === 0) {
          rows = [
            { category: 'Total Expenses', amount: toNumber(record.total_expenses) },
            { category: 'Total COGS', amount: toNumber(record.total_cogs) }
          ];
        }
        summary = { total: toNumber(record.total_expenses) + toNumber(record.total_cogs), label: 'Total Costs' };

      } else if (streamLower.includes('audit') || streamLower.includes('flag')) {
        const { data: flags } = await supabase
          .from('discrepancy_flags')
          .select('*')
          .eq('branch_id', branch_id)
          .eq('record_date', date);
        rows = (flags || []).map((f: any) => ({
          id: f.id,
          flag_type: (f.flag_type || '').replace(/_/g, ' '),
          severity: f.severity,
          status: f.status,
          description: f.description,
          created_at: f.created_at
        }));
        summary = { total: rows.length, label: 'Total Flags' };

      } else if (streamLower.includes('bank')) {
        const entries = normalizeBankingEntries(record.banking_data || {});
        rows = entries.map((e: any) => ({
          amount: e.amount,
          account: e.account || '—',
          reference: e.reference || '—',
          time: e.time || '—',
          method: e.method || 'cash'
        }));
        const totalBanked = entries.reduce((s: number, e: any) => s + toNumber(e.amount), 0);
        summary = {
          totalBanked,
          unbanked: toNumber(record.unbanked_cash),
          expected: toNumber(record.expected_cash),
          label: 'Banking Summary'
        };
      }

      return res.status(200).json({
        success: true,
        data: {
          rows,
          summary,
          branchName,
          date,
          stream,
          hasRecord: true,
          recordStatus: record.status,
          totalRevenue: toNumber(record.total_revenue),
          totalExpenses: toNumber(record.total_expenses),
          netProfit: toNumber(record.net_profit)
        }
      });
    } catch (error: any) {
      console.error('Drill-down Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
