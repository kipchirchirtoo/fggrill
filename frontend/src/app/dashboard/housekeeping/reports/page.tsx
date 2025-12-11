'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { housekeepingAPI } from '@/lib/api';
import { 
  FileText, RefreshCw, Download, Calendar, BarChart3, TrendingUp,
  Clock, Users, Bed, CheckCircle, AlertTriangle, Star
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface ReportData {
  period: string;
  roomsCleaned: number;
  averageTime: number;
  inspectionsPassed: number;
  inspectionsFailed: number;
  staffPerformance: { name: string; rooms: number; avgTime: number; rating: number }[];
}

export default function HousekeepingReportsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week');
  const [reportData, setReportData] = useState<ReportData | null>(null);

  useEffect(() => {
    // Mock data - replace with API call
    setReportData({
      period: dateRange,
      roomsCleaned: dateRange === 'today' ? 25 : dateRange === 'week' ? 175 : 720,
      averageTime: 28,
      inspectionsPassed: dateRange === 'today' ? 22 : dateRange === 'week' ? 160 : 680,
      inspectionsFailed: dateRange === 'today' ? 3 : dateRange === 'week' ? 15 : 40,
      staffPerformance: [
        { name: 'Mary Wanjiku', rooms: 45, avgTime: 25, rating: 4.8 },
        { name: 'John Kamau', rooms: 42, avgTime: 27, rating: 4.6 },
        { name: 'Grace Muthoni', rooms: 40, avgTime: 30, rating: 4.5 },
        { name: 'Peter Ochieng', rooms: 38, avgTime: 32, rating: 4.3 },
      ],
    });
    setIsLoading(false);
  }, [dateRange]);

  const handleExport = (format: 'pdf' | 'excel') => {
    toast.success(`Exporting report as ${format.toUpperCase()}...`);
  };

  const passRate = reportData 
    ? Math.round((reportData.inspectionsPassed / (reportData.inspectionsPassed + reportData.inspectionsFailed)) * 100)
    : 0;

  return (
    <ProtectedRoute allowedRoles={[UserRole.HOUSEKEEPING_SUPERVISOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Housekeeping Reports</h1>
              <p className="text-gray-500">Performance analytics and insights</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={() => handleExport('pdf')} leftIcon={<Download />}>
                PDF
              </IOSButton>
              <IOSButton variant="secondary" onClick={() => handleExport('excel')} leftIcon={<Download />}>
                Excel
              </IOSButton>
            </div>
          </div>

          {/* Date Range Selector */}
          <IOSCard className="p-4">
            <div className="flex gap-2">
              {(['today', 'week', 'month'] as const).map((range) => (
                <IOSButton
                  key={range}
                  variant={dateRange === range ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setDateRange(range)}
                >
                  {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
                </IOSButton>
              ))}
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : reportData && (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <IOSCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-ios-lg">
                      <Bed className="h-5 w-5 text-[#007AFF]" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Rooms Cleaned</p>
                      <p className="text-xl font-bold">{reportData.roomsCleaned}</p>
                    </div>
                  </div>
                </IOSCard>
                <IOSCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-ios-lg">
                      <Clock className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Avg. Time</p>
                      <p className="text-xl font-bold">{reportData.averageTime} min</p>
                    </div>
                  </div>
                </IOSCard>
                <IOSCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-ios-lg">
                      <CheckCircle className="h-5 w-5 text-[#34C759]" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Pass Rate</p>
                      <p className="text-xl font-bold text-[#34C759]">{passRate}%</p>
                    </div>
                  </div>
                </IOSCard>
                <IOSCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-ios-lg">
                      <AlertTriangle className="h-5 w-5 text-[#FF3B30]" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Failed Inspections</p>
                      <p className="text-xl font-bold text-[#FF3B30]">{reportData.inspectionsFailed}</p>
                    </div>
                  </div>
                </IOSCard>
              </div>

              {/* Staff Performance */}
              <IOSCard className="p-6">
                <h2 className="text-lg font-semibold font-sf-pro-display mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Staff Performance
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 font-medium">Staff Member</th>
                        <th className="text-center p-3 font-medium">Rooms Cleaned</th>
                        <th className="text-center p-3 font-medium">Avg. Time</th>
                        <th className="text-center p-3 font-medium">Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {reportData.staffPerformance.map((staff, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                                {staff.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <span className="font-medium">{staff.name}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center font-medium">{staff.rooms}</td>
                          <td className="p-3 text-center">{staff.avgTime} min</td>
                          <td className="p-3 text-center">
                            <span className="flex items-center justify-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              {staff.rating}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </IOSCard>

              {/* Charts Placeholder */}
              <div className="grid md:grid-cols-2 gap-6">
                <IOSCard className="p-6">
                  <h3 className="font-semibold font-sf-pro-display mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Daily Cleaning Trend
                  </h3>
                  <div className="h-48 flex items-center justify-center bg-gray-50 rounded-ios-lg">
                    <p className="text-gray-400">Chart visualization</p>
                  </div>
                </IOSCard>
                <IOSCard className="p-6">
                  <h3 className="font-semibold font-sf-pro-display mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Inspection Results
                  </h3>
                  <div className="h-48 flex items-center justify-center bg-gray-50 rounded-ios-lg">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-[#34C759]">{passRate}%</p>
                      <p className="text-gray-500">Pass Rate</p>
                    </div>
                  </div>
                </IOSCard>
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
