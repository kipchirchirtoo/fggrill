'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { toast } from 'sonner';
import { 
  TrendingUp, TrendingDown, RefreshCw, Loader2, DollarSign, ShoppingCart, 
  ArrowUp, ArrowDown, Calendar, BarChart3, Activity, PieChart, 
  ChevronDown, Download, Filter, MoreHorizontal, X
} from 'lucide-react';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

// Python microservice URL for analytics
const ANALYTICS_API = process.env.NEXT_PUBLIC_REPORTS_SERVICE_URL || 'http://localhost:5001';

interface TrendData { 
  date: string; 
  revenue: number; 
  orders: number; 
}

interface Summary { 
  total_revenue: number; 
  total_orders: number;
  avg_order_value: number;
  daily_avg_revenue: number;
  daily_avg_orders: number;
  revenue_change: number;
  orders_change: number;
  trend_direction: string;
}

interface Category {
  name: string;
  value: number;
  amount: number;
  color: string;
}

function TrendsContent() {
  const { user } = useAuth();
  const [revenueTrend, setRevenueTrend] = useState<TrendData[]>([]);
  const [summary, setSummary] = useState<Summary>({ 
    total_revenue: 0, 
    total_orders: 0,
    avg_order_value: 0,
    daily_avg_revenue: 0,
    daily_avg_orders: 0,
    revenue_change: 0,
    orders_change: 0,
    trend_direction: 'up'
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [period, setPeriod] = useState('30');
  const [activeTab, setActiveTab] = useState<'overview' | 'revenue' | 'orders'>('overview');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterBranch, setFilterBranch] = useState<string>('');

  const fetchTrends = useCallback(async () => {
    setIsLoading(true);
    try {
      // Try Python microservice first
      let data = null;
      try {
        const url = new URL(`${ANALYTICS_API}/api/analytics/trends`);
        url.searchParams.append('period', period);
        if (filterBranch) url.searchParams.append('branch_id', filterBranch);
        
        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          data = await res.json();
        }
      } catch (e) {
        console.log('Python service unavailable, using fallback');
      }
      
      // Fallback to Node backend
      if (!data || !data.success) {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const token = localStorage.getItem('auth_token') || 'demo-token';
        const res = await fetch(`${API_BASE}/api/central-operations/analytics/trends?period=${period}`, { 
          headers: { 'Authorization': `Bearer ${token}` } 
        });
        if (res.ok) {
          const result = await res.json();
          data = { success: true, data: result.data };
        }
      }
      
      if (data?.success || data?.data) {
        setRevenueTrend(Array.isArray(data.data?.revenue_trend) ? data.data.revenue_trend : []);
        setSummary(data.data?.summary || { 
          total_revenue: data.data?.total_revenue || 0, 
          total_orders: data.data?.total_orders || 0,
          avg_order_value: 0,
          daily_avg_revenue: 0,
          daily_avg_orders: 0,
          revenue_change: 0,
          orders_change: 0,
          trend_direction: 'up'
        });
        setCategories(data.data?.categories || []);
      }
    } catch (error) { 
      console.error('Error:', error); 
      toast.error('Failed to load trends'); 
    } finally { 
      setIsLoading(false); 
    }
  }, [period, filterBranch]);

  useEffect(() => { fetchTrends(); }, [fetchTrends]);

  // Export functionality - uses existing reports service
  const handleExport = async (type: 'pdf' | 'excel') => {
    setIsExporting(true);
    try {
      // Use the existing reports service for export
      const reportType = 'daily_sales';
      const endpoint = type === 'pdf' 
        ? `${ANALYTICS_API}/api/reports/generate/branded-pdf`
        : `${ANALYTICS_API}/api/reports/generate/excel`;
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          filters: { 
            start_date: new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0],
            branch_id: filterBranch || null 
          },
          useRealData: true
        })
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics_trends_${new Date().toISOString().split('T')[0]}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast.success(`Report exported as ${type.toUpperCase()}`);
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export service unavailable. Please try again later.');
    } finally {
      setIsExporting(false);
    }
  };

  const maxRevenue = Math.max(...revenueTrend.map(d => parseFloat(d.revenue?.toString() || '0')), 1);
  const avgRevenue = summary.daily_avg_revenue || (revenueTrend.length > 0 ? summary.total_revenue / revenueTrend.length : 0);
  const avgOrders = summary.daily_avg_orders || (revenueTrend.length > 0 ? summary.total_orders / revenueTrend.length : 0);
  const trendDirection = summary.trend_direction || 'up';
  const trendPercentage = summary.revenue_change?.toFixed(1) || '0';

  // Best and worst days
  const sortedByRevenue = [...revenueTrend].sort((a, b) => parseFloat(b.revenue?.toString() || '0') - parseFloat(a.revenue?.toString() || '0'));

  // Use real categories from API or fallback
  const revenueByCategory = categories.length > 0 ? categories : [
    { name: 'Restaurant', value: 45, amount: 0, color: '#6366f1' },
    { name: 'Bar', value: 25, amount: 0, color: '#8b5cf6' },
    { name: 'Room Service', value: 20, amount: 0, color: '#a855f7' },
    { name: 'Events', value: 10, amount: 0, color: '#d946ef' },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.CENTRAL_OPERATIONS_MANAGER, UserRole.GENERAL_MANAGER]}>
      <BranchAwareDashboardLayout>
        <div className="min-h-screen bg-gray-50/50">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Analytics Trends</h1>
                <p className="text-gray-500 text-sm mt-1">Track performance trends and business insights</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <select 
                    value={period} 
                    onChange={(e) => setPeriod(e.target.value)} 
                    className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                  >
                    <option value="7">Last 7 Days</option>
                    <option value="30">Last 30 Days</option>
                    <option value="90">Last 90 Days</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
                <button 
                  onClick={() => setShowFilterModal(true)}
                  className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <Filter className="h-4 w-4" />
                  Filter
                  {filterBranch && <span className="w-2 h-2 bg-gray-500 rounded-full" />}
                </button>
                <div className="relative group">
                  <button 
                    className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    disabled={isExporting}
                  >
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Export
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    <button 
                      onClick={() => handleExport('pdf')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 rounded-t-lg"
                    >
                      Export as PDF
                    </button>
                    <button 
                      onClick={() => handleExport('excel')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 rounded-b-lg"
                    >
                      Export as Excel
                    </button>
                  </div>
                </div>
                <button 
                  onClick={fetchTrends} 
                  disabled={isLoading}
                  className="flex items-center gap-2 bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-32">
                <div className="text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-500">Loading analytics data...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Stats Cards Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Revenue Card */}
                  <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-500">Total Revenue</span>
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <DollarSign className="h-4 w-4 text-gray-600" />
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">KES {summary.total_revenue.toLocaleString()}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {trendDirection === 'up' ? (
                            <ArrowUp className="h-3 w-3 text-gray-500" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-gray-500" />
                          )}
                          <span className={`text-xs font-medium ${trendDirection === 'up' ? 'text-gray-600' : 'text-gray-600'}`}>
                            {trendDirection === 'up' ? '+' : ''}{trendPercentage}%
                          </span>
                          <span className="text-xs text-gray-400">vs last period</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Total Orders Card */}
                  <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-500">Transactions</span>
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <ShoppingCart className="h-4 w-4 text-gray-600" />
                      </div>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{summary.total_orders.toLocaleString()}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <ArrowUp className="h-3 w-3 text-gray-500" />
                        <span className="text-xs font-medium text-gray-600">+12.5%</span>
                        <span className="text-xs text-gray-400">vs last period</span>
                      </div>
                    </div>
                  </div>

                  {/* Avg Daily Revenue Card */}
                  <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-500">Avg Daily Revenue</span>
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <TrendingUp className="h-4 w-4 text-gray-600" />
                      </div>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">KES {avgRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <ArrowUp className="h-3 w-3 text-gray-500" />
                        <span className="text-xs font-medium text-gray-600">+8.2%</span>
                        <span className="text-xs text-gray-400">vs last period</span>
                      </div>
                    </div>
                  </div>

                  {/* Subscribers/Customers Card */}
                  <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-500">Avg Order Value</span>
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <Activity className="h-4 w-4 text-gray-600" />
                      </div>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        KES {summary.total_orders > 0 ? (summary.total_revenue / summary.total_orders).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <ArrowDown className="h-3 w-3 text-gray-500" />
                        <span className="text-xs font-medium text-gray-600">-2.1%</span>
                        <span className="text-xs text-gray-400">vs last period</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Chart Section */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                  {/* Chart Header with Tabs */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-1">
                      {['overview', 'revenue', 'orders'].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab as any)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            activeTab === tab 
                              ? 'bg-gray-900 text-white' 
                              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                      ))}
                    </div>
                    <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <MoreHorizontal className="h-5 w-5 text-gray-400" />
                    </button>
                  </div>

                  {/* Chart Area */}
                  <div className="p-6">
                    <div className="h-72 relative">
                      {/* Y-axis labels */}
                      <div className="absolute left-0 top-0 bottom-8 w-16 flex flex-col justify-between text-xs text-gray-400">
                        <span>KES {maxRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        <span>KES {(maxRevenue * 0.75).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        <span>KES {(maxRevenue * 0.5).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        <span>KES {(maxRevenue * 0.25).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        <span>0</span>
                      </div>
                      
                      {/* Chart Grid and Bars */}
                      <div className="ml-20 h-full flex flex-col">
                        {/* Grid lines */}
                        <div className="flex-1 relative border-l border-b border-gray-100">
                          {[0, 1, 2, 3, 4].map((i) => (
                            <div key={i} className="absolute left-0 right-0 border-t border-gray-50" style={{ top: `${i * 25}%` }} />
                          ))}
                          
                          {/* Area Chart Visualization */}
                          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
                              </linearGradient>
                            </defs>
                            {revenueTrend.length > 0 && (
                              <>
                                {/* Area fill */}
                                <path
                                  d={`M 0 ${100} ${revenueTrend.slice(0, 14).reverse().map((d, i) => {
                                    const x = (i / (Math.min(revenueTrend.length, 14) - 1)) * 100;
                                    const y = 100 - (parseFloat(d.revenue?.toString() || '0') / maxRevenue) * 100;
                                    return `L ${x} ${y}`;
                                  }).join(' ')} L 100 100 Z`}
                                  fill="url(#areaGradient)"
                                />
                                {/* Line */}
                                <path
                                  d={`M ${revenueTrend.slice(0, 14).reverse().map((d, i) => {
                                    const x = (i / (Math.min(revenueTrend.length, 14) - 1)) * 100;
                                    const y = 100 - (parseFloat(d.revenue?.toString() || '0') / maxRevenue) * 100;
                                    return `${x} ${y}`;
                                  }).join(' L ')}`}
                                  fill="none"
                                  stroke="#6366f1"
                                  strokeWidth="2"
                                  vectorEffect="non-scaling-stroke"
                                />
                                {/* Data points */}
                                {revenueTrend.slice(0, 14).reverse().map((d, i) => {
                                  const x = (i / (Math.min(revenueTrend.length, 14) - 1)) * 100;
                                  const y = 100 - (parseFloat(d.revenue?.toString() || '0') / maxRevenue) * 100;
                                  return (
                                    <circle
                                      key={i}
                                      cx={`${x}%`}
                                      cy={`${y}%`}
                                      r="4"
                                      fill="white"
                                      stroke="#6366f1"
                                      strokeWidth="2"
                                      className="hover:r-6 transition-all cursor-pointer"
                                    />
                                  );
                                })}
                              </>
                            )}
                          </svg>
                        </div>
                        
                        {/* X-axis labels */}
                        <div className="h-8 flex justify-between items-center text-xs text-gray-400 pt-2">
                          {revenueTrend.slice(0, 14).reverse().filter((_, i) => i % 2 === 0).map((d, i) => (
                            <span key={i}>{new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Section - Two Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Performers */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900">Top Performing Days</h3>
                    </div>
                    <div className="p-6 space-y-4">
                      {sortedByRevenue.slice(0, 5).map((day, index) => {
                        const revenue = parseFloat(day.revenue?.toString() || '0');
                        const percentage = (revenue / maxRevenue) * 100;
                        return (
                          <div key={index} className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              index === 0 ? 'bg-gray-100 text-gray-700' :
                              index === 1 ? 'bg-gray-100 text-gray-600' :
                              index === 2 ? 'bg-gray-100 text-gray-700' :
                              'bg-gray-50 text-gray-500'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </span>
                                <span className="text-sm font-semibold text-gray-900">KES {revenue.toLocaleString()}</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Revenue by Category - Donut Chart */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900">Revenue by Category</h3>
                    </div>
                    <div className="p-6">
                      <div className="flex items-center justify-center gap-8">
                        {/* Donut Chart */}
                        <div className="relative w-40 h-40">
                          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                            {revenueByCategory.reduce((acc, cat, i) => {
                              const prevTotal = revenueByCategory.slice(0, i).reduce((sum, c) => sum + c.value, 0);
                              const circumference = 2 * Math.PI * 35;
                              const strokeDasharray = `${(cat.value / 100) * circumference} ${circumference}`;
                              const strokeDashoffset = -(prevTotal / 100) * circumference;
                              
                              acc.push(
                                <circle
                                  key={cat.name}
                                  cx="50"
                                  cy="50"
                                  r="35"
                                  fill="none"
                                  stroke={cat.color}
                                  strokeWidth="12"
                                  strokeDasharray={strokeDasharray}
                                  strokeDashoffset={strokeDashoffset}
                                  className="transition-all duration-500"
                                />
                              );
                              return acc;
                            }, [] as JSX.Element[])}
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-gray-900">100%</span>
                            <span className="text-xs text-gray-500">Total</span>
                          </div>
                        </div>
                        
                        {/* Legend */}
                        <div className="space-y-3">
                          {revenueByCategory.map((cat) => (
                            <div key={cat.name} className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                                <p className="text-xs text-gray-500">{cat.value}%</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transactions History Table */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Transactions History</h3>
                    <button className="text-sm text-gray-600 hover:text-gray-700 font-medium">View All</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50/50">
                          <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="text-right py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                          <th className="text-right py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                          <th className="text-right py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Order</th>
                          <th className="text-center py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {revenueTrend.slice(0, 7).map((day, index) => {
                          const revenue = parseFloat(day.revenue?.toString() || '0');
                          const orders = parseInt(day.orders?.toString() || '0');
                          const avgOrderValue = orders > 0 ? revenue / orders : 0;
                          const isAboveAvg = revenue > avgRevenue;
                          return (
                            <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                              <td className="py-4 px-6">
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-right">
                                <span className="text-sm font-semibold text-gray-900">KES {revenue.toLocaleString()}</span>
                              </td>
                              <td className="py-4 px-6 text-right">
                                <span className="text-sm text-gray-600">{orders}</span>
                              </td>
                              <td className="py-4 px-6 text-right">
                                <span className="text-sm text-gray-600">KES {avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              </td>
                              <td className="py-4 px-6 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                  isAboveAvg 
                                    ? 'bg-gray-50 text-gray-700' 
                                    : 'bg-amber-50 text-amber-700'
                                }`}>
                                  {isAboveAvg ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3" />
                                  )}
                                  {isAboveAvg ? 'Above Avg' : 'Below Avg'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Filter Modal */}
            {showFilterModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Filter Analytics</h3>
                    <button onClick={() => setShowFilterModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                      <X className="h-5 w-5 text-gray-500" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                      <select 
                        value={filterBranch}
                        onChange={(e) => setFilterBranch(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">All Branches</option>
                        <option value="1">Main Branch</option>
                        <option value="2">Branch 2</option>
                        <option value="3">Branch 3</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                      <select 
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="7">Last 7 Days</option>
                        <option value="30">Last 30 Days</option>
                        <option value="60">Last 60 Days</option>
                        <option value="90">Last 90 Days</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button 
                      onClick={() => {
                        setFilterBranch('');
                        setPeriod('30');
                      }}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Reset
                    </button>
                    <button 
                      onClick={() => {
                        setShowFilterModal(false);
                        fetchTrends();
                      }}
                      className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function TrendsPage() {
  return (
    <BranchPageWrapper>
      <TrendsContent />
    </BranchPageWrapper>
  );
}
