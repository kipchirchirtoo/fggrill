'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { toast } from 'sonner';
import { 
  TrendingUp, TrendingDown, RefreshCw, Download, Calendar,
  DollarSign, Users, ShoppingCart, Star, Target, BarChart3,
  Building2, ArrowUpRight, ArrowDownRight, Loader2, FileText,
  PieChart, Activity, Clock, CheckCircle2, AlertTriangle,
  FileSpreadsheet, ChevronDown, X
} from 'lucide-react';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

interface BranchPerformance {
  branch_id: number;
  branch_name: string;
  revenue: number;
  revenue_change: number;
  orders: number;
  orders_change: number;
  avg_order_value: number;
  customer_satisfaction: number;
  staff_efficiency: number;
  inventory_turnover: number;
  target_achievement: number;
  top_products: { name: string; sales: number }[];
  hourly_sales: { hour: string; amount: number }[];
}

interface PerformanceMetrics {
  total_revenue: number;
  total_orders: number;
  avg_satisfaction: number;
  best_performer: string;
  worst_performer: string;
  branches: BranchPerformance[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const PYTHON_SERVICE = process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'http://localhost:5001';

function PerformanceContent() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState('week');
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | null>(null);

  // Get filtered branches based on branch filter
  const filteredBranches = metrics?.branches.filter(branch => {
    if (branchFilter === 'all') return true;
    return branch.branch_id.toString() === branchFilter;
  }) || [];

  // Calculate filtered metrics
  const filteredMetrics = metrics ? {
    ...metrics,
    branches: filteredBranches,
    total_revenue: filteredBranches.reduce((sum, b) => sum + b.revenue, 0),
    total_orders: filteredBranches.reduce((sum, b) => sum + b.orders, 0),
    avg_satisfaction: filteredBranches.length > 0 
      ? filteredBranches.reduce((sum, b) => sum + b.customer_satisfaction, 0) / filteredBranches.length 
      : 0,
    best_performer: filteredBranches.length > 0 
      ? [...filteredBranches].sort((a, b) => b.revenue - a.revenue)[0]?.branch_name || 'N/A'
      : 'N/A',
    worst_performer: filteredBranches.length > 0 
      ? [...filteredBranches].sort((a, b) => a.revenue - b.revenue)[0]?.branch_name || 'N/A'
      : 'N/A'
  } : null;

  const fetchPerformanceData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE}/api/central-operations/branch-oversight/performance?period=${dateRange}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json();
      
