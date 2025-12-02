'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, Bed, 
  CreditCard, BarChart3, PieChart, ArrowUpRight, ArrowDownRight,
  RefreshCw, Calendar, Building2, Loader2
} from 'lucide-react';
import { reportsService } from '@/lib/api';
import { IOSCard } from '@/components/ui/ios-card';

interface KPICardData {
  id: string;
  title: string;
  value: number;
  previousValue?: number;
  change: number;
  trend: 'up' | 'down';
  format: 'currency' | 'percent' | 'number';
  subtitle?: string;
}

interface KPIDashboardProps {
  branchId?: number;
  branchName?: string;
  showBranchSelector?: boolean;
  compact?: boolean;
}

export function KPIDashboard({ 
  branchId, 
  branchName,
  showBranchSelector = false,
  compact = false 
}: KPIDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [kpiData, setKpiData] = useState<any>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'quarter'>('month');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    fetchKPIData();
  }, [branchId, period]);

  const fetchKPIData = async () => {
    setIsLoading(true);
    try {
      const response = await reportsService.getKPIDashboard(branchId, period);
      if (response.success) {
        setKpiData(response.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching KPI data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatValue = (value: number, format: string) => {
    if (format === 'currency') {
      if (value >= 1000000) {
        return `KES ${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `KES ${(value / 1000).toFixed(0)}K`;
      }
      return `KES ${value.toLocaleString()}`;
    }
    if (format === 'percent') {
      return `${value.toFixed(1)}%`;
    }
    return value.toLocaleString();
  };

  const formatFullValue = (value: number) => {
    return `KES ${value.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
          {branchName && (
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              {branchName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex bg-[#F2F2F7] rounded-lg p-0.5">
            {(['day', 'week', 'month', 'quarter'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === p 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button 
            onClick={fetchKPIData}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Main KPI Cards - Financial Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue Card */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Revenue</span>
            <div className={`flex items-center gap-0.5 text-xs font-medium ${
              (kpiData?.revenue?.change || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'
            }`}>
              {(kpiData?.revenue?.change || 0) >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(kpiData?.revenue?.change || 0)}%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {formatValue(kpiData?.revenue?.current || 0, 'currency')}
          </div>
          <div className="text-xs text-gray-400">
            {formatFullValue(kpiData?.revenue?.previous || 0)} last {period}
          </div>
        </div>

        {/* Subscription/Recurring Revenue Card */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Room Revenue</span>
            <div className="flex items-center gap-0.5 text-xs font-medium text-emerald-600">
              <ArrowUpRight className="h-3 w-3" />
              22.2%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {formatValue((kpiData?.occupancy?.adr || 0) * (kpiData?.occupancy?.occupied || 0), 'currency')}
          </div>
          <div className="text-xs text-gray-400">
            ADR: {formatValue(kpiData?.occupancy?.adr || 0, 'currency')}
          </div>
        </div>

        {/* Expenses Card */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Expenses</span>
            <div className={`flex items-center gap-0.5 text-xs font-medium ${
              (kpiData?.expenses?.change || 0) <= 0 ? 'text-emerald-600' : 'text-red-500'
            }`}>
              {(kpiData?.expenses?.change || 0) <= 0 ? (
                <ArrowDownRight className="h-3 w-3" />
              ) : (
                <ArrowUpRight className="h-3 w-3" />
              )}
              {Math.abs(kpiData?.expenses?.change || 0)}%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {formatValue(kpiData?.expenses?.current || 0, 'currency')}
          </div>
          <div className="text-xs text-gray-400">
            {formatFullValue(kpiData?.expenses?.previous || 0)} last {period}
          </div>
        </div>

        {/* Profit Card */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Profit</span>
            <div className={`flex items-center gap-0.5 text-xs font-medium ${
              (kpiData?.profit?.change || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'
            }`}>
              {(kpiData?.profit?.change || 0) >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(kpiData?.profit?.change || 0)}%
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {formatValue(kpiData?.profit?.current || 0, 'currency')}
          </div>
          <div className="text-xs text-gray-400">
            Margin: {kpiData?.profit_margin?.current || 0}%
          </div>
        </div>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Occupancy */}
        <div className="bg-[#F8F8FA] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <Bed className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-600">Occupancy</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {kpiData?.occupancy?.rate || 0}%
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            {kpiData?.occupancy?.occupied || 0}/{kpiData?.occupancy?.total_rooms || 0} rooms
          </div>
        </div>

        {/* ADR */}
        <div className="bg-[#F8F8FA] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-green-100 rounded-lg">
              <DollarSign className="h-3.5 w-3.5 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-600">ADR</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {formatValue(kpiData?.occupancy?.adr || 0, 'currency')}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            Avg Daily Rate
          </div>
        </div>

        {/* RevPAR */}
        <div className="bg-[#F8F8FA] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-purple-100 rounded-lg">
              <TrendingUp className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-gray-600">RevPAR</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {formatValue(kpiData?.occupancy?.revpar || 0, 'currency')}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            Rev per Available Room
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-[#F8F8FA] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-orange-100 rounded-lg">
              <CreditCard className="h-3.5 w-3.5 text-orange-600" />
            </div>
            <span className="text-xs font-medium text-gray-600">Transactions</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {kpiData?.transactions?.total || 0}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            This {period}
          </div>
        </div>

        {/* Avg Transaction */}
        <div className="bg-[#F8F8FA] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-indigo-100 rounded-lg">
              <BarChart3 className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <span className="text-xs font-medium text-gray-600">Avg Order</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {formatValue(kpiData?.transactions?.average || 0, 'currency')}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            Per transaction
          </div>
        </div>

        {/* Available Rooms */}
        <div className="bg-[#F8F8FA] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-teal-100 rounded-lg">
              <Users className="h-3.5 w-3.5 text-teal-600" />
            </div>
            <span className="text-xs font-medium text-gray-600">Available</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {kpiData?.occupancy?.available || 0}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            Rooms available
          </div>
        </div>
      </div>

      {/* Payment Methods Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment Methods */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Payment Methods</h3>
          <div className="space-y-3">
            {[
              { label: 'Cash', value: kpiData?.transactions?.cash || 0, color: 'bg-emerald-500' },
              { label: 'Card', value: kpiData?.transactions?.card || 0, color: 'bg-blue-500' },
              { label: 'M-Pesa', value: kpiData?.transactions?.mpesa || 0, color: 'bg-green-500' },
            ].map((method) => {
              const total = (kpiData?.transactions?.cash || 0) + (kpiData?.transactions?.card || 0) + (kpiData?.transactions?.mpesa || 0);
              const percentage = total > 0 ? (method.value / total) * 100 : 0;
              return (
                <div key={method.label} className="flex items-center gap-3">
                  <div className="w-16 text-xs text-gray-600">{method.label}</div>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${method.color} rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="w-20 text-right text-xs font-medium text-gray-900">
                    {formatValue(method.value, 'currency')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Revenue Categories */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue by Category</h3>
          <div className="space-y-3">
            {(kpiData?.categories || []).slice(0, 5).map((cat: any, index: number) => {
              const colors = ['bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-teal-500', 'bg-pink-500'];
              const totalCatRevenue = (kpiData?.categories || []).reduce((sum: number, c: any) => sum + (c.total || 0), 0);
              const percentage = totalCatRevenue > 0 ? ((cat.total || 0) / totalCatRevenue) * 100 : 0;
              return (
                <div key={cat.name || index} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-gray-600 truncate">{cat.name || 'Other'}</div>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${colors[index % colors.length]} rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="w-20 text-right text-xs font-medium text-gray-900">
                    {formatValue(cat.total || 0, 'currency')}
                  </div>
                </div>
              );
            })}
            {(!kpiData?.categories || kpiData.categories.length === 0) && (
              <div className="text-center py-4 text-gray-400 text-sm">
                No category data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-center text-xs text-gray-400">
        Last updated: {lastUpdated.toLocaleTimeString()}
      </div>
    </div>
  );
}
