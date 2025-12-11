'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { reportAPI } from '@/lib/api';
import { 
  DollarSign, TrendingUp, Calendar, Download, 
  CreditCard, AlertTriangle 
} from 'lucide-react';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import { toast } from 'sonner';

export default function RevenueReportsPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');

  const fetchRevenue = async () => {
    setIsLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      if (dateRange === '30d') startDate.setDate(startDate.getDate() - 30);
      if (dateRange === '7d') startDate.setDate(startDate.getDate() - 7);
      if (dateRange === '90d') startDate.setDate(startDate.getDate() - 90);

      const res = await reportAPI.getRevenueReport({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      if (res.success) {
        setData(res.data);
      }
    } catch (error) {
      toast.error('Failed to load revenue data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenue();
  }, [dateRange]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Revenue Analytics</h1>
              <p className="text-gray-500">Financial performance and trends</p>
            </div>
            <div className="flex gap-2">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 border rounded-ios-lg bg-white"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 3 Months</option>
              </select>
              <IOSButton variant="outline" leftIcon={<Download />}>
                Export
              </IOSButton>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <IOSCard className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 text-green-600 rounded-full">
                      <DollarSign className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Revenue</p>
                      <p className="text-2xl font-bold">KES {data?.totalRevenue?.toLocaleString() ?? 0}</p>
                    </div>
                  </div>
                </IOSCard>

                <IOSCard className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                      <CreditCard className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Paid Revenue</p>
                      <p className="text-2xl font-bold">KES {data?.paidRevenue?.toLocaleString() ?? 0}</p>
                    </div>
                  </div>
                </IOSCard>

                <IOSCard className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-100 text-yellow-600 rounded-full">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Outstanding</p>
                      <p className="text-2xl font-bold">KES {data?.outstandingRevenue?.toLocaleString() ?? 0}</p>
                    </div>
                  </div>
                </IOSCard>

                <IOSCard className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-full">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">ADR</p>
                      <p className="text-2xl font-bold">KES {Math.round(data?.averageRoomRate ?? 0).toLocaleString()}</p>
                    </div>
                  </div>
                </IOSCard>
              </div>

              {/* Charts */}
              <IOSCard className="p-6">
                <h3 className="text-lg font-bold mb-6">Revenue Trend</h3>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.dailyBreakdown || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Revenue']}
                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                      />
                      <Bar dataKey="revenue" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </IOSCard>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
