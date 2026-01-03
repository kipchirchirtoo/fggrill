'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Calendar, DollarSign, Users, Bed,
  BarChart3, LineChart, PieChart, ArrowUpRight, ArrowDownRight,
  Target, Zap, Clock, RefreshCw, Download, Filter
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart as RechartsLine, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart as RechartsPie, Pie, Cell, ComposedChart
} from 'recharts';
import { reportsAPI, pricingAPI } from '@/lib/api';
import { toast } from 'sonner';

// Sample data for charts
const occupancyForecast = [
  { date: 'Mon', actual: 72, predicted: 75, confidence: 5 },
  { date: 'Tue', actual: 68, predicted: 70, confidence: 4 },
  { date: 'Wed', actual: 75, predicted: 73, confidence: 4 },
  { date: 'Thu', actual: 80, predicted: 78, confidence: 5 },
  { date: 'Fri', actual: 92, predicted: 88, confidence: 6 },
  { date: 'Sat', actual: 95, predicted: 92, confidence: 7 },
  { date: 'Sun', actual: 85, predicted: 82, confidence: 5 },
];

const revenueByChannel = [
  { name: 'Direct', value: 45, color: '#3B82F6' },
  { name: 'Booking.com', value: 25, color: '#10B981' },
  { name: 'Expedia', value: 15, color: '#F59E0B' },
  { name: 'Walk-in', value: 10, color: '#8B5CF6' },
  { name: 'Corporate', value: 5, color: '#EC4899' },
];

const monthlyRevenue = [
  { month: 'Jan', revenue: 2400000, rooms: 1800000, fnb: 400000, other: 200000 },
  { month: 'Feb', revenue: 2100000, rooms: 1600000, fnb: 350000, other: 150000 },
  { month: 'Mar', revenue: 2800000, rooms: 2100000, fnb: 480000, other: 220000 },
  { month: 'Apr', revenue: 3200000, rooms: 2400000, fnb: 550000, other: 250000 },
  { month: 'May', revenue: 2900000, rooms: 2200000, fnb: 480000, other: 220000 },
  { month: 'Jun', revenue: 3500000, rooms: 2700000, fnb: 550000, other: 250000 },
];

const adrTrend = [
  { week: 'W1', adr: 8500, revpar: 6200 },
  { week: 'W2', adr: 8800, revpar: 6500 },
  { week: 'W3', adr: 9200, revpar: 7100 },
  { week: 'W4', adr: 9500, revpar: 7800 },
  { week: 'W5', adr: 9800, revpar: 8200 },
  { week: 'W6', adr: 10200, revpar: 8800 },
];

const roomTypePerformance = [
  { type: 'Standard', occupancy: 78, adr: 7500, revenue: 2100000 },
  { type: 'Deluxe', occupancy: 85, adr: 12000, revenue: 3200000 },
  { type: 'Suite', occupancy: 65, adr: 25000, revenue: 1800000 },
  { type: 'Executive', occupancy: 72, adr: 18000, revenue: 1500000 },
];

