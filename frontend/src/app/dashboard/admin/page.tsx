'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI, staffAPI, systemAPI, procurementAPI, storeAPI } from '@/lib/api';
import {
  DollarSign, Users, Building2, Bed, RefreshCw,
  UserCog, Package, FileText, Wrench, Utensils, ClipboardList, Settings,
  TrendingUp, ArrowUpRight, ChevronRight, Truck, Car, ShieldCheck, Activity, FileCheck, Landmark,
  Briefcase
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    staff: 0,
    branches: 0,
    departments: 0,
    suppliers: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [staffRes, branchesRes, departmentsRes, suppliersRes] = await Promise.all([
        staffAPI.getStaff(),
        systemAPI.getBranches(),
        systemAPI.getDepartments(),
        storeAPI.getSuppliers(),
      ]);
      setStats({
        staff: staffRes.data?.length || 0,
        branches: branchesRes.data?.length || 0,
        departments: departmentsRes.data?.length || 0,
        suppliers: suppliersRes.data?.length || 0
      });
    } catch (error) { console.error('Error fetching admin stats:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const overviewModules = [
    {
      href: '/dashboard/auditor/revenue-oversight',
      icon: TrendingUp,
      label: 'Revenue Oversight',
      desc: 'Real-time revenue streams & anomalies',
      color: 'text-amber-600',
      bg: 'bg-amber-50'
    },
    {
      href: '/dashboard/auditor/financial-verification',
      icon: ShieldCheck,
      label: 'Financial Verification',
      desc: 'Gateway reconciliation & variance',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50'
    },
    {
      href: '/dashboard/auditor/sales',
      icon: Activity,
      label: 'Sales Audit',
      desc: 'Confirm operational sales records',
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    }
  ];

  const coreModules = [
    { href: '/dashboard/admin/finance', icon: Landmark, label: 'Financials', desc: 'P&L and budgeting' },
    { href: '/dashboard/admin/users', icon: UserCog, label: 'Accounts', desc: 'User roles & access' },
    { href: '/dashboard/admin/staff', icon: Users, label: 'HR/Staff', desc: 'Team & payroll' },
    { href: '/dashboard/admin/storekeeping', icon: Package, label: 'Inventory', desc: 'Master stock control' },
    { href: '/dashboard/central-store/reports', icon: FileText, label: 'Analytics', desc: 'System-wide reports' },
    { href: '/dashboard/admin/docs', icon: FileText, label: 'Systems Docs', desc: 'Module Guides' }
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-8 animate-ios-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-bold text-stone-900 tracking-tight font-sf-pro-display">Command Center</h1>
              <p className="text-stone-500">Superadmin oversight and system control</p>
            </div>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="px-4 py-2 rounded-full bg-white border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-all flex items-center gap-2 shadow-sm active:scale-95"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Pulse</span>
            </button>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card border-l-4 border-l-stone-900">
              <div className="flex justify-between items-start">
                <div>
                  <p className="stat-label uppercase tracking-widest text-[10px]">Operational Branches</p>
                  <p className="stat-value text-2xl">{stats.branches}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-stone-400" />
                </div>
              </div>
            </div>
            <div className="stat-card border-l-4 border-l-blue-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="stat-label uppercase tracking-widest text-[10px]">System Users</p>
                  <p className="stat-value text-2xl">{stats.staff}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                  <Users className="h-4 w-4 text-blue-400" />
                </div>
              </div>
            </div>
            <div className="stat-card border-l-4 border-l-amber-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="stat-label uppercase tracking-widest text-[10px]">Active Departments</p>
                  <p className="stat-value text-2xl">{stats.departments}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
                  <Briefcase className="h-4 w-4 text-amber-400" />
                </div>
              </div>
            </div>
            <div className="stat-card border-l-4 border-l-emerald-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="stat-label uppercase tracking-widest text-[10px]">System Suppliers</p>
                  <p className="stat-value text-2xl">{stats.suppliers}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                  <Truck className="h-4 w-4 text-emerald-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Executive Oversight Section */}
          <div>
            <div className="flex items-center gap-2 mb-4 px-1">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              <h2 className="text-[17px] font-bold text-stone-900 font-sf-pro-display">Executive Oversight</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {overviewModules.map((module) => (
                <Link key={module.href} href={module.href}>
                  <div className="card-elevated-hover p-5 border border-stone-100 h-full group">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", module.bg)}>
                      <module.icon className={cn("h-6 w-6", module.color)} />
                    </div>
                    <h3 className="text-[15px] font-bold text-stone-900 mb-1">{module.label}</h3>
                    <p className="text-[13px] text-stone-500 leading-relaxed">{module.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Core Management Cards */}
            <div className="lg:col-span-2 space-y-6">
              <div className="card-elevated p-6">
                <h3 className="text-[15px] font-bold text-stone-900 mb-6 flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-stone-400" />
                  System Core Modules
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {coreModules.map((module) => (
                    <Link key={module.href} href={module.href}>
                      <div className="flex items-center gap-4 p-4 rounded-xl border border-stone-50 hover:bg-stone-50 hover:border-stone-200 transition-all group cursor-pointer h-full">
                        <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center group-hover:bg-white border border-transparent group-hover:border-stone-200 transition-all">
                          <module.icon className="h-5 w-5 text-stone-600" />
                        </div>
                        <div>
                          <p className="text-[14px] font-bold text-stone-900">{module.label}</p>
                          <p className="text-[12px] text-stone-500">{module.desc}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-stone-300 ml-auto group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Operations Quicklinks */}
              <div className="card-elevated p-6">
                <h3 className="text-[15px] font-bold text-stone-900 mb-6 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-stone-400" />
                  Operational Control
                </h3>
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: 'Restaurant Ops', href: '/dashboard/admin/restaurant' },
                    { label: 'Housekeeping', href: '/dashboard/admin/housekeeping' },
                    { label: 'Maintenance', href: '/dashboard/admin/maintenance' },
                    { label: 'Asset Register', href: '/dashboard/facilities/maintenance/assets' },
                    { label: 'Kitchen Controls', href: '/dashboard/kitchen-operations' },
                    { label: 'Daily Wastage', href: '/dashboard/admin/wastage' },
                  ].map((btn) => (
                    <Link key={btn.href} href={btn.href}>
                      <span className="px-4 py-2 rounded-lg bg-stone-50 text-stone-600 text-[13px] font-medium border border-stone-100 hover:bg-stone-100 transition-colors shadow-sm inline-block">
                        {btn.label}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar Column */}
            <div className="space-y-6">
              {/* System Utilities */}
              <div className="card-elevated border-l-4 border-l-stone-300 overflow-hidden shadow-soft-lg">
                <div className="p-5 bg-stone-50/50 border-b border-stone-100">
                  <h3 className="text-[14px] font-bold text-stone-900 uppercase tracking-tight">System Utilities</h3>
                </div>
                <div className="p-2 space-y-1">
                  {[
                    { href: '/dashboard/admin/system/branches', icon: Building2, label: 'Manage Branches' },
                    { href: '/dashboard/admin/system/departments', icon: Users, label: 'Internal Structure' },
                    { href: '/dashboard/admin/audit', icon: ClipboardList, label: 'Global Audit Logs' },
                    { href: '/dashboard/admin/settings', icon: Settings, label: 'System Configuration' },
                  ].map((item) => (
                    <Link key={item.href} href={item.href}>
                      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-stone-100 transition-all font-medium group cursor-pointer text-[13px] text-stone-600 hover:text-stone-900">
                        <item.icon className="h-4 w-4 group-hover:scale-110 transition-transform" />
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Logistics Tracking */}
              <div className="card-elevated p-5">
                <h3 className="text-[14px] font-bold text-stone-900 mb-4 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-stone-400" />
                  Logistics
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/dashboard/admin/vehicles" className="p-3 rounded-xl bg-stone-50 text-center hover:bg-stone-100 transition-colors">
                    <Car className="h-5 w-5 mx-auto mb-1 text-stone-600" />
                    <p className="text-[11px] font-bold text-stone-700">Fleet</p>
                  </Link>
                  <Link href="/dashboard/admin/suppliers" className="p-3 rounded-xl bg-stone-50 text-center hover:bg-stone-100 transition-colors">
                    <Landmark className="h-5 w-5 mx-auto mb-1 text-stone-600" />
                    <p className="text-[11px] font-bold text-stone-700">Suppliers</p>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
