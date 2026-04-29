import { Request, Response } from 'express';
import { supabase } from '../config/database';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';

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
      const { startDate, endDate } = req.query;
      
      // Parallel data fetching for performance
      const [
        financialData,
        occupancyData,
        staffData,
        inventoryData,
        discrepancyData
      ] = await Promise.all([
        DirectorEnhancedController.getFinancialMetrics(startDate as string, endDate as string),
        DirectorEnhancedController.getOccupancyMetrics(startDate as string, endDate as string),
        DirectorEnhancedController.getStaffMetrics(),
        DirectorEnhancedController.getInventoryMetrics(),
        DirectorEnhancedController.getDiscrepancyMetrics()
      ]);

      return res.status(200).json({
        success: true,
        data: {
          financial: financialData,
          occupancy: occupancyData,
          staff: staffData,
          inventory: inventoryData,
          discrepancies: discrepancyData,
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
  private static async getFinancialMetrics(startDate?: string, endDate?: string) {
    // Get revenue from invoices
    let invoiceQuery = supabase
      .from('invoices')
      .select('total_amount, status, created_at, branch_id, branches(name)');
    
    if (startDate && endDate) {
      invoiceQuery = invoiceQuery.gte('created_at', startDate).lte('created_at', endDate);
    }

    const { data: invoices } = await invoiceQuery;

    // Get expenses
    let expenseQuery = supabase
      .from('expenses')
      .select('amount, status, created_at, branch_id, branches(name)');
    
    if (startDate && endDate) {
      expenseQuery = expenseQuery.gte('created_at', startDate).lte('created_at', endDate);
    }

    const { data: expenses } = await expenseQuery;

    // Calculate totals
    const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;
    const totalExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount || 0), 0) || 0;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Revenue by branch
    const revenueByBranch: any = {};
    invoices?.forEach(inv => {
      const branchName = (inv.branches as any)?.name || 'Unknown';
      if (!revenueByBranch[branchName]) {
        revenueByBranch[branchName] = { name: branchName, revenue: 0, count: 0 };
      }
      revenueByBranch[branchName].revenue += Number(inv.total_amount || 0);
      revenueByBranch[branchName].count += 1;
    });

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      invoiceCount: invoices?.length || 0,
      expenseCount: expenses?.length || 0,
      revenueByBranch: Object.values(revenueByBranch),
      paidInvoices: invoices?.filter(i => i.status === 'paid').length || 0,
      pendingInvoices: invoices?.filter(i => i.status === 'pending').length || 0
    };
  }

  /**
   * Get occupancy metrics from rooms/bookings
   */
  private static async getOccupancyMetrics(startDate?: string, endDate?: string) {
    // Get total rooms
    const { data: rooms } = await supabase
      .from('rooms')
      .select('id, status, branch_id, branches(name)');

    // Get bookings
    let bookingQuery = supabase
      .from('bookings')
      .select('id, status, check_in, check_out, branch_id, branches(name)');
    
    if (startDate && endDate) {
      bookingQuery = bookingQuery.gte('check_in', startDate).lte('check_out', endDate);
    }

    const { data: bookings } = await bookingQuery;

    const totalRooms = rooms?.length || 0;
    const occupiedRooms = rooms?.filter(r => r.status === 'occupied').length || 0;
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    // Occupancy by branch
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
  private static async getStaffMetrics() {
    const { data: staff } = await supabase
      .from('staff')
      .select('id, status, branch_id, branches(name), position');

    const { data: attendance } = await supabase
      .from('attendance')
      .select('id, status, date')
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const totalStaff = staff?.length || 0;
    const activeStaff = staff?.filter(s => s.status === 'active').length || 0;
    const attendanceRate = attendance?.length > 0 
      ? (attendance.filter(a => a.status === 'present').length / attendance.length) * 100 
      : 0;

    // Staff by branch
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
  private static async getInventoryMetrics() {
    const { data: inventory } = await supabase
      .from('inventory_items')
      .select('id, quantity, reorder_level, unit_cost');

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
  private static async getDiscrepancyMetrics() {
    const { data: flags } = await supabase
      .from('discrepancy_flags')
      .select('id, status, severity, created_at');

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
   * Get detailed payment breakdown
   */
  static async getPaymentBreakdown(req: Request, res: Response) {
    try {
      const { startDate, endDate, branchId } = req.query;

      let query = supabase
        .from('payments')
        .select('id, amount, payment_method, status, created_at, branch_id, branches(name)');

      if (startDate && endDate) {
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      }
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data: payments, error } = await query;
      
      if (error) throw error;

      // Aggregate by payment method
      const breakdown: any = {
        mpesa: 0,
        cash: 0,
        card: 0,
        bank_transfer: 0,
        other: 0
      };

      const byBranch: any = {};
      const byDate: any = {};

      payments?.forEach(payment => {
        const amount = Number(payment.amount || 0);
        const method = (payment.payment_method || 'other').toLowerCase();
        const branchName = (payment.branches as any)?.name || 'Unknown';
        const date = format(new Date(payment.created_at), 'yyyy-MM-dd');

        // By method
        if (breakdown[method] !== undefined) {
          breakdown[method] += amount;
        } else {
          breakdown.other += amount;
        }

        // By branch
        if (!byBranch[branchName]) {
          byBranch[branchName] = { name: branchName, total: 0, methods: {} };
        }
        byBranch[branchName].total += amount;
        byBranch[branchName].methods[method] = (byBranch[branchName].methods[method] || 0) + amount;

        // By date
        if (!byDate[date]) {
          byDate[date] = { date, total: 0 };
        }
        byDate[date].total += amount;
      });

      return res.status(200).json({
        success: true,
        data: {
          breakdown,
          total: Object.values(breakdown).reduce((sum: number, val: any) => sum + val, 0),
          byBranch: Object.values(byBranch),
          byDate: Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date)),
          transactionCount: payments?.length || 0
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
      const { startDate, endDate } = req.query;

      let query = supabase
        .from('bank_transactions')
        .select('id, amount, type, status, transaction_date, branch_id, branches(name)');

      if (startDate && endDate) {
        query = query.gte('transaction_date', startDate).lte('transaction_date', endDate);
      }

      const { data: transactions, error } = await query;
      
      if (error) throw error;

      const byBranch: any = {};

      transactions?.forEach(txn => {
        const branchName = (txn.branches as any)?.name || 'Unknown';
        if (!byBranch[branchName]) {
          byBranch[branchName] = {
            name: branchName,
            deposits: 0,
            withdrawals: 0,
            pending: 0,
            reconciled: 0
          };
        }

        const amount = Number(txn.amount || 0);
        if (txn.type === 'deposit') {
          byBranch[branchName].deposits += amount;
        } else if (txn.type === 'withdrawal') {
          byBranch[branchName].withdrawals += amount;
        }

        if (txn.status === 'pending') {
          byBranch[branchName].pending += amount;
        } else if (txn.status === 'reconciled') {
          byBranch[branchName].reconciled += amount;
        }
      });

      return res.status(200).json({
        success: true,
        data: {
          branches: Object.values(byBranch),
          totalTransactions: transactions?.length || 0
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
   * Export comprehensive PDF report
   */
  static async exportPDFReport(req: Request, res: Response) {
    try {
      const { startDate, endDate, reportType } = req.query;

      // Fetch data based on report type
      let data: any = {};
      
      if (reportType === 'financial' || reportType === 'comprehensive') {
        data.financial = await DirectorEnhancedController.getFinancialMetrics(startDate as string, endDate as string);
      }
      if (reportType === 'occupancy' || reportType === 'comprehensive') {
        data.occupancy = await DirectorEnhancedController.getOccupancyMetrics(startDate as string, endDate as string);
      }
      if (reportType === 'staff' || reportType === 'comprehensive') {
        data.staff = await DirectorEnhancedController.getStaffMetrics();
      }

      // Generate PDF
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Director_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      doc.pipe(res);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('Famous Gate Hotels', { align: 'center' });
      doc.fontSize(14).font('Helvetica').text('Director Executive Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Period: ${startDate || 'All Time'} to ${endDate || 'Present'}`, { align: 'center' });
      doc.moveDown(2);

      // Financial Section
      if (data.financial) {
        doc.fontSize(14).font('Helvetica-Bold').text('Financial Overview');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Total Revenue: KES ${data.financial.totalRevenue.toLocaleString()}`);
        doc.text(`Total Expenses: KES ${data.financial.totalExpenses.toLocaleString()}`);
        doc.text(`Net Profit: KES ${data.financial.netProfit.toLocaleString()}`);
        doc.text(`Profit Margin: ${data.financial.profitMargin.toFixed(2)}%`);
        doc.moveDown(2);
      }

      // Occupancy Section
      if (data.occupancy) {
        doc.fontSize(14).font('Helvetica-Bold').text('Occupancy Overview');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Total Rooms: ${data.occupancy.totalRooms}`);
        doc.text(`Occupied: ${data.occupancy.occupiedRooms}`);
        doc.text(`Occupancy Rate: ${data.occupancy.occupancyRate.toFixed(2)}%`);
        doc.moveDown(2);
      }

      // Staff Section
      if (data.staff) {
        doc.fontSize(14).font('Helvetica-Bold').text('Staff Overview');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Total Staff: ${data.staff.totalStaff}`);
        doc.text(`Active Staff: ${data.staff.activeStaff}`);
        doc.text(`Attendance Rate: ${data.staff.attendanceRate.toFixed(2)}%`);
      }

      // Footer
      doc.moveDown(3);
      doc.fontSize(8).text(`Generated on ${format(new Date(), 'PPpp')}`, { align: 'center' });
      doc.text('Famous Gate Hotels - Confidential', { align: 'center' });

      doc.end();
    } catch (error: any) {
      console.error('PDF Export Error:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }
}
