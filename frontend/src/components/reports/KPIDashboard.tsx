'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, Bed, 
  CreditCard, BarChart3, PieChart, ArrowUpRight, ArrowDownRight,
  RefreshCw, Calendar, Building2, Loader2, Download, Target,
  Activity, Clock, Percent, FileText, Eye, ChevronRight
} from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPieChart, Cell, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, RadialBarChart, RadialBar
} from 'recharts';
import { reportsService } from '@/lib/api';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';

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

  // Warm, human-designed color palette
  const COLORS = {
    text: '#44403c',
    textLight: '#78716c',
    border: '#e7e5e4',
    background: '#fafaf9',
    backgroundLight: '#f5f5f4',
    primary: '#57534e',
    secondary: '#a8a29e',
    accent: '#d97706',
    // Chart colors - muted, professional
    chart: {
      blue: '#0891b2',
      green: '#059669',
      orange: '#d97706',
      purple: '#7c3aed',
      gray: '#78716c',
      lightGray: '#e7e5e4'
    }
  };

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

  const exportToPDF = async () => {
    try {
      // Export KPI dashboard as PDF
      await reportsService.downloadReport('kpi_dashboard', {
        branch_id: branchId,
        branch_name: branchName,
        period: period,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
      }, 'pdf');
    } catch (error) {
      console.error('Error exporting PDF:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-stone-400 mx-auto mb-3" />
          <p className="text-sm text-stone-500">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // Process real data for charts - NO MOCK DATA
  const getRevenueChartData = () => {
    if (!kpiData?.daily_breakdown || !Array.isArray(kpiData.daily_breakdown) || kpiData.daily_breakdown.length === 0) {
      return [];
    }
    
    return kpiData.daily_breakdown.map((day: any) => ({
      name: new Date(day.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      revenue: day.total_revenue || 0,
      profit: day.profit || 0,
      expenses: day.expenses || 0
    }));
  };

  const getOccupancyData = () => {
    if (!kpiData?.occupancy?.rate && kpiData?.occupancy?.rate !== 0) {
      return [];
    }
    
    const occupancyRate = kpiData.occupancy.rate;
    return [
      { name: 'Occupied', value: occupancyRate, color: COLORS.chart.blue },
      { name: 'Available', value: 100 - occupancyRate, color: COLORS.chart.lightGray }
    ];
  };

  const getPaymentMethodsData = () => {
    const cash = kpiData?.transactions?.cash || 0;
    const card = kpiData?.transactions?.card || 0;
    const mpesa = kpiData?.transactions?.mpesa || 0;
    const total = cash + card + mpesa;
    
    if (total === 0) {
      return [];
    }
    
    return [
      { name: 'Cash', value: Math.round((cash / total) * 100), amount: cash, color: COLORS.chart.green },
      { name: 'Card', value: Math.round((card / total) * 100), amount: card, color: COLORS.chart.blue },
      { name: 'M-Pesa', value: Math.round((mpesa / total) * 100), amount: mpesa, color: COLORS.chart.orange }
    ];
  };

  const getRevenueStreamsData = () => {
    if (!kpiData?.categories || !Array.isArray(kpiData.categories) || kpiData.categories.length === 0) {
      return [];
    }
    
    const total = kpiData.categories.reduce((sum: number, cat: any) => sum + (cat.total || 0), 0);
    
    if (total === 0) {
      return [];
    }
    
    return kpiData.categories.slice(0, 4).map((cat: any, index: number) => ({
      name: cat.name || 'Unknown',
      value: Math.round(((cat.total || 0) / total) * 100),
      amount: cat.total || 0,
      color: [COLORS.chart.blue, COLORS.chart.green, COLORS.chart.orange, COLORS.chart.purple][index % 4]
    }));
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-6xl mx-auto px-5 py-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold text-stone-800 tracking-tight">KPI Dashboard</h1>
            <div className="flex items-center gap-2 mt-1">
              {branchName && (
                <span className="text-sm text-stone-500">{branchName}</span>
              )}
              {branchName && <span className="text-stone-300">•</span>}
              <span className="text-sm text-stone-400">
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Period Selector */}
            <div className="flex bg-white border border-stone-200 rounded-lg p-0.5">
              {(['day', 'week', 'month', 'quarter'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-all ${
                    period === p 
                      ? 'bg-stone-800 text-white shadow-sm' 
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            
            <button
              onClick={fetchKPIData}
              className="p-2 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            
            <button
              onClick={exportToPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 text-white text-[13px] font-medium rounded-lg hover:bg-stone-700 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>

        {/* Revenue Trend Chart */}
        <div className="bg-white rounded-xl p-5 border border-stone-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-semibold text-stone-700">Revenue & Profit</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.chart.blue }}></div>
                <span className="text-xs text-stone-500">Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.chart.green }}></div>
                <span className="text-xs text-stone-500">Profit</span>
              </div>
            </div>
          </div>
          <div className="h-72">
            {getRevenueChartData().length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={getRevenueChartData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                  <XAxis dataKey="name" stroke="#78716c" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#78716c" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e7e5e4', 
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                    formatter={(value, name) => [`KES ${value.toLocaleString()}`, name]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    fill={COLORS.chart.blue}
                    fillOpacity={0.3}
                    stroke={COLORS.chart.blue}
                    strokeWidth={2}
                  />
                  <Bar dataKey="profit" fill={COLORS.chart.green} radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-stone-400">No revenue data available</p>
              </div>
            )}
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total Revenue Card */}
          <div className="bg-white rounded-lg p-4 border border-stone-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-stone-500">Revenue</span>
              <span className={`text-xs font-medium ${(kpiData?.revenue?.change || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {(kpiData?.revenue?.change || 0) >= 0 ? '+' : ''}{(kpiData?.revenue?.change || 0).toFixed(1)}%
              </span>
            </div>
            <p className="text-xl font-semibold text-stone-800">
              {formatValue(kpiData?.revenue?.current || 0, 'currency')}
            </p>
            <p className="text-xs text-stone-400 mt-1">
              vs {formatValue(kpiData?.revenue?.previous || 0, 'currency')}
            </p>
          </div>

          {/* Occupancy Rate Card */}
          <div className="bg-white rounded-lg p-4 border border-stone-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-stone-500">Occupancy</span>
              <span className="text-xs font-medium text-stone-400">
                {kpiData?.occupancy?.occupied || 0}/{kpiData?.occupancy?.total_rooms || 0}
              </span>
            </div>
            <p className="text-xl font-semibold text-stone-800">
              {(kpiData?.occupancy?.rate || 0).toFixed(0)}%
            </p>
            <p className="text-xs text-stone-400 mt-1">rooms occupied</p>
          </div>

          {/* Average Daily Rate */}
          <div className="bg-white rounded-lg p-4 border border-stone-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-stone-500">ADR</span>
            </div>
            <p className="text-xl font-semibold text-stone-800">
              {formatValue(kpiData?.occupancy?.adr || 0, 'currency')}
            </p>
            <p className="text-xs text-stone-400 mt-1">
              RevPAR: {formatValue(kpiData?.occupancy?.revpar || 0, 'currency')}
            </p>
          </div>

          {/* Net Profit */}
          <div className="bg-white rounded-lg p-4 border border-stone-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-stone-500">Net Profit</span>
              <span className={`text-xs font-medium ${(kpiData?.profit?.change || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {(kpiData?.profit?.change || 0) >= 0 ? '+' : ''}{(kpiData?.profit?.change || 0).toFixed(1)}%
              </span>
            </div>
            <p className="text-xl font-semibold text-stone-800">
              {formatValue(kpiData?.profit?.current || 0, 'currency')}
            </p>
            <p className="text-xs text-stone-400 mt-1">
              {(kpiData?.profit_margin?.current || 0).toFixed(1)}% margin
            </p>
          </div>
        </div>

        {/* Charts Grid - Payment Methods & Revenue Streams */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Payment Methods Pie Chart */}
          <div className="bg-white rounded-lg p-5 border border-stone-200/80 shadow-sm">
            <h3 className="text-[15px] font-semibold text-stone-700 mb-4">Payment Methods</h3>
            <div className="h-52 mb-4">
              {getPaymentMethodsData().length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={getPaymentMethodsData()}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {getPaymentMethodsData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name) => [`${value}%`, name]}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e7e5e4', 
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-stone-400">No payment data</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {getPaymentMethodsData().map((method) => (
                <div key={method.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: method.color }}></div>
                    <span className="text-sm text-stone-600">{method.name}</span>
                  </div>
                  <span className="text-sm font-medium text-stone-700">KES {method.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue Streams Bar Chart */}
          <div className="bg-white rounded-lg p-5 border border-stone-200/80 shadow-sm">
            <h3 className="text-[15px] font-semibold text-stone-700 mb-4">Revenue Streams</h3>
            <div className="h-52 mb-4">
              {getRevenueStreamsData().length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getRevenueStreamsData()} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                    <XAxis dataKey="name" stroke="#78716c" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#78716c" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip 
                      formatter={(value) => [`KES ${value.toLocaleString()}`, 'Revenue']}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e7e5e4', 
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {getRevenueStreamsData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-stone-400">No revenue data</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {getRevenueStreamsData().map((stream) => (
                <div key={stream.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stream.color }}></div>
                    <span className="text-sm text-stone-600">{stream.name}</span>
                  </div>
                  <span className="text-sm font-medium text-stone-700">{stream.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Occupancy Section */}
        <div className="bg-white rounded-lg p-5 border border-stone-200/80 shadow-sm">
          <h3 className="text-[15px] font-semibold text-stone-700 mb-4">Room Occupancy</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div className="h-48">
              {getOccupancyData().length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={getOccupancyData()}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {getOccupancyData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name) => [`${value}%`, name]}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e7e5e4', 
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-stone-400">No occupancy data</p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-3xl font-semibold text-stone-800">{(kpiData?.occupancy?.rate || 0).toFixed(0)}%</div>
                <div className="text-sm text-stone-500">occupancy rate</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-stone-50 rounded-lg">
                  <div className="text-lg font-semibold text-stone-800">{kpiData?.occupancy?.occupied || 0}</div>
                  <div className="text-xs text-stone-500">occupied</div>
                </div>
                <div className="p-3 bg-stone-50 rounded-lg">
                  <div className="text-lg font-semibold text-stone-800">{kpiData?.occupancy?.available || 0}</div>
                  <div className="text-xs text-stone-500">available</div>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-stone-500">ADR</span>
                  <span className="text-sm font-medium text-stone-700">{formatValue(kpiData?.occupancy?.adr || 0, 'currency')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-stone-500">RevPAR</span>
                  <span className="text-sm font-medium text-stone-700">{formatValue(kpiData?.occupancy?.revpar || 0, 'currency')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
