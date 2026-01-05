'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI, staffAPI } from '@/lib/api';
import { BranchSelector } from '@/components/ui/branch-selector';
import {
  Building2, DollarSign, Users, Bed, TrendingUp, RefreshCw,
  BarChart3, Calendar, ArrowUpRight, ArrowDownRight, ChevronRight,
  AlertCircle, CheckCircle, Clock, Activity, Target, Zap
} from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  occupancyRate: number;
  totalStaff: number;
  pendingLeave: number;
  branches: number;
}

export default function GMDashboard() {
  const { user } = useAuth();
  const { userBranches } = useBranch();
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [stats, setStats] = useState<DashboardStats>({ occupancyRate: 0, totalStaff: 0, pendingLeave: 0, branches: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [branchPerformance, setBranchPerformance] = useState<{ name: string; revenue: number; occupancy: number; target: number }[]>([]);
  const [pendingActions, setPendingActions] = useState<{ id: number; type: string; title: string; time: string; urgent: boolean }[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const branchId = selectedBranchId || undefined;
      const [financeRes, staffRes, leaveRes] = await Promise.allSettled([
        financeAPI.getDashboard(branchId),
        staffAPI.getStaff(branchId),
        staffAPI.getLeaveRequests({ status: 'pending', branch_id: branchId }),
      ]);

      setStats({
        occupancyRate: 0,
        totalStaff: staffRes.status === 'fulfilled' ? staffRes.value?.data?.length || 0 : 0,
        pendingLeave: leaveRes.status === 'fulfilled' ? leaveRes.value?.data?.length || 0 : 0,
        branches: userBranches.length || 0,
      });
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [selectedBranchId, userBranches.length]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const quickLinks = [
    { href: '/dashboard/gm/branches', icon: Building2, label: 'Branches', desc: 'All locations' },
    { href: '/dashboard/gm/finance', icon: DollarSign, label: 'Finance', desc: 'Overview' },
    { href: '/dashboard/gm/staff', icon: Users, label: 'Staff', desc: 'All employees' },
    { href: '/dashboard/gm/reports', icon: BarChart3, label: 'Reports', desc: 'Analytics' },
    { href: '/dashboard/gm/leave-requests', icon: Calendar, label: 'Leave', desc: 'Requests' },
    { href: '/dashboard/gm/compare', icon: TrendingUp, label: 'Compare', desc: 'Branches' },
  ];

  const statCards = [
    { label: 'Occupancy', value: `${stats.occupancyRate}%`, icon: Bed },
    { label: 'Branches', value: stats.branches.toString(), icon: Building2 },
    { label: 'Staff', value: stats.totalStaff.toString(), icon: Users },
    { label: 'Leave Requests', value: stats.pendingLeave.toString(), icon: Calendar },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">General Manager</h1>
              <p className="text-stone-500 mt-0.5">
                {selectedBranchId ? userBranches.find(b => b.id === selectedBranchId)?.name : 'Overview of all operations'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <BranchSelector
                size="sm"
                showAllOption={true}
                allOptionLabel="All Branches"
                value={selectedBranchId}
                onChange={setSelectedBranchId}
              />
              <button onClick={fetchData} disabled={isLoading} className="btn-secondary">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
            {statCards.map((stat, i) => (
              <div key={i} className="stat-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="stat-icon">
                    <stat.icon className="h-5 w-5" />
                  </div>
                  {stat.trend !== undefined && (
                    <span className="flex items-center text-[11px] font-medium text-stone-500">
                      {stat.trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(stat.trend)}%
                    </span>
                  )}
                </div>
                <p className="stat-label">{stat.label}</p>
                <p className="stat-value text-[20px]">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Quick Access */}
          <div className="card-elevated p-5">
            <div className="section-header mb-4">
              <h2 className="section-title">Quick Access</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <div className="action-card group">
                    <div className="action-card-icon">
                      <link.icon className="h-5 w-5" />
                    </div>
                    <p className="action-card-label">{link.label}</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">{link.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Branch Performance & Pending Actions */}
          <div className="grid lg:grid-cols-3 gap-5">
            {/* Branch Performance */}
            <div className="lg:col-span-2 card-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-semibold text-stone-900">Branch Performance</h3>
                <Link href="/dashboard/gm/compare">
                  <button className="text-[13px] font-medium text-stone-600 hover:text-stone-900">Compare All</button>
                </Link>
              </div>
              <div className="space-y-3">
                {branchPerformance.map((branch, i) => (
                  <div key={i} className="p-4 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-stone-200 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-stone-600" />
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-stone-800">{branch.name}</p>
                          <p className="text-[11px] text-stone-500">Performance Overview</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-semibold text-stone-900">{branch.occupancy}%</p>
                        <p className="text-[10px] text-stone-500">Occupancy</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-stone-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${branch.occupancy >= branch.target ? 'bg-emerald-500' :
                              branch.occupancy >= branch.target * 0.8 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                          style={{ width: `${Math.min(branch.occupancy, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-stone-500 w-16 text-right">Target: {branch.target}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending Actions */}
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-semibold text-stone-900">Pending Actions</h3>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {pendingActions.length} pending
                </span>
              </div>
              <div className="space-y-2">
                {pendingActions.map((action) => (
                  <div key={action.id} className="p-3 rounded-lg bg-stone-50 hover:bg-stone-100 transition-colors cursor-pointer group">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${action.urgent ? 'bg-red-100' : 'bg-stone-200'
                        }`}>
                        {action.type === 'leave' && <Calendar className={`h-4 w-4 ${action.urgent ? 'text-red-600' : 'text-stone-600'}`} />}
                        {action.type === 'approval' && <CheckCircle className={`h-4 w-4 ${action.urgent ? 'text-red-600' : 'text-stone-600'}`} />}
                        {action.type === 'review' && <BarChart3 className={`h-4 w-4 ${action.urgent ? 'text-red-600' : 'text-stone-600'}`} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-stone-800 truncate">{action.title}</p>
                        <p className="text-[10px] text-stone-400 mt-0.5">{action.time}</p>
                      </div>
                      {action.urgent && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-600">Urgent</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/dashboard/gm/approvals">
                <button className="w-full mt-4 py-2 text-[12px] font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors">
                  View All Pending Actions
                </button>
              </Link>
            </div>
          </div>

          {/* Management Links */}
          <div className="card-elevated p-5">
            <h3 className="text-[15px] font-semibold text-stone-900 mb-4">Management</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { href: '/dashboard/gm/reservations', icon: Calendar, label: 'Reservations', desc: 'All bookings' },
                { href: '/dashboard/gm/staff', icon: Users, label: 'Staff Overview', desc: 'Employee management' },
                { href: '/dashboard/gm/reports', icon: BarChart3, label: 'Reports', desc: 'Analytics & insights' },
                { href: '/dashboard/gm/settings', icon: Target, label: 'Targets', desc: 'Set branch goals' },
              ].map((item) => (
                <Link key={item.href} href={item.href}>
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-stone-50 transition-colors group cursor-pointer">
                    <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center group-hover:bg-stone-200 transition-colors">
                      <item.icon className="h-4 w-4 text-stone-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-medium text-stone-800">{item.label}</p>
                      <p className="text-[11px] text-stone-500">{item.desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-400 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
