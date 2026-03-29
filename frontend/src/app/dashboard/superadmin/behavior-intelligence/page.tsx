'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Brain, ShieldCheck, RefreshCw, AlertTriangle, 
  Activity, ActivitySquare, Zap, Target,
  Globe, User, ArrowRight, TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { adminAiAPI, AnomalyEvent } from '@/lib/api/admin-ai';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UserRole } from '@/lib/auth-context';

export default function BehaviorIntelligencePage() {
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);

  const fetchAnomalies = async () => {
    setLoading(true);
    try {
      const res = await adminAiAPI.getAnomalies({ limit: 100 });
      if (res.success && res.anomalies) {
        setAnomalies(res.anomalies);
      }
    } catch (err) {
      toast.error('Failed to retrieve AI anomalies');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, []);

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const res = await adminAiAPI.retrainProfiles();
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error((res as any).message || 'Failed to retrain models.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error occurred during retraining');
    } finally {
      setRetraining(false);
    }
  };

  // Build chart data dynamically from event timestamps
  const chartData = useMemo(() => {
    if (!anomalies.length) return [];
    
    // Group anomalies by day
    const grouped = anomalies.reduce((acc: Record<string, number>, curr) => {
        const d = format(new Date(curr.detected_at), 'MMM dd');
        acc[d] = (acc[d] || 0) + 1;
        return acc;
    }, {});
    
    // Convert to sorted array
    return Object.entries(grouped)
        .sort((a, b) => new Date(a[0] + ' ' + new Date().getFullYear()).getTime() - new Date(b[0] + ' ' + new Date().getFullYear()).getTime())
        .map(([time, count]) => ({ time, count }));
  }, [anomalies]);

  const stats = useMemo(() => {
    const critical = anomalies.filter(x => x.severity === 'CRITICAL').length;
    const high = anomalies.filter(x => x.severity === 'HIGH').length;
    const avgScore = anomalies.length > 0 ? (anomalies.reduce((acc, curr) => acc + curr.score, 0) / anomalies.length).toFixed(1) : 0;
    
    return { critical, high, avgScore };
  }, [anomalies]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER as any]}>
      <DashboardLayout>
        <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">

          {/* Hero Header */}
          <div className="relative p-12 bg-gradient-to-r from-indigo-950 via-stone-900 to-stone-950 overflow-hidden rounded-[40px] shadow-2xl shadow-indigo-900/20">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.05]" />
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-500/20 to-transparent blur-3xl" />
            
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-400 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em]">
                        <Brain className="h-3 w-3 animate-pulse" /> Neural Core Active
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter leading-none">
                        Behavioral <span className="text-indigo-400">Intelligence</span>
                    </h1>
                    <p className="text-stone-400 max-w-xl text-lg font-medium">
                        Machine learning powered surveillance tracking user baseline drift, anomalous transactions, and potential insider threats in real time.
                    </p>
                    <div className="flex items-center gap-4 pt-4">
                        <button 
                            onClick={fetchAnomalies}
                            disabled={loading}
                            className="px-6 py-3 bg-white text-indigo-950 rounded-2xl font-bold hover:bg-stone-100 transition-all flex items-center gap-2 shadow-xl shadow-white/5 active:scale-95 disabled:opacity-50"
                        >
                            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                            Sync Core Analytics
                        </button>
                        <button 
                            onClick={handleRetrain}
                            disabled={retraining}
                            className="px-6 py-3 bg-white/5 text-white border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            <Activity className={cn("h-4 w-4", retraining && "animate-pulse")} />
                            {retraining ? 'Recomputing Baselines...' : 'Retrain Global Baselines'}
                        </button>
                    </div>
                </div>

                <div className="w-full lg:w-auto flex flex-col gap-6">
                    <div className="flex gap-4">
                        <div className="p-6 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 text-center min-w-[140px]">
                            <p className="text-4xl font-black text-white tracking-tighter">{stats.critical}</p>
                            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mt-1">Critical Anomalies</p>
                        </div>
                        <div className="p-6 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 text-center min-w-[140px]">
                            <p className="text-4xl font-black text-white tracking-tighter">{stats.avgScore}</p>
                            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Avg Global Z-Score</p>
                        </div>
                    </div>
                </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            {/* Left Column: Ticker & Chart */}
            <div className="xl:col-span-3 space-y-8">
                {/* Trend Chart */}
                <motion.div 
                   initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                   className="bg-white dark:bg-stone-900 p-8 rounded-[32px] border border-stone-200/60 dark:border-white/5 shadow-sm"
                >
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-stone-900 dark:text-white tracking-tight">Anomaly Detection Frequency</h3>
                            <p className="text-sm text-stone-500 font-medium italic">Spikes indicate coordinated behavioral deviations or data pollution.</p>
                        </div>
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
                            <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                    </div>
                    
                    <div className="h-[250px] w-full">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorAnomalies" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                                    <XAxis 
                                        dataKey="time" 
                                        axisLine={false} tickLine={false} 
                                        tick={{fontSize: 10, fill: '#888'}} 
                                    />
                                    <YAxis hide />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}
                                    />
                                    <Area 
                                        type="monotone" dataKey="count" 
                                        stroke="#6366f1" strokeWidth={4} 
                                        fillOpacity={1} fill="url(#colorAnomalies)" 
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-stone-400 font-medium gap-3">
                                <Target className="h-10 w-10 text-stone-300 dark:text-stone-700" />
                                No established trend lines. Awaiting intelligence gathering.
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Main Log Registry */}
                <div className="bg-white dark:bg-stone-900 rounded-[32px] border border-stone-200/60 dark:border-white/5 shadow-2xl overflow-hidden flex flex-col min-h-[500px]">
                    <div className="p-8 border-b border-stone-100 dark:border-white/5 space-y-6">
                        <h3 className="text-xl font-black text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
                             <Target className="h-6 w-6 text-indigo-500" /> Anomaly Event Index
                        </h3>
                    </div>

                    {/* Registry View */}
                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left border-collapse table-auto min-w-[800px]">
                            <thead>
                            <tr className="bg-stone-50/50 dark:bg-white/5 border-b border-stone-100 dark:border-white/5">
                                <th className="px-8 py-5 text-[11px] font-black text-stone-400 uppercase tracking-widest">Temporal Marker</th>
                                <th className="px-8 py-5 text-[11px] font-black text-stone-400 uppercase tracking-widest">Entity</th>
                                <th className="px-8 py-5 text-[11px] font-black text-stone-400 uppercase tracking-widest">Classification</th>
                                <th className="px-8 py-5 text-[11px] font-black text-stone-400 uppercase tracking-widest text-center">Threat Rating</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-white/5">
                            {loading && anomalies.length === 0 ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td className="px-8 py-6"><div className="h-4 bg-stone-100 dark:bg-white/5 rounded w-32" /></td>
                                    <td className="px-8 py-6"><div className="h-10 w-10 bg-stone-100 dark:bg-white/5 rounded-full" /></td>
                                    <td className="px-8 py-6"><div className="h-4 bg-stone-100 dark:bg-white/5 rounded w-64" /></td>
                                    <td className="px-8 py-6"><div className="h-8 bg-stone-100 dark:bg-white/5 rounded-full w-24 mx-auto" /></td>
                                </tr>
                                ))
                            ) : anomalies.length > 0 ? (
                                anomalies.map((event) => (
                                <tr 
                                    key={event.id} 
                                    className="hover:bg-indigo-50/30 dark:hover:bg-white/5 transition-all group border-l-4 border-transparent hover:border-indigo-500"
                                >
                                    <td className="px-8 py-6 whitespace-nowrap">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-stone-100 dark:bg-white/10 rounded-2xl text-stone-500 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-sm">
                                                <Zap className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-stone-900 dark:text-white">
                                                    {format(new Date(event.detected_at), 'HH:mm:ss')}
                                                </p>
                                                <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                                                    {format(new Date(event.detected_at), 'MMM dd, yyyy')}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200 dark:from-stone-800 dark:to-stone-900 border border-stone-200 dark:border-white/10 flex items-center justify-center">
                                                <User className="h-5 w-5 text-stone-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-stone-900 dark:text-white truncate">
                                                    {event.user ? `${event.user.first_name} ${event.user.last_name}` : 'Unknown Entity'}
                                                </p>
                                                <p className="text-[10px] text-stone-500 font-mono font-bold tracking-tight">ID: {event.user_id}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="max-w-md">
                                            <p className="text-sm font-bold text-stone-900 dark:text-white leading-tight">
                                                {event.description}
                                            </p>
                                            <div className="mt-1">
                                                <span className="text-[10px] text-indigo-400 font-mono uppercase font-bold bg-indigo-50 dark:bg-white/5 px-2 py-0.5 rounded border border-indigo-100 dark:border-white/5">
                                                    MODEL: {event.type}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border transition-all",
                                            event.severity === 'CRITICAL' ? "bg-rose-500/10 text-rose-600 border-rose-500/20 shadow-lg shadow-rose-500/10" : 
                                            event.severity === 'HIGH' ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                                            "bg-indigo-50 text-indigo-600 border-indigo-200"
                                        )}>
                                            {event.severity} <span className="opacity-50">/ Z:{event.score.toFixed(1)}</span>
                                        </span>
                                    </td>
                                </tr>
                                ))
                            ) : (
                                <tr>
                                <td colSpan={4} className="px-8 py-32 text-center">
                                    <ActivitySquare className="h-16 w-16 text-stone-200 mx-auto mb-4 animate-pulse" />
                                    <h3 className="text-2xl font-black text-stone-900 dark:text-white mt-4">Baseline Stable</h3>
                                    <p className="text-stone-500 font-medium max-w-sm mx-auto mt-2">The behavior intelligence model has not detected any deviations from configured baselines.</p>
                                </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Right Column: Insights */}
            <div className="space-y-8">
                <div className="p-8 bg-indigo-950 rounded-[32px] border border-indigo-900 shadow-xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-20" />
                    <div className="absolute -inset-10 bg-gradient-to-b from-indigo-500/20 to-transparent blur-2xl" />
                    <div className="relative z-10 space-y-4 text-center">
                        <Brain className="h-10 w-10 text-indigo-400 mx-auto" />
                        <h4 className="text-lg font-black text-white uppercase tracking-tighter">Model Status Guide</h4>
                        <p className="text-xs text-indigo-200 leading-relaxed font-medium">
                            Baselines are calculated independently for each worker identity based on the prior 30 days of logged access and financial transactions.
                        </p>
                        <div className="pt-4 flex justify-center pb-2">
                             <div className="px-3 py-1 bg-white/10 rounded-full border border-white/20 text-[10px] font-black uppercase tracking-widest text-white shadow-inner">
                                Confidence Level: 92%
                             </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-white dark:bg-stone-900 rounded-[32px] border border-stone-200/60 dark:border-white/5 space-y-6">
                    <h4 className="text-sm font-black text-stone-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                        <Globe className="h-4 w-4 opacity-50" /> System Integration
                    </h4>
                    <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-white/5 border border-stone-100 dark:border-white/5 space-y-2">
                            <h5 className="text-xs font-bold uppercase text-stone-600 dark:text-stone-400">Time-Series Drift Detection</h5>
                            <p className="text-[11px] font-medium text-stone-500">Monitor unusual hours of access or unexpected rapid sequences of events using Z-scores tracking operational divergence.</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-white/5 border border-stone-100 dark:border-white/5 space-y-2">
                             <h5 className="text-xs font-bold uppercase text-stone-600 dark:text-stone-400">Financial Action Modeling</h5>
                             <p className="text-[11px] font-medium text-stone-500">Volumetric threshold limits on individual transactions algorithmically enforced based on personal baseline historical averages.</p>
                        </div>
                        <button className="w-full flex items-center justify-between p-4 rounded-2xl bg-stone-900 hover:bg-stone-800 transition-colors group">
                            <span className="text-xs font-bold text-white">Manual Model Adjust</span>
                            <ArrowRight className="h-4 w-4 text-white group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
