'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI, staffAPI, systemAPI } from '@/lib/api';
import { 
  DollarSign, Users, Building2, Bed, RefreshCw,
  UserCog, Package, FileText, Wrench, Utensils, ClipboardList, Settings,
  TrendingUp, ArrowUpRight, ChevronRight
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ revenue: 0, staff: 0, branches: 0, rooms: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [financeRes, staffRes, branchesRes] = await Promise.all([
        financeAPI.getDashboard(),
        staffAPI.getStaff(),
        systemAPI.getBranches(),
      ]);
      setStats({
        revenue: financeRes.data?.totalRevenue || 0,
        staff: staffRes.data?.length || 0,
        branches: branchesRes.data?.length || 0,
        rooms: 0,
      });
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const quickLinks = [
    { href: '/dashboard/admin/users', icon: UserCog, label: 'Users', description: 'Manage accounts' },
    { href: '/dashboard/admin/staff', icon: Users, label: 'Staff', description: 'Team management' },
    { href: '/dashboard/admin/finance', icon: DollarSign, label: 'Finance', description: 'Financial overview' },
    { href: '/dashboard/admin/rooms', icon: Bed, label: 'Rooms', description: 'Room inventory' },
    { href: '/dashboard/admin/storekeeping', icon: Package, label: 'Inventory', description: 'Stock control' },
    { href: '/dashboard/admin/restaurant', icon: Utensils, label: 'Restaurant', description: 'F&B operations' },
    { href: '/dashboard/admin/housekeeping', icon: ClipboardList, label: 'Housekeeping', description: 'Task management' },
    { href: '/dashboard/admin/maintenance', icon: Wrench, label: 'Maintenance', description: 'Facility upkeep' },
    { href: '/dashboard/admin/reports', icon: FileText, label: 'Reports', description: 'Analytics & data' },
    { href: '/dashboard/admin/settings', icon: Settings, label: 'Settings', description: 'System config' },
  ];

  const statCards = [
    { label: 'Total Revenue', value: stats.revenue > 0 ? `KES ${(stats.revenue / 1000000).toFixed(1)}M` : 'KES 0', icon: DollarSign },
    { label: 'Total Staff', value: stats.staff.toString(), icon: Users },
    { label: 'Branches', value: stats.branches.toString(), icon: Building2 },
    { label: 'Total Rooms', value: stats.rooms.toString(), icon: Bed },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Admin Dashboard</h1>
              <p className="text-stone-500 mt-0.5">System administration and overview</p>
            </div>
            <button 
              onClick={fetchData}
              disabled={isLoading}
              className="btn-secondary self-start sm:self-auto"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat, i) => (
              <div key={i} className="stat-card">
                <div className="stat-icon">
                  <stat.icon className="h-5 w-5" />
                </div>
                <p className="stat-value">{stat.value}</p>
                <p className="stat-label mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Quick Access */}
          <div className="card-elevated p-6">
            <div className="section-header">
              <div>
                <h2 className="section-title">Quick Access</h2>
                <p className="section-subtitle">Navigate to key modules</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <div className="action-card group">
                    <div className="action-card-icon">
                      <link.icon className="h-5 w-5" />
                    </div>
                    <p className="action-card-label">{link.label}</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">{link.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Bottom Grid */}
          <div className="grid lg:grid-cols-2 gap-5">
            {/* System Links */}
            <div className="card-elevated p-5">
              <h3 className="text-[15px] font-semibold text-stone-900 mb-4">System Management</h3>
              <div className="space-y-2">
                {[
                  { href: '/dashboard/admin/system/branches', icon: Building2, label: 'Branches', desc: 'Manage locations' },
                  { href: '/dashboard/admin/system/departments', icon: Users, label: 'Departments', desc: 'Organizational structure' },
                  { href: '/dashboard/admin/audit', icon: ClipboardList, label: 'Audit Logs', desc: 'Activity tracking' },
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

            {/* Quick Stats */}
            <div className="card-elevated p-5">
              <h3 className="text-[15px] font-semibold text-stone-900 mb-4">System Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                  <span className="text-[13px] text-stone-600">Active Users</span>
                  <span className="text-[14px] font-semibold text-stone-900">{stats.staff}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                  <span className="text-[13px] text-stone-600">Active Branches</span>
                  <span className="text-[14px] font-semibold text-stone-900">{stats.branches}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                  <span className="text-[13px] text-stone-600">System Status</span>
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-700">
                    <span className="w-2 h-2 rounded-full bg-stone-400" />
                    Online
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