      if (data.success && data.data) {
        // Normalize data - ensure numeric values
        const normalizedData = {
          ...data.data,
          branches: Array.isArray(data.data.branches) ? data.data.branches.map((b: any) => ({
            ...b,
            revenue_change: parseFloat(b.revenue_change) || 0,
            orders_change: parseFloat(b.orders_change) || 0,
            customer_satisfaction: parseFloat(b.customer_satisfaction) || 0,
            staff_efficiency: parseFloat(b.staff_efficiency) || 0,
            inventory_turnover: parseFloat(b.inventory_turnover) || 0,
            target_achievement: parseFloat(b.target_achievement) || 0
          })) : []
        };
        setMetrics(normalizedData);
      } else {
        toast.error('Failed to load performance data');
      }
    } catch (error) {
      console.error('Error fetching performance data:', error);
      toast.error('Failed to load performance data');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData]);


  const exportReport = async (format: 'pdf' | 'excel') => {
    if (!metrics) {
      toast.error('No data available to export');
      return;
    }
    
    setExportLoading(true);
    setExportFormat(format);
    setShowExportMenu(false);
    
    try {
      // Use Python microservice directly for report generation
      const endpoint = format === 'excel' 
        ? `${PYTHON_SERVICE}/api/reports/generate/excel`
        : `${PYTHON_SERVICE}/api/reports/generate/branded-pdf`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportType: 'branch_performance',
          filters: {
            period: dateRange,
            start_date: new Date().toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0]
          },
          useRealData: false,
          data: metrics
        })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const extension = format === 'excel' ? 'xlsx' : 'pdf';
        a.download = `FG_Branch_Performance_${new Date().toISOString().split('T')[0]}.${extension}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast.success(`Report exported as ${format.toUpperCase()}`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to generate report. Make sure Python service is running.');
    } finally {
      setExportLoading(false);
      setExportFormat(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getChangeIndicator = (change: number | string) => {
    const numChange = typeof change === 'string' ? parseFloat(change) : change;
    if (isNaN(numChange)) return <span className="text-gray-500 text-sm">0%</span>;
    
    if (numChange > 0) {
      return (
        <span className="flex items-center text-gray-600 text-sm">
          <ArrowUpRight className="h-4 w-4" />
          {numChange.toFixed(1)}%
        </span>
      );
    } else if (numChange < 0) {
      return (
        <span className="flex items-center text-gray-600 text-sm">
          <ArrowDownRight className="h-4 w-4" />
          {Math.abs(numChange).toFixed(1)}%
        </span>
      );
    }
    return <span className="text-gray-500 text-sm">0%</span>;
  };

  const selectedBranchData = selectedBranch 
    ? filteredMetrics?.branches.find(b => b.branch_id === selectedBranch)
    : null;

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.CENTRAL_OPERATIONS_MANAGER
    ]}>
      <BranchAwareDashboardLayout
        title={branchFilter === 'all' 
          ? "Branch Performance" 
          : `${metrics?.branches.find(b => b.branch_id.toString() === branchFilter)?.branch_name || 'Branch'} Performance`
        }
        subtitle={branchFilter === 'all' 
          ? "Monitor and analyze branch performance metrics across all locations" 
          : `Performance metrics for ${metrics?.branches.find(b => b.branch_id.toString() === branchFilter)?.branch_name || 'selected branch'}`
        }
        requireBranchContext={false}
        hideBranchSelector={true}
        actionButton={
          <div className="flex space-x-2 items-center flex-wrap gap-2">
            {/* Branch Selector */}
            <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-ios-lg px-3 py-2">
              <Building2 className="h-4 w-4 text-gray-500" />
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="text-sm bg-transparent border-none focus:outline-none cursor-pointer pr-6"
              >
                <option value="all">All Branches</option>
                {metrics?.branches.map(branch => (
                  <option key={branch.branch_id} value={branch.branch_id.toString()}>
                    {branch.branch_name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Date Range Selector */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-ios-lg text-sm bg-white"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
            
            <IOSButton 
              variant="secondary" 
              onClick={() => fetchPerformanceData()}
              disabled={isLoading}
              leftIcon={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </IOSButton>
            
            {/* Export Dropdown */}
            <div className="relative">
              <IOSButton 
                variant="primary" 
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={exportLoading || !metrics}
                leftIcon={exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                rightIcon={<ChevronDown className="h-4 w-4" />}
              >
                {exportLoading ? `Exporting ${exportFormat?.toUpperCase()}...` : 'Export'}
              </IOSButton>
              
              {showExportMenu && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowExportMenu(false)}
                  />
                  
                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-ios-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
                    <div className="p-2 border-b border-gray-100 bg-gray-50">
                      <p className="text-xs font-medium text-gray-500 uppercase">Export Report As</p>
                    </div>
                    
                    <button
                      onClick={() => exportReport('pdf')}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 transition-colors"
                    >
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <FileText className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">PDF Document</p>
                        <p className="text-xs text-gray-500">Professional branded report</p>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => exportReport('excel')}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 transition-colors border-t border-gray-100"
                    >
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <FileSpreadsheet className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Excel Spreadsheet</p>
                        <p className="text-xs text-gray-500">Editable data with charts</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        }
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : filteredMetrics ? (
          <div className="space-y-6">
            {/* Branch Filter Indicator */}
            {branchFilter !== 'all' && (
              <div className="bg-gray-50 border border-gray-200 rounded-ios-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-800">
                    Viewing: <strong>{metrics?.branches.find(b => b.branch_id.toString() === branchFilter)?.branch_name || 'Selected Branch'}</strong>
                  </span>
                </div>
                <button 
                  onClick={() => setBranchFilter('all')}
                  className="text-gray-600 hover:text-gray-800 flex items-center gap-1 text-sm"
                >
                  <X className="h-4 w-4" /> Clear Filter
                </button>
              </div>
            )}

            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <DollarSign className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Revenue</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(filteredMetrics.total_revenue)}</p>
                  </div>
                </div>
              </IOSCard>
              
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <ShoppingCart className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Orders</p>
                    <p className="text-lg font-bold text-gray-900">{filteredMetrics.total_orders.toLocaleString()}</p>
                  </div>
                </div>
              </IOSCard>
              
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Star className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg Satisfaction</p>
                    <p className="text-lg font-bold text-gray-900">{filteredMetrics.avg_satisfaction.toFixed(1)}/5</p>
                  </div>
                </div>
              </IOSCard>
              
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Best Performer</p>
                    <p className="text-lg font-bold text-gray-900 truncate">{filteredMetrics.best_performer}</p>
                  </div>
                </div>
              </IOSCard>
              
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <TrendingDown className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Needs Attention</p>
                    <p className="text-lg font-bold text-gray-900 truncate">{filteredMetrics.worst_performer}</p>
                  </div>
                </div>
              </IOSCard>
            </div>

            {/* Branch Performance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredMetrics.branches.map((branch) => (
                <IOSCard 
                  key={branch.branch_id}
                  className={`p-4 cursor-pointer transition-all border border-gray-200 ${
                    selectedBranch === branch.branch_id 
                      ? 'ring-2 ring-gray-400 bg-gray-50' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedBranch(
                    selectedBranch === branch.branch_id ? null : branch.branch_id
                  )}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-5 w-5 text-gray-400" />
                      <h3 className="font-semibold">{branch.branch_name}</h3>
                    </div>
                    <IOSBadge variant="filled" color={branch.target_achievement >= 100 ? 'success' : branch.target_achievement >= 80 ? 'warning' : 'danger'}>
                      {branch.target_achievement}%
                    </IOSBadge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Revenue</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold">{formatCurrency(branch.revenue)}</span>
                        {getChangeIndicator(branch.revenue_change)}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Orders</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold">{branch.orders.toLocaleString()}</span>
                        {getChangeIndicator(branch.orders_change)}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Satisfaction</span>
                      <div className="flex items-center space-x-1">
                        <Star className="h-4 w-4 text-gray-400 fill-gray-400" />
                        <span className="font-semibold">{branch.customer_satisfaction.toFixed(1)}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Staff Efficiency</span>
                      <span className="font-semibold">{branch.staff_efficiency}%</span>
                    </div>
                  </div>
                  
                  {/* Mini Progress Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Target Progress</span>
                      <span>{branch.target_achievement}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-gray-600"
                        style={{ width: `${Math.min(branch.target_achievement, 100)}%` }}
                      />
                    </div>
                  </div>
                </IOSCard>
              ))}
            </div>

            {/* Detailed View for Selected Branch */}
            {selectedBranchData && (
              <IOSCard className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold">{selectedBranchData.branch_name} - Detailed Analysis</h3>
                  <IOSButton 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedBranch(null)}
                  >
                    Close
                  </IOSButton>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* KPIs */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-700 flex items-center">
                      <Target className="h-4 w-4 mr-2" />
                      Key Performance Indicators
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-600">Avg Order Value</span>
                        <span className="font-semibold">{formatCurrency(selectedBranchData.avg_order_value)}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-600">Inventory Turnover</span>
                        <span className="font-semibold">{selectedBranchData.inventory_turnover}x</span>
                      </div>
                      <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-600">Staff Efficiency</span>
                        <span className="font-semibold">{selectedBranchData.staff_efficiency}%</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Top Products */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-700 flex items-center">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Top Selling Products
                    </h4>
                    <div className="space-y-2">
                      {selectedBranchData.top_products.map((product, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? 'bg-gray-200 text-gray-700' :
                              idx === 1 ? 'bg-gray-100 text-gray-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {idx + 1}
                            </span>
                            <span className="text-gray-700">{product.name}</span>
                          </div>
                          <span className="font-semibold">{product.sales} sold</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Hourly Sales */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-700 flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      Peak Hours
                    </h4>
                    <div className="space-y-2">
                      {selectedBranchData.hourly_sales.map((hour, idx) => (
                        <div key={idx} className="flex items-center space-x-3">
                          <span className="text-sm text-gray-500 w-12">{hour.hour}</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-4">
                            <div 
                              className="bg-gray-500 h-4 rounded-full"
                              style={{ 
                                width: `${(hour.amount / Math.max(...selectedBranchData.hourly_sales.map(h => h.amount))) * 100}%` 
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium w-20 text-right">
                            {formatCurrency(hour.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </IOSCard>
            )}

            {/* Performance Comparison Table */}
            <IOSCard className="overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Performance Comparison</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Orders</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">AOV</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rating</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Efficiency</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredMetrics.branches.map((branch) => (
                      <tr key={branch.branch_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{branch.branch_name}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <span>{formatCurrency(branch.revenue)}</span>
                            {getChangeIndicator(branch.revenue_change)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <span>{branch.orders.toLocaleString()}</span>
                            {getChangeIndicator(branch.orders_change)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">{formatCurrency(branch.avg_order_value)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <Star className="h-4 w-4 text-gray-400 fill-gray-400" />
                            <span>{branch.customer_satisfaction.toFixed(1)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">{branch.staff_efficiency}%</td>
                        <td className="px-4 py-3 text-center">
                          <IOSBadge 
                            variant="filled"
                            color={
                              branch.target_achievement >= 100 ? 'success' :
                              branch.target_achievement >= 80 ? 'warning' : 'danger'
                            }
                          >
                            {branch.target_achievement}%
                          </IOSBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </IOSCard>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <Activity className="h-16 w-16 text-gray-200 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Performance Data</h3>
            <p className="text-gray-500">Unable to load performance metrics</p>
          </div>
        )}
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function PerformancePage() {
  return (
    <BranchPageWrapper>
      <PerformanceContent />
    </BranchPageWrapper>
  );
}
