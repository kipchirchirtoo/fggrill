'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useBranch } from '../../hooks/useBranch';
import { financeAPI, staffAPI } from '../../services/api/api';
import {
  Building2, DollarSign, Users, Bed, TrendingUp, RefreshCw,
  BarChart3, Calendar, ArrowUpRight, ArrowDownRight, ChevronRight,
  AlertCircle, CheckCircle, Clock, Activity, Target, Zap
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { motion } from 'framer-motion';

interface DashboardStats {
  occupancyRate: number;
  totalStaff: number;
  pendingLeave: number;
  branches: number;
}

export function GMDashboard() {
  const { session } = useAuth();
  const { activeBranchId, activeBranch, userBranches } = useBranch();
  const [stats, setStats] = useState<DashboardStats>({ occupancyRate: 0, totalStaff: 0, pendingLeave: 0, branches: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [branchPerformance, setBranchPerformance] = useState<any[]>([]);
  const [pendingActions, setPendingActions] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const branchId = Number(activeBranchId) || undefined;
      const [financeRes, staffRes, leaveRes] = await Promise.allSettled([
        financeAPI.getDashboard(branchId),
        staffAPI.getStaff(branchId),
        staffAPI.getLeaveRequests({ status: 'pending', branch_id: branchId }),
      ]);

      setStats({
        occupancyRate: 0, // Mocked for now to match frontend placeholder
        totalStaff: staffRes.status === 'fulfilled' ? (staffRes.value as any).data?.length || 0 : 0,
        pendingLeave: leaveRes.status === 'fulfilled' ? (leaveRes.value as any).data?.length || 0 : 0,
        branches: userBranches.length || 0,
      });
    } catch (error) { 
      console.error('Error fetching GM dashboard data:', error); 
    } finally { 
      setIsLoading(false); 
    }
  }, [activeBranchId, userBranches.length]);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  const quickLinks = [
    { label: 'Branches', desc: 'All locations', icon: Building2 },
    { label: 'Finance', desc: 'Overview', icon: DollarSign },
    { label: 'Staff', desc: 'All employees', icon: Users },
    { label: 'Reports', desc: 'Analytics', icon: BarChart3 },
    { label: 'Leave', desc: 'Requests', icon: Calendar }
  ];

  const statCards = [
    { label: 'Occupancy', value: `${stats.occupancyRate}%`, icon: Bed },
    { label: 'Branches', value: stats.branches.toString(), icon: Building2 },
    { label: 'Staff', value: stats.totalStaff.toString(), icon: Users },
    { label: 'Leave Requests', value: stats.pendingLeave.toString(), icon: Calendar },
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
              <h1 className="text-2xl font-black text-stone-900 tracking-tight">General Manager</h1>
              <p className="text-stone-500 text-sm font-medium">
                {activeBranch?.name || 'Group Operations Overview'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
          {statCards.map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm transition-transform hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-xl bg-stone-50">
                  <stat.icon className="h-5 w-5 text-stone-600" />
                </div>
              </div>
              <p className="text-3xl font-black text-stone-900 tracking-tighter">{stat.value}</p>
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Access */}
        <div className="bg-white border border-stone-200 rounded-[2.5rem] p-8 shadow-sm">
          <div className="mb-8">
            <h2 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em]">Priority Terminals</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {quickLinks.map((link, i) => (
              <div key={i} className="group cursor-pointer">
                <div className="aspect-square rounded-[2rem] bg-stone-50 border border-stone-100 flex flex-col items-center justify-center gap-3 group-hover:bg-stone-900 group-hover:border-stone-900 transition-all active:scale-95 shadow-sm">
                  <link.icon className="h-8 w-8 text-stone-600 group-hover:text-white transition-colors" />
                  <p className="text-xs font-black uppercase tracking-widest text-stone-900 group-hover:text-white transition-colors">{link.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Branch Performance Mockup */}
          <div className="lg:col-span-2 bg-white border border-stone-200 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em]">Group Performance</h2>
              <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Full Analytics</button>
            </div>
            <div className="space-y-6">
              {[
                  { name: 'Famous Gates Main', occupancy: 85, trend: '+12%' },
                  { name: 'Kyogong Annex', occupancy: 72, trend: '+5%' },
                  { name: 'Hills Residence', occupancy: 94, trend: '+8%' }
              ].map((branch, i) => (
                <div key={i} className="flex items-center gap-6 p-4 rounded-2xl bg-stone-50/50 border border-stone-100 hover:border-stone-200 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-white border border-stone-100 flex items-center justify-center shadow-sm">
                    <Building2 className="h-6 w-6 text-stone-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-stone-900">{branch.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                       <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                          <div className="h-full bg-stone-900 rounded-full" style={{ width: `${branch.occupancy}%` }} />
                       </div>
                       <span className="text-[10px] font-black text-stone-500">{branch.occupancy}%</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{branch.trend}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Actions Feed */}
          <div className="bg-white border border-stone-200 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em]">Action Queue</h2>
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            </div>
            <div className="space-y-6">
                {[
                  { title: 'Leave Approval: Waiter A', time: '10m ago', type: 'HR' },
                  { title: 'Budget Review: Branch X', time: '1h ago', type: 'FINANCE' },
                  { title: 'New Staff Check: Kyogong', time: '3h ago', type: 'HR' }
                ].map((action, i) => (
                  <div key={i} className="group cursor-pointer">
                    <p className="text-sm font-bold text-stone-900 leading-tight group-hover:underline">{action.title}</p>
                    <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest mt-1">
                      {action.type} • {action.time}
                    </p>
                  </div>
                ))}
            </div>
            <button className="w-full h-12 mt-12 bg-stone-900 text-white rounded-2xl text-[10px] font-black tracking-[0.2em] uppercase hover:bg-black transition-all active:scale-95 shadow-lg shadow-stone-200">
              Clear All Actions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