export default function AdvancedAnalyticsPage() {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState('30d');
  const [kpis, setKpis] = useState({
    totalRevenue: 18500000,
    revenueChange: 12.5,
    occupancyRate: 78.5,
    occupancyChange: 5.2,
    adr: 9500,
    adrChange: 8.3,
    revpar: 7460,
    revparChange: 14.1,
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `KES ${(value / 1000000).toFixed(1)}M`;
    }
    return `KES ${(value / 1000).toFixed(0)}K`;
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-KE').format(value);
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-500" />
            Advanced Analytics
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            AI-powered insights and revenue forecasting
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="ytd">Year to Date</option>
          </select>
          <button className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <Filter className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <button
            className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            onClick={() => {
              toast.promise(
                reportsAPI.exportReport({
                  reportType: 'occupancy',
                  format: 'pdf',
                  filters: {
                    startDate: new Date(new Date().setDate(new Date().getDate() - (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90))).toISOString(),
                    endDate: new Date().toISOString()
                  }
                }),
                {
                  loading: 'Generating PDF report...',
                  success: 'Report downloaded successfully',
                  error: 'Failed to generate report'
                }
              );
            }}
          >
            <Download className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <button className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 bg-white/20 rounded-lg">
              <DollarSign className="w-6 h-6" />
            </div>
            <div className={`flex items-center gap-1 text-sm ${kpis.revenueChange >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {kpis.revenueChange >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(kpis.revenueChange)}%
            </div>
          </div>
          <div className="mt-4">
            <p className="text-blue-100 text-sm">Total Revenue</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(kpis.totalRevenue)}</p>
          </div>
        </motion.div>

        {/* Occupancy Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 bg-white/20 rounded-lg">
              <Bed className="w-6 h-6" />
            </div>
            <div className={`flex items-center gap-1 text-sm ${kpis.occupancyChange >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {kpis.occupancyChange >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(kpis.occupancyChange)}%
            </div>
          </div>
          <div className="mt-4">
            <p className="text-green-100 text-sm">Occupancy Rate</p>
            <p className="text-2xl font-bold mt-1">{kpis.occupancyRate}%</p>
          </div>
        </motion.div>

        {/* ADR */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 bg-white/20 rounded-lg">
              <Target className="w-6 h-6" />
            </div>
            <div className={`flex items-center gap-1 text-sm ${kpis.adrChange >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {kpis.adrChange >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(kpis.adrChange)}%
            </div>
          </div>
          <div className="mt-4">
            <p className="text-purple-100 text-sm">Avg. Daily Rate</p>
            <p className="text-2xl font-bold mt-1">KES {formatNumber(kpis.adr)}</p>
          </div>
        </motion.div>

        {/* RevPAR */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 bg-white/20 rounded-lg">
              <Zap className="w-6 h-6" />
            </div>
            <div className={`flex items-center gap-1 text-sm ${kpis.revparChange >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {kpis.revparChange >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(kpis.revparChange)}%
            </div>
          </div>
          <div className="mt-4">
            <p className="text-amber-100 text-sm">RevPAR</p>
            <p className="text-2xl font-bold mt-1">KES {formatNumber(kpis.revpar)}</p>
          </div>
        </motion.div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Occupancy Forecast */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Occupancy Forecast
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                AI-predicted vs actual occupancy
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                Actual
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                Predicted
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={occupancyForecast}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="date" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Area
                type="monotone"
                dataKey="predicted"
                fill="#10B981"
                fillOpacity={0.2}
                stroke="#10B981"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#3B82F6"
                strokeWidth={3}
                dot={{ fill: '#3B82F6', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue by Channel */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Revenue by Channel
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <RechartsPie>
              <Pie
                data={revenueByChannel}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {revenueByChannel.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPie>
          </ResponsiveContainer>
          <div className="space-y-2 mt-4">
            {revenueByChannel.map((channel) => (
              <div key={channel.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: channel.color }}></span>
                  <span className="text-gray-600 dark:text-gray-400">{channel.name}</span>
                </span>
                <span className="font-medium text-gray-900 dark:text-white">{channel.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Monthly Revenue Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="month" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend />
              <Bar dataKey="rooms" stackId="a" fill="#3B82F6" name="Rooms" />
              <Bar dataKey="fnb" stackId="a" fill="#10B981" name="F&B" />
              <Bar dataKey="other" stackId="a" fill="#8B5CF6" name="Other" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ADR & RevPAR Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            ADR & RevPAR Trend
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <RechartsLine data={adrTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="week" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                formatter={(value: number) => `KES ${formatNumber(value)}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="adr"
                stroke="#8B5CF6"
                strokeWidth={3}
                dot={{ fill: '#8B5CF6' }}
                name="ADR"
              />
              <Line
                type="monotone"
                dataKey="revpar"
                stroke="#F59E0B"
                strokeWidth={3}
                dot={{ fill: '#F59E0B' }}
                name="RevPAR"
              />
            </RechartsLine>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Room Type Performance Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Room Type Performance
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Room Type</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Occupancy</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">ADR</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Revenue</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Performance</th>
              </tr>
            </thead>
            <tbody>
              {roomTypePerformance.map((room) => (
                <tr key={room.type} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-4 px-4">
                    <span className="font-medium text-gray-900 dark:text-white">{room.type}</span>
                  </td>
                  <td className="text-right py-4 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${room.occupancy}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-900 dark:text-white">{room.occupancy}%</span>
                    </div>
                  </td>
                  <td className="text-right py-4 px-4 text-gray-900 dark:text-white">
                    KES {formatNumber(room.adr)}
                  </td>
                  <td className="text-right py-4 px-4 text-gray-900 dark:text-white font-medium">
                    {formatCurrency(room.revenue)}
                  </td>
                  <td className="text-right py-4 px-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${room.occupancy >= 80
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : room.occupancy >= 70
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                      {room.occupancy >= 80 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : room.occupancy >= 70 ? (
                        <Clock className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {room.occupancy >= 80 ? 'Excellent' : room.occupancy >= 70 ? 'Good' : 'Needs Attention'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <Zap className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">AI-Powered Insights</h3>
            <div className="space-y-2 text-indigo-100">
              <p>• <strong>Revenue Opportunity:</strong> Weekend rates can be increased by 15% based on demand patterns</p>
              <p>• <strong>Occupancy Alert:</strong> Tuesday occupancy trending 8% below forecast - consider promotional rates</p>
              <p>• <strong>Channel Mix:</strong> Direct bookings up 12% - marketing efforts showing positive ROI</p>
              <p>• <strong>Pricing Suggestion:</strong> Deluxe rooms underpriced by ~KES 1,500 compared to market</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
