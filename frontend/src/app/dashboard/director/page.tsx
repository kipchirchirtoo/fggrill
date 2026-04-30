'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UserRole } from '@/lib/user-roles';
import { financeAPI } from '@/lib/api/finance';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, Building, 
  Package, AlertTriangle, Download, RefreshCw, Calendar,
  ArrowUpRight, ArrowDownRight, Eye, FileText, BarChart3,
  PieChart as PieIcon, Activity, CheckCircle2, XCircle,
  ShieldCheck, Briefcase, ShoppingCart, Layers
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { API_URL } from '@/lib/config';

const COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5856D6'];

const toNumber = (val: any) => {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
};

export default function DirectorDashboardEnhanced() {
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState('comprehensive');

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch(`${API_URL}/api/finance/branches`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const result = await response.json();
        if (result.success) {
          setBranches(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch branches:', error);
      }
    };
    fetchBranches();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const branchParam = selectedBranchId !== 'all' ? `&branchId=${selectedBranchId}` : '';
      const response = await fetch(`/api/finance/director/comprehensive?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${branchParam}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setDashboardData(result.data);
      } else {
        toast.error(result.message || 'Failed to fetch dashboard data');
      }
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to fetch dashboard data';
      toast.error(message);
      console.error('Director Dashboard Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, selectedBranchId]);

  const handleExportPDF = async () => {
    try {
      toast.info('Generating PDF report...');
      
      const branchParam = selectedBranchId !== 'all' ? `&branchId=${selectedBranchId}` : '';
      const response = await fetch(
        `/api/finance/director/export-pdf?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&reportType=${exportType}${branchParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Director_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('PDF report downloaded successfully');
      setShowExportModal(false);
    } catch (error) {
      toast.error('Failed to export PDF report');
      console.error('PDF Export Error:', error);
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute roles={[UserRole.DIRECTOR, UserRole.SUPER_ADMIN]}>
        <DashboardLayout>
          <div className="flex flex-col items-center justify-center h-screen space-y-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#007AFF]"></div>
            <p className="text-stone-600 text-lg font-medium">Loading Executive Dashboard...</p>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  const financial = dashboardData?.financial || {};
  const occupancy = dashboardData?.occupancy || {};
  const staff = dashboardData?.staff || {};
  const inventory = dashboardData?.inventory || {};
  const discrepancies = dashboardData?.discrepancies || {};

  return (
    <ProtectedRoute roles={[UserRole.DIRECTOR, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-black text-stone-900 tracking-tight">Executive Dashboard</h1>
              <p className="text-stone-500 mt-2 text-lg">Complete oversight of Famous Gate Hotels operations</p>
              <p className="text-xs text-stone-400 mt-1">Last updated: {format(new Date(dashboardData?.lastUpdated || new Date()), 'PPpp')}</p>
            </div>
            <div className="flex items-center gap-3">
              <select 
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="px-4 py-2.5 bg-white border-2 border-stone-200 rounded-xl shadow-md outline-none font-bold text-stone-700 focus:border-[#007AFF] transition-all"
              >
                <option value="all">All Branches</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>

              <div className="flex bg-white border-2 border-stone-200 rounded-xl overflow-hidden shadow-md">
                <input 
                  type="date" 
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
                  className="px-4 py-2.5 text-sm border-r-2 border-stone-200 outline-none font-medium" 
                />
                <input 
                  type="date" 
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
                  className="px-4 py-2.5 text-sm outline-none font-medium" 
                />
              </div>
              <button 
                onClick={fetchData}
                disabled={isLoading}
                className="p-3 bg-[#007AFF] text-white rounded-xl hover:bg-[#0056b3] transition-all shadow-md hover:shadow-lg disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button 
                onClick={() => setShowExportModal(true)}
                className="px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2 font-bold"
              >
                <Download className="w-5 h-5" />
                Export Report
              </button>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard 
              title="Total Revenue" 
              value={`KES ${(financial.totalRevenue || 0).toLocaleString()}`}
              change={`${financial.profitMargin?.toFixed(1) || 0}% margin`}
              trend="up"
              icon={<DollarSign className="w-6 h-6" />}
              color="blue"
            />
            <MetricCard 
              title="Net Profit" 
              value={`KES ${(financial.netProfit || 0).toLocaleString()}`}
              change={`${financial.invoiceCount || 0} invoices`}
              trend="up"
              icon={<TrendingUp className="w-6 h-6" />}
              color="green"
            />
            <MetricCard 
              title="Occupancy Rate" 
              value={`${(occupancy.occupancyRate || 0).toFixed(1)}%`}
              change={`${occupancy.occupiedRooms || 0}/${occupancy.totalRooms || 0} rooms`}
              trend="up"
              icon={<Building className="w-6 h-6" />}
              color="purple"
            />
            <MetricCard 
              title="Active Staff" 
              value={staff.activeStaff || 0}
              change={`${(staff.attendanceRate || 0).toFixed(1)}% attendance`}
              trend="neutral"
              icon={<Users className="w-6 h-6" />}
              color="orange"
            />
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SmallMetricCard 
              label="Total Expenses"
              value={`KES ${(financial.totalExpenses || 0).toLocaleString()}`}
              icon={<TrendingDown className="w-4 h-4" />}
            />
            <SmallMetricCard 
              label="Inventory Value"
              value={`KES ${(inventory.totalValue || 0).toLocaleString()}`}
              icon={<Package className="w-4 h-4" />}
            />
            <SmallMetricCard 
              label="Pending Discrepancies"
              value={discrepancies.pendingFlags || 0}
              icon={<AlertTriangle className="w-4 h-4" />}
              alert={discrepancies.criticalFlags > 0}
            />
            <SmallMetricCard 
              label="Low Stock Items"
              value={inventory.lowStockItems || 0}
              icon={<Package className="w-4 h-4" />}
              alert={inventory.lowStockItems > 5}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend */}
            <ChartCard title="Revenue & Profit Trend" icon={<Activity className="w-5 h-5" />}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={financial.trendByDate || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{fontSize: 10}} />
                  <YAxis tick={{fontSize: 10}} tickFormatter={(val) => `${val/1000}k`} />
                  <Tooltip formatter={(value: number) => `KES ${value.toLocaleString()}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#007AFF" strokeWidth={3} dot={{r: 4}} name="Revenue" />
                  <Line type="monotone" dataKey="profit" stroke="#34C759" strokeWidth={3} dot={{r: 4}} name="Net Profit" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Revenue Breakdown by Department */}
            <ChartCard title="Revenue Breakdown by Department" icon={<PieIcon className="w-5 h-5" />}>
              <div className="flex flex-col md:flex-row items-center justify-between">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(financial.revenueByDepartment || {})
                        .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value: toNumber(value) }))
                        .filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {Object.keys(financial.revenueByDepartment || {}).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `KES ${value.toLocaleString()}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full md:w-64 space-y-2 mt-4 md:mt-0">
                  {Object.entries(financial.revenueByDepartment || {})
                    .filter(([_, val]) => toNumber(val) > 0)
                    .sort((a: any, b: any) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([key, val]: any, idx) => (
                    <div key={key} className="flex justify-between items-center bg-stone-50 p-2 rounded-lg border border-stone-100">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                        <span className="text-[10px] font-bold text-stone-500 uppercase">{key.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="text-xs font-bold text-stone-900">KES {val.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>

            {/* Payment Method Intelligence */}
            <ChartCard title="Payment Method Intelligence" icon={<Activity className="w-5 h-5" />}>
              <div className="flex flex-col md:flex-row items-center justify-between">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Mpesa', value: financial.paymentMethodTotals?.mpesa || 0 },
                        { name: 'Cash', value: financial.paymentMethodTotals?.cash || 0 },
                        { name: 'Swipe', value: financial.paymentMethodTotals?.swipe || 0 },
                        { name: 'Other', value: financial.paymentMethodTotals?.other || 0 }
                      ].filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {COLORS.slice(0, 4).map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `KES ${value.toLocaleString()}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full md:w-48 space-y-2 mt-4 md:mt-0">
                  {Object.entries(financial.paymentMethodTotals || {}).map(([key, val]: any, idx) => (
                    <div key={key} className="flex justify-between items-center bg-stone-50 p-2 rounded-lg border border-stone-100">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                        <span className="text-[10px] font-bold text-stone-500 uppercase">{key}</span>
                      </div>
                      <span className="text-xs font-bold text-stone-900">KES {val.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>

            {/* Revenue vs Expenses Comparison */}
            <ChartCard title="Revenue vs Expenses Comparison" icon={<BarChart3 className="w-5 h-5" />}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={financial.trendByDate || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{fontSize: 10}} />
                  <YAxis tick={{fontSize: 10}} tickFormatter={(val) => `${val/1000}k`} />
                  <Tooltip formatter={(value: number) => `KES ${value.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#007AFF" name="Revenue" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#FF3B30" name="Expenses" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Revenue by Branch */}
            <ChartCard title="Revenue by Branch" icon={<BarChart3 className="w-5 h-5" />}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={financial.revenueByBranch || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{fontSize: 11}} angle={-45} textAnchor="end" height={80} />
                  <YAxis tick={{fontSize: 11}} tickFormatter={(val) => `${val/1000}k`} />
                  <Tooltip formatter={(value: number) => `KES ${value.toLocaleString()}`} />
                  <Bar dataKey="revenue" fill="#007AFF" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Banking Reconciliation */}
            <ChartCard title="Banking Reconciliation View" icon={<Building className="w-5 h-5" />}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-bold text-blue-500 uppercase">Expected Cash</p>
                    <p className="text-lg font-black text-blue-900">KES {(financial.bankingTotals?.expectedCash || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase">Actual Banked</p>
                    <p className="text-lg font-black text-emerald-900">KES {(financial.bankingTotals?.totalBanked || 0).toLocaleString()}</p>
                  </div>
                </div>
                <div className={`p-4 rounded-2xl border ${
                  Math.abs(financial.bankingTotals?.totalUnbanked || 0) > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'
                }`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-stone-500 uppercase">Total Unbanked/Variance</p>
                      <p className={`text-xl font-black ${
                        Math.abs(financial.bankingTotals?.totalUnbanked || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        KES {(financial.bankingTotals?.totalUnbanked || 0).toLocaleString()}
                      </p>
                    </div>
                    {financial.bankingTotals?.recordsWithVariance > 0 && (
                      <div className="bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse">
                        {financial.bankingTotals.recordsWithVariance} FLAGS
                      </div>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => window.location.href = '/dashboard/director/banking'}
                  className="w-full py-2 text-xs font-bold text-[#007AFF] bg-[#007AFF]/5 rounded-xl hover:bg-[#007AFF]/10 transition-all border border-[#007AFF]/20"
                >
                  View Detailed Banking Reconciliation
                </button>
              </div>
            </ChartCard>
          </div>

          {/* Status Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <StatusCard 
              title="Financial Health"
              items={[
                { label: 'Profit Margin', value: `${(financial.profitMargin || 0).toFixed(1)}%`, status: financial.profitMargin > 20 ? 'good' : 'warning' },
                { label: 'Paid Invoices', value: financial.paidInvoices || 0, status: 'good' },
                { label: 'Pending Invoices', value: financial.pendingInvoices || 0, status: financial.pendingInvoices > 10 ? 'warning' : 'good' }
              ]}
            />
            <StatusCard 
              title="Operations"
              items={[
                { label: 'Occupancy Rate', value: `${(occupancy.occupancyRate || 0).toFixed(1)}%`, status: occupancy.occupancyRate > 70 ? 'good' : 'warning' },
                { label: 'Stock Health', value: `${(inventory.stockHealthRate || 0).toFixed(1)}%`, status: inventory.stockHealthRate > 80 ? 'good' : 'warning' },
                { label: 'Staff Attendance', value: `${(staff.attendanceRate || 0).toFixed(1)}%`, status: staff.attendanceRate > 85 ? 'good' : 'warning' }
              ]}
            />
            <StatusCard 
              title="Audit & Compliance"
              items={[
                { label: 'Resolution Rate', value: `${(discrepancies.resolutionRate || 0).toFixed(1)}%`, status: discrepancies.resolutionRate > 80 ? 'good' : 'warning' },
                { label: 'Critical Flags', value: discrepancies.criticalFlags || 0, status: discrepancies.criticalFlags === 0 ? 'good' : 'error' },
                { label: 'Pending Flags', value: discrepancies.pendingFlags || 0, status: discrepancies.pendingFlags < 5 ? 'good' : 'warning' }
              ]}
            />
          </div>

          {/* Branch Submission Status */}
          <div className="bg-white rounded-2xl border-2 border-stone-200 overflow-hidden shadow-lg">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#007AFF]" />
                Branch Submission Tracking
              </h3>
              <span className="text-xs font-bold text-stone-500 bg-white px-3 py-1 rounded-full border border-stone-200">
                Tracking {dashboardData?.submissions?.length || 0} Branches
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-stone-50 text-[10px] uppercase font-black text-stone-500 border-b border-stone-200">
                  <tr>
                    <th className="px-6 py-4">Branch Name</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Submissions</th>
                    <th className="px-6 py-4">Drafts</th>
                    <th className="px-6 py-4">Efficiency</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {dashboardData?.submissions?.map((sub: any) => (
                    <tr key={sub.id} className="hover:bg-stone-50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-stone-900">{sub.name}</p>
                        <p className="text-[10px] text-stone-400">ID: {sub.id}</p>
                      </td>
                      <td className="px-6 py-4">
                        {sub.submitted > 0 ? (
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full border border-emerald-100 uppercase">Active</span>
                        ) : (
                          <span className="px-2 py-1 bg-rose-50 text-rose-600 text-[10px] font-black rounded-full border border-rose-100 uppercase">Missing</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-stone-700">{sub.submitted}</span>
                          <span className="text-xs text-stone-400">days</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-bold ${sub.draft > 0 ? 'text-amber-600' : 'text-stone-400'}`}>
                          {sub.draft}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-full max-w-[100px] bg-stone-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${sub.submitted > 0 ? 'bg-[#007AFF]' : 'bg-stone-300'}`} 
                            style={{ width: `${Math.min(100, (sub.submitted / (sub.totalDays || 1)) * 100)}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-[#007AFF] hover:bg-[#007AFF]/10 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border-2 border-stone-200 p-6 shadow-lg">
            <h3 className="text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#007AFF]" />
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <QuickActionButton 
                label="Payment Details"
                icon={<DollarSign className="w-5 h-5" />}
                href="/dashboard/director/payments"
              />
              <QuickActionButton 
                label="Banking Control"
                icon={<Building className="w-5 h-5" />}
                href="/dashboard/director/banking"
              />
              <QuickActionButton 
                label="Discrepancies"
                icon={<AlertTriangle className="w-5 h-5" />}
                href="/dashboard/director/discrepancies"
                badge={discrepancies.pendingFlags}
              />
              <QuickActionButton 
                label="Deep Drill-Down"
                icon={<Eye className="w-5 h-5" />}
                href="/dashboard/director/drill-down"
              />
              <QuickActionButton 
                label="Review Tasks"
                icon={<FileText className="w-5 h-5" />}
                href="/dashboard/director/tasks"
              />
            </div>
          </div>

          {/* Connected Departments */}
          <div className="bg-stone-50/50 p-8 rounded-3xl border-2 border-stone-200">
            <h3 className="text-sm font-black text-stone-700 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Connected Departments
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <QuickActionButton 
                label="Auditor Portal"
                icon={<ShieldCheck className="w-5 h-5" />}
                href="/dashboard/auditor"
              />
              <QuickActionButton 
                label="HR Command"
                icon={<Users className="w-5 h-5" />}
                href="/dashboard/hr"
              />
              <QuickActionButton 
                label="Financial Workspace"
                icon={<Briefcase className="w-5 h-5" />}
                href="/dashboard/branch-accountant/financial-workspace"
              />
              <QuickActionButton 
                label="Procurement"
                icon={<ShoppingCart className="w-5 h-5" />}
                href="/dashboard/procurement"
              />
            </div>
          </div>
        </div>

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-stone-900 mb-4">Export Report</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">Report Type</label>
                  <select 
                    value={exportType}
                    onChange={(e) => setExportType(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-stone-200 rounded-xl outline-none focus:border-[#007AFF]"
                  >
                    <option value="comprehensive">Comprehensive Report</option>
                    <option value="financial">Financial Only</option>
                    <option value="occupancy">Occupancy Only</option>
                    <option value="staff">Staff Only</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowExportModal(false)}
                    className="flex-1 px-4 py-2 border-2 border-stone-200 rounded-xl font-bold text-stone-700 hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleExportPDF}
                    className="flex-1 px-4 py-2 bg-[#007AFF] text-white rounded-xl font-bold hover:bg-[#0056b3] flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function MetricCard({ title, value, change, trend, icon, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100'
  };

  return (
    <div className="bg-white p-6 rounded-2xl border-2 border-stone-200 shadow-lg hover:shadow-xl transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl border-2 ${colors[color]}`}>
          {icon}
        </div>
        {trend === 'up' && (
          <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">
            <ArrowUpRight className="w-3 h-3" />
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-stone-500 mb-1">{title}</p>
        <h4 className="text-3xl font-black text-stone-900 tracking-tight mb-1">{value}</h4>
        <p className="text-xs text-stone-400 font-medium">{change}</p>
      </div>
    </div>
  );
}

function SmallMetricCard({ label, value, icon, alert }: any) {
  return (
    <div className={`bg-white p-4 rounded-xl border-2 ${alert ? 'border-rose-200 bg-rose-50' : 'border-stone-200'} shadow-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-stone-500 mb-1">{label}</p>
          <p className={`text-lg font-bold ${alert ? 'text-rose-600' : 'text-stone-900'}`}>{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${alert ? 'bg-rose-100 text-rose-600' : 'bg-stone-100 text-stone-500'}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, icon, children }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border-2 border-stone-200 shadow-lg">
      <h3 className="text-lg font-bold text-stone-800 mb-6 flex items-center gap-2">
        <div className="p-2 bg-[#007AFF]/10 rounded-lg text-[#007AFF]">
          {icon}
        </div>
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatusCard({ title, items }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border-2 border-stone-200 shadow-lg">
      <h3 className="text-lg font-bold text-stone-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {items.map((item: any, index: number) => (
          <div key={index} className="flex justify-between items-center">
            <span className="text-sm text-stone-600">{item.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-stone-900">{item.value}</span>
              {item.status === 'good' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              {item.status === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
              {item.status === 'error' && <XCircle className="w-4 h-4 text-rose-500" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickActionButton({ label, icon, href, badge }: any) {
  return (
    <a 
      href={href}
      className="relative p-4 bg-stone-50 hover:bg-[#007AFF]/10 border-2 border-stone-200 hover:border-[#007AFF] rounded-xl transition-all flex flex-col items-center gap-2 group"
    >
      {badge > 0 && (
        <span className="absolute -top-2 -right-2 bg-rose-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <div className="p-3 bg-white rounded-lg border-2 border-stone-200 group-hover:border-[#007AFF] group-hover:bg-[#007AFF] group-hover:text-white transition-all">
        {icon}
      </div>
      <span className="text-sm font-bold text-stone-700 group-hover:text-[#007AFF] text-center">{label}</span>
    </a>
  );
}
