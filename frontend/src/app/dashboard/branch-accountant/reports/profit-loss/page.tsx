'use client';

// Profit & Loss Statement - Updated with comprehensive data aggregation and PDF export
import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { profitLossAPI } from '@/lib/api/branch-manager';
import { reportsAPI } from '@/lib/api/reports';
import { 
  TrendingUp, TrendingDown, DollarSign, RefreshCw, Download, 
  Building2, PieChart, BarChart3, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';
import { toast } from 'sonner';

interface PLData {
  revenue: number;
  costOfGoods: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingIncome: number;
  otherIncome?: number;
  otherExpenses: number;
  netProfit: number;
  margin: number;
  period?: { from: string; to: string; start?: string; end?: string };
  revenueBySource?: Record<string, number>;
  expensesByCategory?: Record<string, number>;
}

export default function ProfitLossPage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [plData, setPlData] = useState<PLData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchProfitLoss = useCallback(async () => {
    if (!currentBranchId) {
      setPlData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await profitLossAPI.getProfitLossStatement({
        branch_id: currentBranchId,
        from_date: dateRange.from,
        to_date: dateRange.to
      });

      if (response.success && response.data) {
        // Validate that the response has the required structure
        if (typeof response.data.revenue === 'number' && typeof response.data.netProfit === 'number') {
          setPlData(response.data);
        } else {
          console.error('Invalid P&L data structure:', response.data);
          setPlData(null);
          toast.error('Received invalid data from server');
        }
      } else {
        setPlData(null);
        toast.error(response.error || 'Failed to load P&L statement');
      }
    } catch (error: any) {
      console.error('Error fetching P&L:', error);
      setPlData(null);
      toast.error(error.message || 'Failed to load P&L statement');
    } finally {
      setIsLoading(false);
    }
  }, [currentBranchId, dateRange]);

  useEffect(() => {
    fetchProfitLoss();
  }, [fetchProfitLoss]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const sumMatchingValues = (source: Record<string, number> | undefined, keywords: string[]) => {
    return Object.entries(source || {}).reduce((sum, [key, amount]) => {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const matches = keywords.some((keyword) => normalizedKey.includes(keyword));
      return matches ? sum + Number(amount || 0) : sum;
    }, 0);
  };

  const exportToPDF = async () => {
    if (!currentBranchId) {
      toast.error('No branch selected');
      return;
    }

    if (!plData) {
      toast.error('No profit and loss data available to export');
      return;
    }

    try {
      toast.info('Generating branded PDF...');

      const roomRevenue = sumMatchingValues(plData.revenueBySource, ['room', 'rooms', 'accommodation', 'lodging']);
      const restaurantRevenue = sumMatchingValues(plData.revenueBySource, ['restaurant', 'food', 'kitchen', 'dining']);
      const barRevenue = sumMatchingValues(plData.revenueBySource, ['bar', 'beverage', 'drink', 'drinks']);
      const totalExpenses = plData.costOfGoods + plData.operatingExpenses + plData.otherExpenses;
      const payrollExpense = sumMatchingValues(plData.expensesByCategory, ['salary', 'salaries', 'payroll', 'wage', 'wages', 'staff']);
      const utilitiesExpense = sumMatchingValues(plData.expensesByCategory, ['utility', 'utilities', 'electricity', 'water', 'power', 'internet']);
      const maintenanceExpense = sumMatchingValues(plData.expensesByCategory, ['maintenance', 'repair', 'repairs']);
      const suppliesExpense = plData.costOfGoods;
      const otherRevenue = Math.max(0, plData.revenue - roomRevenue - restaurantRevenue - barRevenue);
      const otherExpense = Math.max(0, totalExpenses - payrollExpense - utilitiesExpense - maintenanceExpense - suppliesExpense);
      const toPercent = (amount: number) => totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;

      await reportsAPI.exportPdf('financial_summary', {
        start_date: dateRange.from,
        end_date: dateRange.to,
        branch_id: currentBranchId,
        branch_name: activeBranch?.name || 'Branch',
        useRealData: false,
        data: {
          total_revenue: plData.revenue,
          room_revenue: roomRevenue,
          restaurant_revenue: restaurantRevenue,
          bar_revenue: barRevenue,
          other_revenue: otherRevenue,
          total_expenses: totalExpenses,
          payroll_expense: payrollExpense,
          payroll_pct: toPercent(payrollExpense),
          utilities_expense: utilitiesExpense,
          utilities_pct: toPercent(utilitiesExpense),
          supplies_expense: suppliesExpense,
          supplies_pct: toPercent(suppliesExpense),
          maintenance_expense: maintenanceExpense,
          maintenance_pct: toPercent(maintenanceExpense),
          other_expense: otherExpense,
          other_exp_pct: toPercent(otherExpense),
          net_profit: plData.netProfit,
          profit_margin: plData.margin
        }
      });

      toast.success('PDF downloaded successfully');
    } catch (error: any) {
      console.error('PDF export error:', error);
      toast.error(error.message || 'Failed to export PDF');
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-[#007AFF]" />
                Profit & Loss Statement
              </h1>
              <p className="text-gray-500 flex items-center gap-1 mt-1">
                <Building2 className="h-3.5 w-3.5" />
                {activeBranch?.name || 'Select a branch'}
              </p>
            </div>
            <div className="flex gap-2">
              <IOSButton
                variant="secondary"
                leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}
                onClick={fetchProfitLoss}
              >
                Refresh
              </IOSButton>
              <IOSButton
                variant="secondary"
                leftIcon={<Download />}
                onClick={exportToPDF}
              >
                Export PDF
              </IOSButton>
            </div>
          </div>

          {/* Date Range Selector */}
          <IOSCard className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                />
              </div>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !plData ? (
            <IOSCard className="p-12 text-center">
              <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No data available</p>
            </IOSCard>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <IOSCard className="p-6 border-l-4 border-green-500">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-500">Gross Profit</p>
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(plData.grossProfit)}</p>
                  <p className="text-sm text-green-600 mt-1">
                    Margin: {formatPercentage(plData.revenue > 0 ? (plData.grossProfit / plData.revenue) * 100 : 0)}
                  </p>
                </IOSCard>

                <IOSCard className="p-6 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-500">Operating Income</p>
                    <DollarSign className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(plData.operatingIncome)}</p>
                  <p className="text-sm text-blue-600 mt-1">
                    Margin: {formatPercentage(plData.revenue > 0 ? (plData.operatingIncome / plData.revenue) * 100 : 0)}
                  </p>
                </IOSCard>

                <IOSCard className={`p-6 border-l-4 ${plData.netProfit >= 0 ? 'border-green-500' : 'border-red-500'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-500">Net Profit</p>
                    {plData.netProfit >= 0 ? (
                      <ArrowUpRight className="h-5 w-5 text-green-600" />
                    ) : (
                      <ArrowDownRight className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <p className={`text-2xl font-bold ${plData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(plData.netProfit)}
                  </p>
                  <p className={`text-sm mt-1 ${plData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Margin: {formatPercentage(plData.margin)}
                  </p>
                </IOSCard>
              </div>

              {/* Revenue & Expenses Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <IOSCard className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Revenue Breakdown
                  </h3>
                  <div className="space-y-3">
                    {plData.revenueBySource && Object.keys(plData.revenueBySource).length > 0 ? (
                      <>
                        {Object.entries(plData.revenueBySource).map(([source, amount]) => (
                          <div key={source} className="flex items-center justify-between py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600 capitalize">{source.replace(/_/g, ' ')}</span>
                            <span className="font-semibold">{formatCurrency(amount)}</span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-600">Total Revenue</span>
                        <span className="font-semibold">{formatCurrency(plData.revenue)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-3 bg-green-50 px-3 rounded-lg mt-2">
                      <span className="font-bold text-gray-900">Total Revenue</span>
                      <span className="font-bold text-green-600 text-lg">{formatCurrency(plData.revenue)}</span>
                    </div>
                  </div>
                </IOSCard>

                <IOSCard className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                    Expenses Breakdown
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">Cost of Goods Sold</span>
                      <span className="font-semibold">{formatCurrency(plData.costOfGoods)}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">Operating Expenses</span>
                      <span className="font-semibold">{formatCurrency(plData.operatingExpenses)}</span>
                    </div>
                    {plData.otherExpenses > 0 && (
                      <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-600">Other Expenses</span>
                        <span className="font-semibold">{formatCurrency(plData.otherExpenses)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-3 bg-red-50 px-3 rounded-lg mt-2">
                      <span className="font-bold text-gray-900">Total Expenses</span>
                      <span className="font-bold text-red-600 text-lg">
                        {formatCurrency(plData.costOfGoods + plData.operatingExpenses + plData.otherExpenses)}
                      </span>
                    </div>
                  </div>
                </IOSCard>
              </div>

              {/* Detailed Expense Categories (if available) */}
              {plData.expensesByCategory && Object.keys(plData.expensesByCategory).length > 0 && (
                <IOSCard className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-blue-600" />
                    Detailed Expense Categories
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                    {Object.entries(plData.expensesByCategory)
                      .sort(([, a], [, b]) => b - a)
                      .map(([category, amount]) => (
                        <div key={category} className="flex items-center justify-between py-2 border-b border-gray-100">
                          <span className="text-sm text-gray-600">{category}</span>
                          <span className="font-semibold text-sm">{formatCurrency(amount)}</span>
                        </div>
                      ))}
                  </div>
                </IOSCard>
              )}
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
