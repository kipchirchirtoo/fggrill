import { Request, Response } from 'express';
import { supabase } from '../config/database';

export class DirectorController {
  
  /**
   * Get global financial overview (Total Revenue, Expenses, Profit)
   */
  static async getGlobalOverview(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      // Aggregating daily financial records across all branches
      let query = supabase
        .from('daily_financial_records')
        .select('total_revenue, total_expenses, net_profit, record_date');

      if (startDate && endDate) {
        query = query.gte('record_date', startDate).lte('record_date', endDate);
      }

      const { data: dailyData, error: dailyError } = await query;
      if (dailyError) throw dailyError;

      // Aggregating monthly adjustments (Fixed costs)
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('monthly_financial_adjustments')
        .select('total_monthly_expenses');
      
      if (monthlyError) throw monthlyError;

      const totalRevenue = dailyData?.reduce((sum, r) => sum + Number(r.total_revenue || 0), 0) || 0;
      const dailyExpenses = dailyData?.reduce((sum, r) => sum + Number(r.total_expenses || 0), 0) || 0;
      const monthlyExpenses = monthlyData?.reduce((sum, r) => sum + Number(r.total_monthly_expenses || 0), 0) || 0;
      
      const totalExpenses = dailyExpenses + monthlyExpenses;
      const netProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      return res.status(200).json({
        success: true,
        data: {
          totalRevenue,
          totalExpenses,
          netProfit,
          profitMargin,
          recordCount: dailyData?.length || 0
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get payment intelligence (MPESA, Cash, Card breakdown)
   */
  static async getPaymentIntelligence(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      let query = supabase
        .from('daily_financial_records')
        .select('payment_data, total_payments, total_revenue');

      if (startDate && endDate) {
        query = query.gte('record_date', startDate).lte('record_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      let mpesa = 0, cash = 0, card = 0;
      
      data?.forEach(record => {
        const p = record.payment_data || {};
        mpesa += Number(p.mpesa || 0);
        cash += Number(p.cash || 0);
        card += Number(p.card || 0);
      });

      return res.status(200).json({
        success: true,
        data: {
          mpesa,
          cash,
          card,
          total: mpesa + cash + card
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get banking control (Cash collected vs Banked per branch)
   */
  static async getBankingControl(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      let query = supabase
        .from('daily_financial_records')
        .select('branch_id, record_date, expected_cash, banking_data, unbanked_cash, branches(name)');

      if (startDate && endDate) {
        query = query.gte('record_date', startDate).lte('record_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by branch
      const branchSummary: any = {};

      data?.forEach(record => {
        const bId = record.branch_id;
        if (!branchSummary[bId]) {
          branchSummary[bId] = {
            id: bId,
            name: (record.branches as any)?.name || 'Unknown',
            totalExpected: 0,
            totalBanked: 0,
            totalUnbanked: 0,
            flagCount: 0
          };
        }
        
        branchSummary[bId].totalExpected += Number(record.expected_cash || 0);
        branchSummary[bId].totalBanked += Number(record.banking_data?.banked || 0);
        branchSummary[bId].totalUnbanked += Number(record.unbanked_cash || 0);
        
        if (Number(record.unbanked_cash) > 1000) { // arbitrary threshold for flags
            branchSummary[bId].flagCount++;
        }
      });

      return res.status(200).json({
        success: true,
        data: Object.values(branchSummary)
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get visual analysis data (trends, distributions)
   */
  static async getVisualData(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      let query = supabase
        .from('daily_financial_records')
        .select('record_date, total_revenue, total_expenses, net_profit, branch_id, branches(name)');

      if (startDate && endDate) {
        query = query.gte('record_date', startDate).lte('record_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Revenue trends over time
      const trends: any = {};
      const branchPerformance: any = {};

      data?.forEach(record => {
        const date = record.record_date;
        if (!trends[date]) trends[date] = { date, revenue: 0, profit: 0 };
        trends[date].revenue += Number(record.total_revenue || 0);
        trends[date].profit += Number(record.net_profit || 0);

        const bName = (record.branches as any)?.name || 'Unknown';
        if (!branchPerformance[bName]) branchPerformance[bName] = { name: bName, revenue: 0, profit: 0 };
        branchPerformance[bName].revenue += Number(record.total_revenue || 0);
        branchPerformance[bName].profit += Number(record.net_profit || 0);
      });

      return res.status(200).json({
        success: true,
        data: {
          trends: Object.values(trends).sort((a: any, b: any) => a.date.localeCompare(b.date)),
          branchPerformance: Object.values(branchPerformance)
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
