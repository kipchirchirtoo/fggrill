'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { staffAPI, systemAPI, procurementAPI } from '../../services/api/api';
import {
  DollarSign, Users, Building2, Bed, RefreshCw,
  UserCog, Package, FileText, Wrench, Utensils, ClipboardList, Settings,
  TrendingUp, ArrowUpRight, ChevronRight, Truck, Car, ShieldCheck, Activity, Landmark,
  Briefcase, Zap
} from 'lucide-react';
import { cn } from '../../utils/cn';

export function AdminDashboard() {
  const { session } = useAuth();
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
      const [staffRes, branchesRes, departmentsRes, suppliersRes] = await Promise.allSettled([
        staffAPI.getStaff(),
        systemAPI.getBranches(),
        systemAPI.getDepartments(),
        procurementAPI.getSuppliers(),
      ]);

      setStats({
        staff: staffRes.status === 'fulfilled' ? (staffRes.value as any).data?.length || 0 : 0,
        branches: branchesRes.status === 'fulfilled' ? (branchesRes.value as any).data?.length || 0 : 0,
        departments: departmentsRes.status === 'fulfilled' ? (departmentsRes.value as any).data?.length || 0 : 0,
        suppliers: suppliersRes.status === 'fulfilled' ? (suppliersRes.value as any).data?.length || 0 : 0
      });
    } catch (error) { 
      console.error('Error fetching admin dashboard data:', error); 
    } finally { 
      setIsLoading(false); 
    }
  }, []);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  const overviewModules = [
    { label: 'Revenue Oversight', desc: 'Real-time revenue streams', icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Financial Verification', desc: 'Gateway reconciliation', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Sales Audit', desc: 'Confirm operational records', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' }
  ];

  const coreModules = [
    { label: 'Financials', desc: 'P&L and budgeting', icon: Landmark },
    { label: 'Accounts', desc: 'User roles & access', icon: UserCog },
    { label: 'HR/Staff', desc: 'Team & payroll', icon: Users },
    { label: 'Inventory', desc: 'Master stock control', icon: Package },
    { label: 'Analytics', desc: 'System-wide reports', icon: FileText },
    { label: 'Systems Docs', desc: 'Module Guides', icon: FileText }
  ];

  return (
    <div className="h-full bg-stone-50 overflow-y-auto no-scrollbar p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-stone-900 flex items-center justify-center text-white shadow-xl">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-stone-900 tracking-tight">Command Center</h1>
              <p className="text-stone-500 text-sm font-medium">Superadmin system oversight</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button className="h-11 px-6 rounded-xl bg-white border border-stone-200 font-bold text-sm flex items-center gap-2 hover:bg-stone-50 transition-all shadow-sm">
                <Settings className="h-4 w-4 text-stone-600" />
                <span>Settings</span>
             </button>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="h-11 px-6 rounded-xl bg-white border border-stone-200 font-bold text-sm flex items-center gap-2 hover:bg-stone-50 transition-all shadow-sm"
            >
              <RefreshCw className={cn("h-4 w-4 text-stone-600", isLoading && "animate-spin")} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Branches', value: stats.branches, icon: Building2, color: 'border-l-stone-900' },
            { label: 'Users', value: stats.staff, icon: Users, color: 'border-l-blue-500' },
            { label: 'Departments', value: stats.departments, icon: Briefcase, color: 'border-l-amber-500' },
            { label: 'Suppliers', value: stats.suppliers, icon: Truck, color: 'border-l-emerald-500' }
          ].map((stat, i) => (
            <div key={i} className={cn("bg-white p-6 rounded-3xl border border-stone-200 border-l-4 shadow-sm transition-transform hover:scale-[1.02]", stat.color)}>
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-xl bg-stone-50 text-stone-400">
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-stone-900 tracking-tighter">{stat.value}</p>
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Executive Oversight Section */}
        <div>
          <div className="flex items-center gap-2 mb-6 ml-2">
            <ShieldCheck className="h-4 w-4 text-amber-500" />
            <h2 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em]">Executive Oversight</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {overviewModules.map((module, i) => (
              <div key={i} className="group bg-white p-8 rounded-[2.5rem] border border-stone-200 hover:border-stone-900 transition-all cursor-pointer shadow-sm active:scale-95">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110", module.bg)}>
                  <module.icon className={cn("h-7 w-7", module.color)} />
                </div>
                <h3 className="text-lg font-black text-stone-900">{module.label}</h3>
                <p className="text-xs text-stone-400 font-medium mt-1 leading-relaxed">{module.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Core Modules Section */}
        <div className="bg-white border border-stone-200 rounded-[2.5rem] p-8 shadow-sm">
           <div className="mb-8 ml-2">
            <h2 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em]">System Core</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreModules.map((module, i) => (
              <div key={i} className="flex items-center gap-6 p-4 rounded-3xl bg-stone-50/50 border border-stone-100 hover:border-stone-200 group cursor-pointer transition-all">
                <div className="w-12 h-12 rounded-2xl bg-white border border-stone-100 flex items-center justify-center group-hover:bg-stone-900 group-hover:text-white transition-all shadow-sm">
                  <module.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-stone-900">{module.label}</p>
                  <p className="text-[10px] text-stone-400 font-medium">{module.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-900 transition-all" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
