'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { API_URL } from '@/lib/config';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Download, Filter, TrendingUp, DollarSign, ShoppingCart, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

// Import components
import SalesMetricsCards from './components/SalesMetricsCards';
import FilterPanel from './components/FilterPanel';
import SalesChart from './components/SalesChart';
import PaymentMethodChart from './components/PaymentMethodChart';
import CategoryBreakdownChart from './components/CategoryBreakdownChart';
import TransactionTable from './components/TransactionTable';
import ExportButtons from './components/ExportButtons';

interface SalesFilter {
  payment_methods?: string[];
  order_types?: string[];
  categories?: string[];
}

interface DateRange {
  start: string;
  end: string;
}

interface SalesData {
  summary: {
    total_sales: number;
    transaction_count: number;
    avg_transaction_value: number;
  };
  daily_breakdown: Array<{
    date: string;
    total_sales: number;
    transaction_count: number;
    avg_transaction_value: number;
  }>;
  payment_method_breakdown: Array<{
    payment_method: string;
    total_sales: number;
    transaction_count: number;
    percentage: number;
  }>;
  category_breakdown: Array<{
    category: string;
    total_sales: number;
    transaction_count: number;
    percentage: number;
  }>;
  transactions?: Array<any>;
}

interface BranchFinancialProfile {
  summary: {
    revenue: number;
    expenses: number;
    netProfit: number;
    revenueBySource: {
      bookings: number;
      restaurant: number;
      bar: number;
      other: number;
    };
    expensesByCategory: Record<string, number>;
  };
  receivables: number;
  payables: number;
  recentPayments: Array<any>;
  recentTransactions: Array<any>;
  posActivity: {
    restaurant: Array<any>;
    bar: Array<any>;
  };
  logbooks: Array<any>;
  period: {
    startDate: string;
    endDate: string;
  };
}

