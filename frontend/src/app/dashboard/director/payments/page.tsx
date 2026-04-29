'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UserRole } from '@/lib/user-roles';
import { financeAPI } from '@/lib/api/finance';
import { 
  CreditCard, TrendingUp, DollarSign, PieChart as PieIcon,
  RefreshCw, Calendar, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';

const COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30'];

export default function PaymentIntelligencePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.director.getPayments(dateRange);
      if (response.success) {
        setPaymentData(response.data);
      } else {
        toast.error('Failed to fetch payment data');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch payment data';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const pieData = paymentData ? [
    { name: 'M-PESA', value: paymentData.mpesa, color: '#007AFF' },
    { name: 'Cash', value: paymentData.cash, color: '#34C759' },
    { name: 'Card', value: paymentData.card, color: '#FF9500' }
  ].filter(item => item.value > 0) : [];

  return (
    <ProtectedRoute roles={[UserRole.DIRECTOR, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Payment Intelligence</h1>
              <p className="text-stone-500 mt-1">Payment method breakdown and trends</p>
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
                disabled={isLoading}
                className="p-2.5 bg-[#007AFF] text-white rounded-xl hover:bg-[#0056b3] transition-colors shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007AFF]"></div>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                  title="Total Payments" 
                  value={paymentData?.total || 0} 
                  icon={<DollarSign className="w-5 h-5 text-[#007AFF]" />}
                />
                <StatCard 
                  title="M-PESA" 
                  value={paymentData?.mpesa || 0} 
                  icon={<CreditCard className="w-5 h-5 text-[#007AFF]" />}
                  percentage={paymentData?.total ? ((paymentData.mpesa / paymentData.total) * 100).toFixed(1) : '0'}
                />
                <StatCard 
                  title="Cash" 
                  value={paymentData?.cash || 0} 
                  icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
                  percentage={paymentData?.total ? ((paymentData.cash / paymentData.total) * 100).toFixed(1) : '0'}
                />
                <StatCard 
                  title="Card" 
                  value={paymentData?.card || 0} 
                  icon={<CreditCard className="w-5 h-5 text-amber-500" />}
                  percentage={paymentData?.total ? ((paymentData.card / paymentData.total) * 100).toFixed(1) : '0'}
                />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                  <h3 className="text-lg font-bold text-stone-800 mb-6 flex items-center gap-2">
                    <PieIcon className="w-5 h-5 text-[#007AFF]" />
                    Payment Method Distribution
                  </h3>
                  <div className="h-[300px] w-full">
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => `KES ${value.toLocaleString()}`} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-stone-400">
                        No payment data available
                      </div>
                    )}
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                  <h3 className="text-lg font-bold text-stone-800 mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#007AFF]" />
                    Payment Method Comparison
                  </h3>
                  <div className="h-[300px] w-full">
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={pieData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 12, fill: '#888'}} 
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 12, fill: '#888'}}
                            tickFormatter={(val) => `${val/1000}k`}
                          />
                          <Tooltip 
                            formatter={(value: number) => `KES ${value.toLocaleString()}`}
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                          />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-stone-400">
                        No payment data available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function StatCard({ title, value, icon, percentage }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-100">
          {icon}
        </div>
        {percentage && (
          <div className="text-xs font-bold text-stone-500">
            {percentage}%
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-stone-500 mb-1">{title}</p>
        <h4 className="text-2xl font-bold text-stone-900 tracking-tight">
          KES {Number(value).toLocaleString()}
        </h4>
      </div>
    </div>
  );
}
