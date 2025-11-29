'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  BarChart3, ArrowLeft, RefreshCw, Download, Calendar, TrendingUp, TrendingDown,
  Clock, CheckCircle, Users, Star, Package, Bed, Filter, FileText,
  PieChart, Activity, Award
} from 'lucide-react';
import { housekeepingAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

interface DailyReport {
  date: string;
  tasks: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    rework: number;
    avgDuration: number;
    byType: Record<string, number>;
  };
  inspections: {
    total: number;
    passed: number;
    failed: number;
    avgScore: number;
  };
  attendance: {
    scheduled: number;
    present: number;
    absent: number;
  };
  maintenance: {
    total: number;
    pending: number;
    completed: number;
  };
  guestRequests: {
    total: number;
    completed: number;
    vip: number;
  };
}

interface StaffPerformance {
  staffId: string;
  staffName: string;
  staffCode: string;
  totalTasks: number;
  avgTasksPerDay: number;
  avgCleaningTime: number;
  avgQualityScore: number;
  punctualityRate: number;
  reworkRate: number;
  inspectionPassRate: number;
}

interface ProductivityReport {
  period: { startDate: string; endDate: string };
  summary: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    avgCompletionTime: number;
    reworkRate: number;
    avgQualityScore: number;
    inspectionPassRate: number;
  };
  trends: { date: string; tasks: number; avgTime: number; quality: number }[];
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<'daily' | 'staff' | 'productivity' | 'turnaround'>('daily');
  
  // Date filters
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Report data
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);
  const [productivityReport, setProductivityReport] = useState<ProductivityReport | null>(null);
  const [turnaroundReport, setTurnaroundReport] = useState<any>(null);

  const fetchDailyReport = async () => {
    setIsLoading(true);
    try {
      const res = await housekeepingAPI.getDailyReport(selectedDate);
      setDailyReport(res.data);
    } catch (error) {
      console.error('Error fetching daily report:', error);
      toast.error('Failed to load daily report');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStaffPerformance = async () => {
    setIsLoading(true);
    try {
      const res = await housekeepingAPI.getStaffPerformanceReport(dateRange.start, dateRange.end);
      setStaffPerformance(res.data?.report || []);
    } catch (error) {
      console.error('Error fetching staff performance:', error);
      toast.error('Failed to load staff performance');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProductivityReport = async () => {
    setIsLoading(true);
    try {
      const res = await housekeepingAPI.getProductivityReport(dateRange.start, dateRange.end);
      setProductivityReport(res.data);
    } catch (error) {
      console.error('Error fetching productivity report:', error);
      toast.error('Failed to load productivity report');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTurnaroundReport = async () => {
    setIsLoading(true);
    try {
      const res = await housekeepingAPI.getTurnaroundReport(selectedDate);
      setTurnaroundReport(res.data);
    } catch (error) {
      console.error('Error fetching turnaround report:', error);
      toast.error('Failed to load turnaround report');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeReport === 'daily') fetchDailyReport();
    else if (activeReport === 'staff') fetchStaffPerformance();
    else if (activeReport === 'productivity') fetchProductivityReport();
    else if (activeReport === 'turnaround') fetchTurnaroundReport();
  }, [activeReport, selectedDate, dateRange]);

  const getScoreColor = (score: number, max: number = 5) => {
    const percent = (score / max) * 100;
    if (percent >= 80) return 'text-emerald-600';
    if (percent >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const StatCard = ({ title, value, subtext, icon: Icon, trend, color = 'blue' }: any) => (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
        </div>
        <div className={`p-2 bg-${color}-100 rounded-lg`}>
          <Icon className={`h-5 w-5 text-${color}-600`} />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center mt-2 text-sm ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {trend >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
          {Math.abs(trend)}% vs previous period
        </div>
      )}
    </Card>
  );

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/housekeeping">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
                <p className="text-gray-600">Housekeeping performance insights</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Report Tabs */}
          <div className="flex gap-2 border-b overflow-x-auto">
            {[
              { id: 'daily', label: 'Daily Report', icon: Calendar },
              { id: 'staff', label: 'Staff Performance', icon: Users },
              { id: 'productivity', label: 'Productivity', icon: Activity },
              { id: 'turnaround', label: 'Room Turnaround', icon: Clock }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveReport(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 whitespace-nowrap transition-colors ${
                  activeReport === tab.id
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Date Filters */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                {activeReport === 'daily' || activeReport === 'turnaround' ? (
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-auto"
                  />
                ) : (
                  <>
                    <Input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="w-auto"
                    />
                    <span className="text-gray-500">to</span>
                    <Input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className="w-auto"
                    />
                  </>
                )}
              </div>
              <Button onClick={() => {
                if (activeReport === 'daily') fetchDailyReport();
                else if (activeReport === 'staff') fetchStaffPerformance();
                else if (activeReport === 'productivity') fetchProductivityReport();
                else fetchTurnaroundReport();
              }} variant="outline" size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </Card>

          {/* Daily Report */}
          {activeReport === 'daily' && dailyReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  title="Tasks Completed"
                  value={dailyReport.tasks.completed}
                  subtext={`of ${dailyReport.tasks.total} total`}
                  icon={CheckCircle}
                  color="emerald"
                />
                <StatCard
                  title="Avg Cleaning Time"
                  value={`${dailyReport.tasks.avgDuration} min`}
                  icon={Clock}
                  color="blue"
                />
                <StatCard
                  title="Inspection Pass Rate"
                  value={dailyReport.inspections.total > 0
                    ? `${Math.round((dailyReport.inspections.passed / dailyReport.inspections.total) * 100)}%`
                    : 'N/A'}
                  icon={Star}
                  color="amber"
                />
                <StatCard
                  title="Staff Present"
                  value={dailyReport.attendance.present}
                  subtext={`of ${dailyReport.attendance.scheduled} scheduled`}
                  icon={Users}
                  color="purple"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tasks by Type */}
                <Card className="p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">Tasks by Type</h3>
                  <div className="space-y-3">
                    {Object.entries(dailyReport.tasks.byType).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-gray-600 capitalize">{type.replace(/_/g, ' ')}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${(count / dailyReport.tasks.total) * 100}%` }}
                            />
                          </div>
                          <span className="font-medium w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Inspections Summary */}
                <Card className="p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">Inspections Summary</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-emerald-50 rounded-lg">
                      <p className="text-3xl font-bold text-emerald-600">{dailyReport.inspections.passed}</p>
                      <p className="text-sm text-emerald-700">Passed</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <p className="text-3xl font-bold text-red-600">{dailyReport.inspections.failed}</p>
                      <p className="text-sm text-red-700">Failed</p>
                    </div>
                    <div className="col-span-2 text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-3xl font-bold text-gray-700">{dailyReport.inspections.avgScore.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">Average Quality Score</p>
                    </div>
                  </div>
                </Card>

                {/* Maintenance & Guest Requests */}
                <Card className="p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">Maintenance Requests</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total</span>
                      <span className="font-semibold">{dailyReport.maintenance.total}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Pending</span>
                      <span className="font-semibold text-amber-600">{dailyReport.maintenance.pending}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Completed</span>
                      <span className="font-semibold text-emerald-600">{dailyReport.maintenance.completed}</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">Guest Requests</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total</span>
                      <span className="font-semibold">{dailyReport.guestRequests.total}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Completed</span>
                      <span className="font-semibold text-emerald-600">{dailyReport.guestRequests.completed}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">VIP Requests</span>
                      <span className="font-semibold text-amber-600">{dailyReport.guestRequests.vip}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Staff Performance */}
          {activeReport === 'staff' && (
            <Card className="p-5">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Staff</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Tasks</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Avg Tasks/Day</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Avg Time</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Quality</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Pass Rate</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Punctuality</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Rework</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffPerformance.map((staff, idx) => (
                      <tr key={staff.staffId} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-semibold text-sm">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="font-medium">{staff.staffName}</p>
                              <p className="text-sm text-gray-500">{staff.staffCode}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-medium">{staff.totalTasks}</td>
                        <td className="py-3 px-4 text-center">{staff.avgTasksPerDay}</td>
                        <td className="py-3 px-4 text-center">{staff.avgCleaningTime} min</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-semibold ${getScoreColor(staff.avgQualityScore)}`}>
                            {staff.avgQualityScore}/5
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-semibold ${staff.inspectionPassRate >= 90 ? 'text-emerald-600' : staff.inspectionPassRate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                            {staff.inspectionPassRate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-semibold ${staff.punctualityRate >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {staff.punctualityRate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-semibold ${staff.reworkRate <= 5 ? 'text-emerald-600' : staff.reworkRate <= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                            {staff.reworkRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {staffPerformance.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No performance data available for this period</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Productivity Report */}
          {activeReport === 'productivity' && productivityReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  title="Completion Rate"
                  value={`${productivityReport.summary.completionRate}%`}
                  icon={CheckCircle}
                  color="emerald"
                />
                <StatCard
                  title="Avg Completion Time"
                  value={`${productivityReport.summary.avgCompletionTime} min`}
                  icon={Clock}
                  color="blue"
                />
                <StatCard
                  title="Quality Score"
                  value={productivityReport.summary.avgQualityScore.toFixed(2)}
                  icon={Star}
                  color="amber"
                />
                <StatCard
                  title="Rework Rate"
                  value={`${productivityReport.summary.reworkRate}%`}
                  icon={Activity}
                  color={productivityReport.summary.reworkRate <= 5 ? 'emerald' : 'red'}
                />
              </div>

              <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Daily Trends</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Tasks</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Avg Time</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Quality</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productivityReport.trends.map(day => (
                        <tr key={day.date} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">{new Date(day.date).toLocaleDateString()}</td>
                          <td className="py-3 px-4 text-center font-medium">{day.tasks}</td>
                          <td className="py-3 px-4 text-center">{day.avgTime} min</td>
                          <td className="py-3 px-4 text-center">
                            <span className={getScoreColor(day.quality)}>{day.quality?.toFixed(2)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* Turnaround Report */}
          {activeReport === 'turnaround' && turnaroundReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard
                  title="Rooms Turned"
                  value={turnaroundReport.totalRooms}
                  icon={Bed}
                  color="blue"
                />
                <StatCard
                  title="Avg Turnaround"
                  value={`${turnaroundReport.avgTurnaroundTime} min`}
                  icon={Clock}
                  color="emerald"
                />
                <StatCard
                  title="Room Types"
                  value={turnaroundReport.byRoomType?.length || 0}
                  icon={PieChart}
                  color="purple"
                />
              </div>

              <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-4">By Room Type</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Room Type</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Count</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Avg Time</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Min</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {turnaroundReport.byRoomType?.map((rt: any) => (
                        <tr key={rt.roomType} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{rt.roomType}</td>
                          <td className="py-3 px-4 text-center">{rt.count}</td>
                          <td className="py-3 px-4 text-center font-medium">{rt.avgTime} min</td>
                          <td className="py-3 px-4 text-center text-emerald-600">{rt.minTime} min</td>
                          <td className="py-3 px-4 text-center text-amber-600">{rt.maxTime} min</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