const formatCurrency = (value: number | null | undefined) =>
  `KES ${Number(value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BranchAnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [financialData, setFinancialData] = useState<BranchFinancialProfile | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [filters, setFilters] = useState<SalesFilter>({});
  const [showFilters, setShowFilters] = useState(false);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    if (!user?.branch_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const salesRequest = fetch(`${API_URL}/api/analytics/branch-sales`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch_id: user.branch_id,
          start_date: dateRange.start,
          end_date: dateRange.end,
          filters
        })
      });

      const financeRequest = fetch(
        `${API_URL}/api/finance/branch-financials/${user.branch_id}?startDate=${encodeURIComponent(dateRange.start)}&endDate=${encodeURIComponent(dateRange.end)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const [salesResult, financeResult] = await Promise.allSettled([salesRequest, financeRequest]);

      let hasSuccessfulSection = false;
      const fetchErrors: string[] = [];

      if (salesResult.status === 'fulfilled') {
        if (salesResult.value.ok) {
          const salesPayload = await salesResult.value.json();
          setSalesData(salesPayload.data);
          hasSuccessfulSection = true;
        } else {
          const errorData = await salesResult.value.json().catch(() => null);
          setSalesData(null);
          fetchErrors.push(errorData?.error || 'Failed to fetch sales analytics');
        }
      } else {
        setSalesData(null);
        fetchErrors.push('Failed to fetch sales analytics');
      }

      if (financeResult.status === 'fulfilled') {
        if (financeResult.value.ok) {
          const financePayload = await financeResult.value.json();
          setFinancialData(financePayload.data);
          hasSuccessfulSection = true;
        } else {
          const errorData = await financeResult.value.json().catch(() => null);
          setFinancialData(null);
          fetchErrors.push(errorData?.message || errorData?.error || 'Failed to fetch branch financial profile');
        }
      } else {
        setFinancialData(null);
        fetchErrors.push('Failed to fetch branch financial profile');
      }

      if (!hasSuccessfulSection) {
        throw new Error(fetchErrors[0] || 'Failed to fetch analytics data');
      }

      if (fetchErrors.length > 0) {
        toast.warning(fetchErrors[0]);
      }
    } catch (error: any) {
      setSalesData(null);
      setFinancialData(null);
      console.error('Error fetching analytics:', error);
      toast.error(error.message || 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (!user?.branch_id) {
      setLoading(false);
    }
  }, [user?.branch_id]);

  // Apply filters
  const handleApplyFilters = (newFilters: SalesFilter, newDateRange: DateRange) => {
    setFilters(newFilters);
    setDateRange(newDateRange);
    // Fetch will be triggered by useEffect
  };

  // Trigger fetch when filters or date range change
  useEffect(() => {
    if (user?.branch_id) {
      fetchAnalytics();
    }
  }, [user?.branch_id, filters, dateRange]);

  // Export handlers
  const handleExportPDF = async () => {
    if (!user?.branch_id) return;

    try {
      toast.info('Generating PDF report...');
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/analytics/branch-sales/export/pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch_id: user.branch_id,
          start_date: dateRange.start,
          end_date: dateRange.end,
          filters
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF report');
      }

      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `branch-sales-${dateRange.start}-${dateRange.end}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('PDF report downloaded successfully');
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      toast.error(error.message || 'Failed to generate PDF report');
    }
  };

  const handleExportCSV = async () => {
    if (!user?.branch_id) return;

    try {
      toast.info('Generating CSV export...');
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/analytics/branch-sales/export/csv`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch_id: user.branch_id,
          start_date: dateRange.start,
          end_date: dateRange.end,
          filters
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate CSV export');
      }

      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `branch-sales-${dateRange.start}-${dateRange.end}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('CSV export downloaded successfully');
    } catch (error: any) {
      console.error('Error exporting CSV:', error);
      toast.error(error.message || 'Failed to generate CSV export');
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Branch Sales</h1>
            <p className="text-muted-foreground">
              Comprehensive sales performance and transaction analytics
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>
            <ExportButtons
              onExportPDF={handleExportPDF}
              onExportCSV={handleExportCSV}
              loading={loading}
            />
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <FilterPanel
            dateRange={dateRange}
            filters={filters}
            onApply={handleApplyFilters}
            onReset={() => {
              setFilters({});
              setDateRange({
                start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0]
              });
            }}
          />
        )}

        {/* Sales Metrics Cards */}
        <SalesMetricsCards
          data={salesData?.summary}
          loading={loading}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Branch Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(financialData?.summary?.revenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">All branch income in selected period</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Branch Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(financialData?.summary?.expenses)}</div>
              <p className="text-xs text-muted-foreground mt-1">Operational and finance expenses</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(financialData?.summary?.netProfit)}</div>
              <p className="text-xs text-muted-foreground mt-1">Revenue minus expenses</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Position</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency((financialData?.receivables || 0) - (financialData?.payables || 0))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Receivables {formatCurrency(financialData?.receivables)} / Payables {formatCurrency(financialData?.payables)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SalesChart
            data={salesData?.daily_breakdown || []}
            loading={loading}
          />
          <PaymentMethodChart
            data={salesData?.payment_method_breakdown || []}
            loading={loading}
          />
        </div>

        {/* Category Breakdown */}
        <CategoryBreakdownChart
          data={salesData?.category_breakdown || []}
          loading={loading}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Sources</CardTitle>
              <CardDescription>Aggregated branch income by source</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ['Bookings', financialData?.summary?.revenueBySource?.bookings],
                ['Restaurant', financialData?.summary?.revenueBySource?.restaurant],
                ['Bar', financialData?.summary?.revenueBySource?.bar],
                ['Other', financialData?.summary?.revenueBySource?.other]
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b pb-2 last:border-b-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="font-semibold">{formatCurrency(Number(value || 0))}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expense Categories</CardTitle>
              <CardDescription>Branch expense distribution in the selected period</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(financialData?.summary?.expensesByCategory || {}).length > 0 ? (
                Object.entries(financialData?.summary?.expensesByCategory || {})
                  .sort(([, a], [, b]) => Number(b) - Number(a))
                  .slice(0, 8)
                  .map(([category, amount]) => (
                    <div key={category} className="flex items-center justify-between border-b pb-2 last:border-b-0">
                      <span className="text-sm text-muted-foreground capitalize">{category.replace(/_/g, ' ')}</span>
                      <span className="font-semibold">{formatCurrency(Number(amount || 0))}</span>
                    </div>
                  ))
              ) : (
                <p className="text-sm text-muted-foreground">No expense data found for the selected period.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Finance Transactions</CardTitle>
              <CardDescription>Branch-scoped finance entries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(financialData?.recentTransactions || []).length > 0 ? (
                (financialData?.recentTransactions || []).map((transaction: any) => (
                  <div key={transaction.id} className="flex items-center justify-between border-b pb-2 last:border-b-0">
                    <div>
                      <p className="font-medium text-sm">{transaction.description || transaction.transaction_number || 'Finance transaction'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleString()} · {String(transaction.transaction_type || 'entry').replace(/_/g, ' ')}
                      </p>
                    </div>
                    <span className="font-semibold">{formatCurrency(transaction.amount)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No finance transactions found for the selected period.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Payments & Logbooks</CardTitle>
              <CardDescription>Latest branch cash activity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Payments</p>
                {(financialData?.recentPayments || []).length > 0 ? (
                  (financialData?.recentPayments || []).slice(0, 5).map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between border-b pb-2 last:border-b-0">
                      <div>
                        <p className="font-medium text-sm">{payment.reference || payment.payment_reference || payment.id}</p>
                        <p className="text-xs text-muted-foreground">{new Date(payment.created_at).toLocaleString()}</p>
                      </div>
                      <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No recent payments found.</p>
                )}
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Cashier Logbooks</p>
                {(financialData?.logbooks || []).length > 0 ? (
                  (financialData?.logbooks || []).map((logbook: any) => (
                    <div key={logbook.id} className="flex items-center justify-between border-b pb-2 last:border-b-0">
                      <div>
                        <p className="font-medium text-sm">{String(logbook.type || 'logbook').replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">{logbook.log_date} · {logbook.status}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No recent logbooks found.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transaction Table */}
        <TransactionTable
          data={salesData?.transactions || []}
          loading={loading}
        />
      </div>
    </DashboardLayout>
  );
}
