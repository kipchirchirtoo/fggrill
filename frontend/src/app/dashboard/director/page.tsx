'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UserRole } from '@/lib/user-roles';
import { financeAPI } from '@/lib/api/finance';
import { 
  TrendingUp, TrendingDown, DollarSign, PieChart as PieIcon, 
  BarChart3, AlertCircle, Calendar, RefreshCw, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';

const COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5856D6'];

export default function DirectorDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [visualData, setVisualData] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [overviewRes, visualRes] = await Promise.all([
        financeAPI.director.getOverview(dateRange),
        financeAPI.director.getVisuals(dateRange)
      ]);

      if (overviewRes.success) {
        setOverview(overviewRes.data);
      } else {
        toast.error(overviewRes.message || 'Failed to fetch overview data');
      }
      
      if (visualRes.success) {
        setVisualData(visualRes.data);
      } else {
        toast.error(visualRes.message || 'Failed to fetch visual data');
      }
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to fetch dashboard data';
      
      if (message.includes('403') || message.includes('Forbidden')) {
        toast.error('Access Denied: You need director role to view this dashboard');
      } else if (message.includes('401') || message.includes('Unauthorized')) {
        toast.error('Please log in to access this dashboard');
      } else {
        toast.error(message);
      }
      
      console.error('Director Dashboard Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  return (
    <ProtectedRoute roles={[UserRole.DIRECTOR, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="p-6 space-y-8">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Global Financial Overview</h1>
              <p className="text-stone-500 mt-1">Cross-branch performance and financial health</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
                <input 
                  type="date" 
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
                  className="px-3 py-2 text-sm border-r border-stone-200 outline-none" 
                />
                <input 
                  type="date" 
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
                  className="px-3 py-2 text-sm outline-none" 
                />
              </div>
              <button 
                onClick={fetchData}
                className="p-2.5 bg-[#007AFF] text-white rounded-xl hover:bg-[#0056b3] transition-colors shadow-sm"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007AFF]"></div>
              <p className="text-stone-500 text-sm">Loading director dashboard...</p>
            </div>
          ) : !overview ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center">
              <AlertCircle className="w-12 h-12 text-rose-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-rose-900 mb-2">Access Denied</h3>
              <p className="text-rose-700 mb-4">
                You need the <strong>director</strong> role to access this dashboard.
              </p>
              <div className="bg-white rounded-xl p-4 text-left text-sm space-y-2">
                <p className="font-bold text-stone-900">To fix this:</p>
                <ol className="list-decimal list-inside space-y-1 text-stone-600">
                  <li>Run: <code className="bg-stone-100 px-2 py-0.5 rounded">node backend/fix-director-role.js your-email@example.com</code></li>
                  <li>Log out and log back in</li>
                  <li>Refresh this page</li>
                </ol>
              </div>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Total Revenue" 
              value={overview?.totalRevenue || 0} 
              icon={<DollarSign className="w-5 h-5 text-[#007AFF]" />}
              trend="+12.5%" 
              trendType="up"
            />
            <StatCard 
              title="Total Expenses" 
              value={overview?.totalExpenses || 0} 
              icon={<TrendingDown className="w-5 h-5 text-rose-500" />}
              trend="+4.2%" 
              trendType="down"
            />
            <StatCard 
              title="Net Profit" 
              value={overview?.netProfit || 0} 
              icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
              trend="+18.3%" 
              trendType="up"
            />
            <StatCard 
              title="Profit Margin" 
              value={`${(overview?.profitMargin || 0).toFixed(1)}%`} 
              icon={<BarChart3 className="w-5 h-5 text-amber-500" />}
              trend="+2.1%" 
              trendType="up"
              isCurrency={false}
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <h3 className="text-lg font-bold text-stone-800 mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#007AFF]" />
                Revenue & Profit Trends
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={visualData?.trends || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 12, fill: '#888'}} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 12, fill: '#888'}}
                      tickFormatter={(val) => `KES ${val/1000}k`}
                    />
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                    />
                    <Legend iconType="circle" />
                    <Line type="monotone" dataKey="revenue" stroke="#007AFF" strokeWidth={3} dot={false} name="Revenue" />
                    <Line type="monotone" dataKey="profit" stroke="#34C759" strokeWidth={3} dot={false} name="Profit" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Profit by Branch */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <h3 className="text-lg font-bold text-stone-800 mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#007AFF]" />
                Performance by Branch
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={visualData?.branchPerformance || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 12, fill: '#444'}} 
                      width={100}
                    />
                    <Tooltip cursor={{fill: '#f8f8f8'}} />
                    <Bar dataKey="revenue" fill="#007AFF" radius={[0, 4, 4, 0]} name="Revenue" />
                    <Bar dataKey="profit" fill="#34C759" radius={[0, 4, 4, 0]} name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function StatCard({ title, value, icon, trend, trendType, isCurrency = true }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-100">
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
          trendType === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
        }`}>
          {trendType === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-stone-500 mb-1">{title}</p>
        <h4 className="text-2xl font-bold text-stone-900 tracking-tight">
          {isCurrency ? `KES ${Number(value).toLocaleString()}` : value}
        </h4>
      </div>
    </div>
  );
}
