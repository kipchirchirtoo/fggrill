'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { toast } from 'sonner';
import { 
  BarChart3, RefreshCw, Loader2, DollarSign, Users, ShoppingCart, Building2, 
  Target, TrendingUp, TrendingDown, ChevronDown, Download, FileText,
  ArrowUpRight, ArrowDownRight, Calendar, Eye, Clock, FileBarChart
} from 'lucide-react';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

// Python microservice URL for analytics
const ANALYTICS_API = process.env.NEXT_PUBLIC_REPORTS_SERVICE_URL || 'http://localhost:5001';

interface BranchData { 
  branch_id: number; 
  branch_name: string; 
  revenue: number; 
  orders: number; 
}

interface KPI { 
  id: number; 
  name: string; 
  description: string; 
  category: string; 
  target_value: number; 
  unit: string; 
  frequency: string;
  current_value?: number;
}

interface ExecutiveData { 
  total_revenue: number; 
  total_orders: number; 
  staff_count: number; 
  branches: BranchData[]; 
  kpis: KPI[]; 
}

function ExecutiveContent() {
  const { user } = useAuth();
  const [data, setData] = useState<ExecutiveData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [activeTab, setActiveTab] = useState<'overview' | 'branches' | 'kpis' | 'reports'>('overview');
  const [selectedBranch, setSelectedBranch] = useState<BranchData | null>(null);
  const [kpiFilter, setKpiFilter] = useState<string>('all');

  const fetchExecutiveData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Try Python microservice first
      let result = null;
      try {
        const res = await fetch(`${ANALYTICS_API}/api/analytics/executive?period=${selectedPeriod}`, {
          signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
          result = await res.json();
        }
      } catch (e) {
        console.log('Python service unavailable, using fallback');
      }
      
      // Fallback to Node backend
      if (!result || !result.success) {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/central-operations/analytics/executive?period=${selectedPeriod}`, { 
          headers: { 'Authorization': `Bearer ${token}` } 
        });
        if (res.ok) {
          const data = await res.json();
          result = { success: true, data: data.data };
        }
      }
      
      if (result?.success || result?.data) {
        setData(result.data || null);
      }
    } catch (error) { 
      console.error('Error:', error); 
      toast.error('Failed to load executive data'); 
    } finally { 
      setIsLoading(false); 
    }
  }, [selectedPeriod]);

  // Export functionality - uses existing reports service
  const handleExport = async (type: 'pdf' | 'excel') => {
    setIsExporting(true);
    try {
      // Use the existing reports service for export
      const reportType = 'financial_summary';
      const endpoint = type === 'pdf' 
        ? `${ANALYTICS_API}/api/reports/generate/branded-pdf`
        : `${ANALYTICS_API}/api/reports/generate/excel`;
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          filters: { 
            start_date: new Date(Date.now() - parseInt(selectedPeriod) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0]
          },
          useRealData: true
        })
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `executive_dashboard_${new Date().toISOString().split('T')[0]}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
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

  useEffect(() => { fetchExecutiveData(); }, [fetchExecutiveData]);

  const totalBranchRevenue = data?.branches?.reduce((sum, b) => sum + (b.revenue || 0), 0) || 0;
  const avgOrderValue = data && data.total_orders > 0 ? data.total_revenue / data.total_orders : 0;
  const revenuePerStaff = data && data.staff_count > 0 ? data.total_revenue / data.staff_count : 0;
  const dailyAvgRevenue = data ? data.total_revenue / parseInt(selectedPeriod) : 0;
  const sortedBranches = data?.branches ? [...data.branches].sort((a, b) => b.revenue - a.revenue) : [];
  
  // KPI categories for filtering
  const kpiCategories = [...new Set(data?.kpis?.map(k => k.category) || [])];
  const filteredKPIs = kpiFilter === 'all' ? data?.kpis : data?.kpis?.filter(k => k.category === kpiFilter);
  
  // Mock reports data for Reports tab
  const recentReports = [
    { id: 1, name: 'Daily Sales Summary', type: 'PDF', date: new Date().toISOString().split('T')[0], status: 'completed' },
    { id: 2, name: 'Weekly Revenue Report', type: 'Excel', date: new Date(Date.now() - 86400000).toISOString().split('T')[0], status: 'completed' },
    { id: 3, name: 'Branch Performance', type: 'PDF', date: new Date(Date.now() - 172800000).toISOString().split('T')[0], status: 'completed' },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.CENTRAL_OPERATIONS_MANAGER, UserRole.GENERAL_MANAGER]}>
      <BranchAwareDashboardLayout>
        <div className="min-h-screen bg-white">
          <div className="max-w-7xl mx-auto px-6 py-6">
            {/* Header - Minimal */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Executive Dashboard</h1>
                <p className="text-sm text-gray-500 mt-0.5">Business overview and performance metrics</p>
              </div>
              <div className="flex items-center gap-2">
                <select 
                  value={selectedPeriod} 
                  onChange={(e) => setSelectedPeriod(e.target.value)} 
                  className="h-9 px-3 pr-8 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </select>
                <div className="relative group">
                  <button 
                    className="h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 flex items-center gap-2"
                    disabled={isExporting}
                  >
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Export
                  </button>
                  <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    <button onClick={() => handleExport('pdf')} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-t-lg">
                      Export PDF
                    </button>
                    <button onClick={() => handleExport('excel')} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-b-lg">
                      Export Excel
                    </button>
                  </div>
                </div>
                <button 
                  onClick={fetchExecutiveData} 
                  disabled={isLoading}
                  className="h-9 px-3 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Tab Navigation - Minimal underline style */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="flex gap-6">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'branches', label: 'Branches' },
                  { id: 'kpis', label: 'KPIs' },
                  { id: 'reports', label: 'Reports' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id 
                        ? 'border-gray-900 text-gray-900' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : !data ? (
              <div className="text-center py-24">
                <BarChart3 className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">No data available</p>
              </div>
            ) : (
              <>
                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Stats Grid - Minimal */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-4 border border-gray-100 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Revenue</span>
                          <span className="flex items-center text-xs text-gray-600">
                            <ArrowUpRight className="h-3 w-3" />12.5%
                          </span>
                        </div>
                        <p className="text-2xl font-semibold text-gray-900">KES {(data.total_revenue || 0).toLocaleString()}</p>
                      </div>
                      <div className="p-4 border border-gray-100 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Orders</span>
                          <span className="flex items-center text-xs text-gray-600">
                            <ArrowUpRight className="h-3 w-3" />8.3%
                          </span>
                        </div>
                        <p className="text-2xl font-semibold text-gray-900">{(data.total_orders || 0).toLocaleString()}</p>
                      </div>
                      <div className="p-4 border border-gray-100 rounded-xl">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Order</span>
                        <p className="text-2xl font-semibold text-gray-900 mt-2">KES {avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div className="p-4 border border-gray-100 rounded-xl">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Staff</span>
                        <p className="text-2xl font-semibold text-gray-900 mt-2">{data.staff_count || 0}</p>
                      </div>
                    </div>

                    {/* Secondary Stats - Light gray bg */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <p className="text-xs text-gray-500 mb-1">Revenue per Staff</p>
                        <p className="text-lg font-semibold text-gray-900">KES {revenuePerStaff.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <p className="text-xs text-gray-500 mb-1">Daily Avg Revenue</p>
                        <p className="text-lg font-semibold text-gray-900">KES {dailyAvgRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <p className="text-xs text-gray-500 mb-1">Active Branches</p>
                        <p className="text-lg font-semibold text-gray-900">{data.branches?.length || 0}</p>
                      </div>
                    </div>

                    {/* Top/Bottom Branch - Minimal */}
                    <div className="grid grid-cols-2 gap-4">
                      {sortedBranches[0] && (
                        <div className="p-4 border border-gray-100 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                              <TrendingUp className="h-5 w-5 text-gray-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Top Performer</p>
                              <p className="font-medium text-gray-900">{sortedBranches[0].branch_name}</p>
                              <p className="text-sm text-gray-600">KES {sortedBranches[0].revenue.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {sortedBranches.length > 1 && (
                        <div className="p-4 border border-gray-100 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                              <TrendingDown className="h-5 w-5 text-gray-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Needs Attention</p>
                              <p className="font-medium text-gray-900">{sortedBranches[sortedBranches.length - 1].branch_name}</p>
                              <p className="text-sm text-gray-600">KES {sortedBranches[sortedBranches.length - 1].revenue.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Branch List - Minimal */}
                    <div className="border border-gray-100 rounded-xl">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-medium text-gray-900">Branch Performance</h3>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {sortedBranches.slice(0, 5).map((branch, index) => {
                          const percentage = totalBranchRevenue > 0 ? (branch.revenue / totalBranchRevenue) * 100 : 0;
                          return (
                            <div key={branch.branch_id} className="px-4 py-3 flex items-center gap-4">
                              <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                                {index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{branch.branch_name}</p>
                                <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-gray-900 rounded-full" style={{ width: `${percentage}%` }} />
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">KES {branch.revenue.toLocaleString()}</p>
                                <p className="text-xs text-gray-500">{branch.orders} orders</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* BRANCHES TAB */}
                {activeTab === 'branches' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sortedBranches.map((branch, index) => {
                        const percentage = totalBranchRevenue > 0 ? (branch.revenue / totalBranchRevenue) * 100 : 0;
                        const isSelected = selectedBranch?.branch_id === branch.branch_id;
                        return (
                          <div 
                            key={branch.branch_id} 
                            onClick={() => setSelectedBranch(isSelected ? null : branch)}
                            className={`p-4 border rounded-xl cursor-pointer transition-all ${
                              isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-gray-400" />
                                <span className="font-medium text-gray-900">{branch.branch_name}</span>
                              </div>
                              {index === 0 && (
                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">Top</span>
                              )}
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Revenue</span>
                                <span className="font-medium text-gray-900">KES {branch.revenue.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Orders</span>
                                <span className="font-medium text-gray-900">{branch.orders}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Share</span>
                                <span className="font-medium text-gray-900">{percentage.toFixed(1)}%</span>
                              </div>
                            </div>
                            <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-gray-900 rounded-full" style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {selectedBranch && (
                      <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">{selectedBranch.branch_name} Details</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
                            <p className="text-xl font-semibold text-gray-900">KES {selectedBranch.revenue.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Total Orders</p>
                            <p className="text-xl font-semibold text-gray-900">{selectedBranch.orders}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Avg Order Value</p>
                            <p className="text-xl font-semibold text-gray-900">
                              KES {selectedBranch.orders > 0 ? (selectedBranch.revenue / selectedBranch.orders).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Revenue Share</p>
                            <p className="text-xl font-semibold text-gray-900">
                              {totalBranchRevenue > 0 ? ((selectedBranch.revenue / totalBranchRevenue) * 100).toFixed(1) : 0}%
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* KPIS TAB */}
                {activeTab === 'kpis' && (
                  <div className="space-y-4">
                    {/* KPI Filter */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-500">Filter:</span>
                      <button
                        onClick={() => setKpiFilter('all')}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          kpiFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        All
                      </button>
                      {kpiCategories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setKpiFilter(cat)}
                          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            kpiFilter === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {!filteredKPIs || filteredKPIs.length === 0 ? (
                      <div className="text-center py-12 border border-gray-100 rounded-xl">
                        <Target className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                        <p className="text-sm text-gray-500">No KPIs found</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredKPIs.map((kpi) => {
                          const progress = kpi.current_value && kpi.target_value ? (kpi.current_value / kpi.target_value) * 100 : 0;
                          const isOnTrack = progress >= 80;
                          return (
                            <div key={kpi.id} className="p-4 border border-gray-100 rounded-xl">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <p className="font-medium text-gray-900">{kpi.name}</p>
                                  <p className="text-xs text-gray-500">{kpi.category}</p>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  isOnTrack ? 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {isOnTrack ? 'On Track' : 'Behind'}
                                </span>
                              </div>
                              <div className="flex items-end justify-between mb-2">
                                <span className="text-2xl font-semibold text-gray-900">{kpi.current_value?.toLocaleString() || 0}</span>
                                <span className="text-sm text-gray-500">/ {kpi.target_value?.toLocaleString()} {kpi.unit}</span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gray-900 rounded-full" style={{ width: `${Math.min(progress, 100)}%` }} />
                              </div>
                              <p className="text-xs text-gray-500 mt-2">{kpi.frequency}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* REPORTS TAB */}
                {activeTab === 'reports' && (
                  <div className="space-y-4">
                    {/* Generate Report Buttons */}
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleExport('pdf')}
                        disabled={isExporting}
                        className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Generate PDF Report
                      </button>
                      <button 
                        onClick={() => handleExport('excel')}
                        disabled={isExporting}
                        className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                      >
                        <FileBarChart className="h-4 w-4" />
                        Generate Excel Report
                      </button>
                    </div>

                    {/* Recent Reports */}
                    <div className="border border-gray-100 rounded-xl">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-medium text-gray-900">Recent Reports</h3>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {recentReports.map((report) => (
                          <div key={report.id} className="px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                {report.type === 'PDF' ? (
                                  <FileText className="h-4 w-4 text-gray-600" />
                                ) : (
                                  <FileBarChart className="h-4 w-4 text-gray-600" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{report.name}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <Calendar className="h-3 w-3" />
                                  {report.date}
                                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{report.type}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button className="p-2 hover:bg-gray-100 rounded-lg">
                                <Eye className="h-4 w-4 text-gray-500" />
                              </button>
                              <button className="p-2 hover:bg-gray-100 rounded-lg">
                                <Download className="h-4 w-4 text-gray-500" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Scheduled Reports Info */}
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Scheduled Reports</p>
                          <p className="text-xs text-gray-500">Daily sales summary sent every day at 6:00 AM</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function ExecutivePage() {
  return (
    <BranchPageWrapper>
      <ExecutiveContent />
    </BranchPageWrapper>
  );
}
