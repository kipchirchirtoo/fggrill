'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { fetchAPI } from '@/lib/api/core';
import {
  Award, TrendingUp, Users, CheckCircle, Clock, Target, RefreshCw,
  ArrowLeft, Calendar, Filter, Download, Eye, Star, AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface StaffPerformance {
  staff_id: string;
  staff_name: string;
  email: string;
  role: string;
  department: string;
  attendance_rate: number;
  punctuality_score: number;
  task_completion_rate: number;
  performance_score: number;
  revenue_contribution: number;
  present_days: number;
  late_days: number;
  total_tasks: number;
  completed_tasks: number;
  period_days: number;
}

interface Summary {
  total_staff: number;
  average_attendance: number;
  average_punctuality: number;
  average_task_completion: number;
  average_performance: number;
  total_revenue_contribution: number;
  top_performers: StaffPerformance[];
  needs_improvement: number;
}

export default function StaffPerformancePage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [performance, setPerformance] = useState<StaffPerformance[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchPerformance = useCallback(async () => {
    if (!currentBranchId) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        branch_id: currentBranchId.toString(),
        period: period.toString(),
        ...(departmentFilter !== 'all' && { department: departmentFilter })
      });

      const response = await fetchAPI<any>(`/staff/performance?${params}`);

      if (response.success && response.data) {
        setPerformance(response.data.performance || []);
        setSummary(response.data.summary || null);
      }
    } catch (error: any) {
      console.error('Error fetching performance:', error);
      toast.error(error.message || 'Failed to load performance data');
    } finally {
      setIsLoading(false);
    }
  }, [currentBranchId, period, departmentFilter]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  const filteredPerformance = performance.filter(p =>
    p.staff_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-rose-600';
  };

  const getPerformanceBadge = (score: number) => {
    if (score >= 80) return { label: 'Excellent', className: 'bg-emerald-100 text-emerald-700' };
    if (score >= 60) return { label: 'Good', className: 'bg-amber-100 text-amber-700' };
    return { label: 'Needs Improvement', className: 'bg-rose-100 text-rose-700' };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard/branch-manager" className="text-stone-400 hover:text-stone-900 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-[12px] font-bold text-stone-400 uppercase tracking-widest">
              Branch Manager / Staff Performance
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Staff Performance</h1>
              <p className="text-stone-500 mt-0.5">{activeBranch?.name || user?.branch_name || 'Your Branch'}</p>
            </div>
            <div className="flex gap-2">
              <select
                value={period}
                onChange={(e) => setPeriod(parseInt(e.target.value))}
                className="px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
              </select>
              <button
                onClick={fetchPerformance}
                disabled={isLoading}
                className="btn-secondary"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="stat-card">
                <div className="stat-icon bg-blue-50 text-blue-600">
                  <Users className="h-5 w-5" />
                </div>
                <p className="stat-value text-[22px]">{summary.total_staff}</p>
                <p className="stat-label text-[12px] mt-1">Total Staff</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon bg-emerald-50 text-emerald-600">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <p className="stat-value text-[22px]">{summary.average_attendance.toFixed(1)}%</p>
                <p className="stat-label text-[12px] mt-1">Avg Attendance</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon bg-purple-50 text-purple-600">
                  <Clock className="h-5 w-5" />
                </div>
                <p className="stat-value text-[22px]">{summary.average_punctuality.toFixed(1)}%</p>
                <p className="stat-label text-[12px] mt-1">Avg Punctuality</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon bg-amber-50 text-amber-600">
                  <Target className="h-5 w-5" />
                </div>
                <p className="stat-value text-[22px]">{summary.average_task_completion.toFixed(1)}%</p>
                <p className="stat-label text-[12px] mt-1">Task Completion</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon bg-rose-50 text-rose-600">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <p className="stat-value text-[22px]">{summary.needs_improvement}</p>
                <p className="stat-label text-[12px] mt-1">Need Improvement</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon bg-stone-50 text-stone-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <p className="stat-value text-[18px]">{summary.average_performance.toFixed(1)}%</p>
                <p className="stat-label text-[12px] mt-1">Avg Performance</p>
              </div>
            </div>
          )}

          {/* Top Performers */}
          {summary && summary.top_performers.length > 0 && (
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-semibold text-stone-900 flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500" />
                  Top Performers
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {summary.top_performers.map((performer, index) => (
                  <div key={performer.staff_id} className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm">
                        #{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-stone-900 truncate">{performer.staff_name}</p>
                        <p className="text-[10px] text-stone-500 uppercase">{performer.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-[10px] text-stone-500 uppercase">Score</span>
                      <span className="text-[18px] font-bold text-amber-600">{performer.performance_score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search staff by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none"
            />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-4 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none"
            >
              <option value="all">All Departments</option>
              <option value="front_desk">Front Desk</option>
              <option value="housekeeping">Housekeeping</option>
              <option value="restaurant">Restaurant</option>
              <option value="bar">Bar</option>
              <option value="kitchen">Kitchen</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          {/* Performance Table */}
          <div className="card-elevated p-0 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-2 opacity-50">
                  <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-stone-400">Loading performance...</span>
                </div>
              </div>
            ) : filteredPerformance.length === 0 ? (
              <div className="text-center py-20 px-6">
                <div className="h-16 w-16 rounded-full bg-stone-50 flex items-center justify-center mb-4 mx-auto">
                  <Users className="h-8 w-8 text-stone-300" />
                </div>
                <h3 className="text-lg font-bold text-stone-900">No Staff Found</h3>
                <p className="text-sm text-stone-500 mt-1">No staff members match your search criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="table-header-cell">Staff Member</th>
                      <th className="table-header-cell text-center">Attendance</th>
                      <th className="table-header-cell text-center">Punctuality</th>
                      <th className="table-header-cell text-center">Task Completion</th>
                      <th className="table-header-cell text-center">Performance Score</th>
                      <th className="table-header-cell text-right">Revenue</th>
                      <th className="table-header-cell text-center">Status</th>
                      <th className="table-header-cell text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {filteredPerformance.map((staff) => {
                      const badge = getPerformanceBadge(staff.performance_score);
                      return (
                        <tr key={staff.staff_id} className="table-row">
                          <td className="table-cell">
                            <div>
                              <p className="text-[13px] font-medium text-stone-800">{staff.staff_name}</p>
                              <p className="text-[11px] text-stone-500">{staff.role} • {staff.department}</p>
                            </div>
                          </td>
                          <td className="table-cell text-center">
                            <div className="flex flex-col items-center">
                              <p className={`text-[14px] font-bold ${getPerformanceColor(staff.attendance_rate)}`}>
                                {staff.attendance_rate.toFixed(1)}%
                              </p>
                              <p className="text-[10px] text-stone-400">
                                {staff.present_days}/{staff.period_days} days
                              </p>
                            </div>
                          </td>
                          <td className="table-cell text-center">
                            <div className="flex flex-col items-center">
                              <p className={`text-[14px] font-bold ${getPerformanceColor(staff.punctuality_score)}`}>
                                {staff.punctuality_score.toFixed(1)}%
                              </p>
                              <p className="text-[10px] text-stone-400">
                                {staff.late_days} late
                              </p>
                            </div>
                          </td>
                          <td className="table-cell text-center">
                            <div className="flex flex-col items-center">
                              <p className={`text-[14px] font-bold ${getPerformanceColor(staff.task_completion_rate)}`}>
                                {staff.task_completion_rate.toFixed(1)}%
                              </p>
                              <p className="text-[10px] text-stone-400">
                                {staff.completed_tasks}/{staff.total_tasks} tasks
                              </p>
                            </div>
                          </td>
                          <td className="table-cell text-center">
                            <p className={`text-[16px] font-bold ${getPerformanceColor(staff.performance_score)}`}>
                              {staff.performance_score.toFixed(1)}%
                            </p>
                          </td>
                          <td className="table-cell text-right">
                            {staff.revenue_contribution > 0 ? (
                              <p className="text-[13px] font-medium text-stone-800">
                                {formatCurrency(staff.revenue_contribution)}
                              </p>
                            ) : (
                              <p className="text-[11px] text-stone-400">N/A</p>
                            )}
                          </td>
                          <td className="table-cell text-center">
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="table-cell text-right">
                            <Link href={`/dashboard/branch-manager/staff/${staff.staff_id}`}>
                              <button className="p-1.5 rounded-md hover:bg-stone-100 transition-colors">
                                <Eye className="h-4 w-4 text-stone-500" />
                              </button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
