'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { API_URL } from '@/lib/config';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Download, Filter, TrendingUp, DollarSign, ShoppingCart, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

import { downloadBranchSalesPDF } from '@/lib/branch-sales-pdf';

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

export default function BranchAnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<SalesData | null>(null);
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
      const response = await fetch(`${API_URL}/api/analytics/branch-sales`, {
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch analytics data');
      }

      const data = await response.json();
      setSalesData(data.data);
    } catch (error: any) {
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

    if (!salesData) {
      toast.error('No analytics data available to export');
      return;
    }

    try {
      toast.info('Generating branded PDF report...');
      await downloadBranchSalesPDF(salesData, {
        startDate: dateRange.start,
        endDate: dateRange.end,
        branchName: (user as any).branch_name || (user as any).branch?.name || 'Branch Operations'
      });
      toast.success('PDF report generated successfully');
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

        {/* Transaction Table */}
        <TransactionTable
          data={salesData?.transactions || []}
          loading={loading}
        />
      </div>
    </DashboardLayout>
  );
}
