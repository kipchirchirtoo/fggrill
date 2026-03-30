'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Brain, ShieldCheck, RefreshCw, AlertTriangle,
  Activity, ActivitySquare, Zap, Target,
  Globe, User, ArrowRight, TrendingUp, Sparkles,
  DollarSign, Shield, ClipboardList, Settings2
} from 'lucide-react';
import { format } from 'date-fns';
import { adminAiAPI, AnomalyEvent, GeminiAnalysis } from '@/lib/api/admin-ai';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UserRole } from '@/lib/auth-context';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  FINANCIAL: <DollarSign className="h-4 w-4" />,
  OPERATIONAL: <Settings2 className="h-4 w-4" />,
  SECURITY: <Shield className="h-4 w-4" />,
  COMPLIANCE: <ClipboardList className="h-4 w-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  FINANCIAL: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OPERATIONAL: 'bg-blue-50 text-blue-700 border-blue-200',
  SECURITY: 'bg-rose-50 text-rose-700 border-rose-200',
  COMPLIANCE: 'bg-amber-50 text-amber-700 border-amber-200',
};

const RISK_COLORS: Record<string, string> = {
  LOW: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  MEDIUM: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  HIGH: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  CRITICAL: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

export default function BehaviorIntelligencePage() {
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [gemini, setGemini] = useState<GeminiAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [retraining, setRetraining] = useState(false);

  const fetchAnomalies = async () => {
    setLoading(true);
    try {
      const res = await adminAiAPI.getAnomalies({ limit: 100 });
      if (res.success && res.anomalies) {
        setAnomalies(res.anomalies);
        setStats(res.stats);
      }
    } catch {
      toast.error('Failed to retrieve anomaly data');
    } finally {
      setLoading(false);
    }
  };

  const fetchInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await adminAiAPI.getInsights();
      if (res.success && res.data) {
        setGemini(res.data);
      }
    } catch {
      toast.error('Failed to generate AI insights');
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
    fetchInsights();
  }, []);

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const res = await adminAiAPI.retrainProfiles();
      if (res.success) toast.success(res.message);
    } catch {
      toast.error('Error occurred during retraining');
    } finally {
      setRetraining(false);
    }
  };

  const chartData = useMemo(() => {
    if (!anomalies.length) return [];
    const grouped = anomalies.reduce((acc: Record<string, number>, curr) => {
      const d = format(new Date(curr.detected_at), 'MMM dd');
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(grouped)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([time, count]) => ({ time, count }));
  }, [anomalies]);

  const summaryStats = useMemo(() => ({
    critical: anomalies.filter(x => x.severity === 'CRITICAL').length,
    high: anomalies.filter(x => x.severity === 'HIGH').length,
    avgScore: anomalies.length > 0
      ? (anomalies.reduce((acc, curr) => acc + curr.score, 0) / anomalies.length).toFixed(1)
      : '0.0',
  }), [anomalies]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="max-w-[1600px] mx-auto space-y-8">

          {/* Hero Header */}
          <div className="relative p-10 bg-gradient-to-r from-indigo-950 via-stone-900 to-stone-950 overflow-hidden rounded-[32px] shadow-2xl">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-500/20 to-transparent blur-3xl" />
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-400 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em]">
                  <Brain className="h-3 w-3 animate-pulse" /> Gemini AI Active
                </div>
                <h1 className="text-4xl font-black text-white tracking-tighter">
                  Behavioral <span className="text-indigo-400">Intelligence</span>
                </h1>
                <p className="text-stone-400 max-w-xl font-medium">
                  Real-time anomaly detection powered by Gemini AI — tracking shift discrepancies, void patterns, and audit exceptions.
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => { fetchAnomalies(); fetchInsights(); }}
                    disabled={loading}
                    className="px-5 py-2.5 bg-white text-indigo-950 rounded-xl font-bold hover:bg-stone-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                    Refresh
                  </button>
                  <button
                    onClick={fetchInsights}
                    disabled={loadingInsights}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <Sparkles className={cn('h-4 w-4', loadingInsights && 'animate-pulse')} />
                    {loadingInsights ? 'Analysing…' : 'Ask Gemini'}
                  </button>
                  <button
                    onClick={handleRetrain}
                    disabled={retraining}
                    className="px-5 py-2.5 bg-white/5 text-white border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <Activity className={cn('h-4 w-4', retraining && 'animate-pulse')} />
                    {retraining ? 'Refreshing…' : 'Retrain Baselines'}
                  </button>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="p-5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 text-center min-w-[120px]">
                  <p className="text-3xl font-black text-white">{summaryStats.critical}</p>
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mt-1">Critical</p>
                </div>
                <div className="p-5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 text-center min-w-[120px]">
                  <p className="text-3xl font-black text-white">{summaryStats.high}</p>
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mt-1">High</p>
                </div>
                <div className="p-5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 text-center min-w-[120px]">
                  <p className="text-3xl font-black text-white">{summaryStats.avgScore}</p>
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Avg Score</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            {/* Left: Chart + Table */}
            <div className="xl:col-span-3 space-y-8">

              {/* Trend Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 rounded-[28px] border border-stone-200/60 shadow-sm"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-black text-stone-900">Anomaly Detection Frequency</h3>
                    <p className="text-sm text-stone-500">30-day rolling window — spikes indicate coordinated deviations</p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-indigo-500" />
                </div>
                <div className="h-[220px]">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorAnomalies" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} />
                        <YAxis hide />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                        <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAnomalies)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-stone-400 gap-2">
                      <Target className="h-8 w-8 text-stone-200" />
                      <span className="font-medium">No trend data yet</span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Anomaly Table */}
              <div className="bg-white rounded-[28px] border border-stone-200/60 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-stone-100">
                  <h3 className="text-lg font-black text-stone-900 flex items-center gap-2">
                    <Target className="h-5 w-5 text-indigo-500" /> Anomaly Event Index
                  </h3>
                  {stats && (
                    <div className="flex gap-4 mt-3">
                      {[
                        { label: 'Audit Events', val: stats.total_audit_events },
                        { label: 'Shifts', val: stats.total_shifts },
                        { label: 'Voids', val: stats.total_voids },
                        { label: 'Bills', val: stats.total_bills },
                      ].map(s => (
                        <div key={s.label} className="text-center px-3 py-1.5 bg-stone-50 rounded-lg">
                          <p className="text-sm font-black text-stone-800">{s.val}</p>
                          <p className="text-[10px] text-stone-400 uppercase tracking-widest">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[700px]">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-100">
                        <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Time</th>
                        <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Type</th>
                        <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Description</th>
                        <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest text-center">Severity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="px-6 py-4"><div className="h-4 bg-stone-100 rounded w-24" /></td>
                            <td className="px-6 py-4"><div className="h-4 bg-stone-100 rounded w-32" /></td>
                            <td className="px-6 py-4"><div className="h-4 bg-stone-100 rounded w-64" /></td>
                            <td className="px-6 py-4"><div className="h-6 bg-stone-100 rounded-full w-20 mx-auto" /></td>
                          </tr>
                        ))
                      ) : anomalies.length > 0 ? (
                        anomalies.map((event) => (
                          <tr key={event.id} className="hover:bg-indigo-50/30 transition-colors border-l-4 border-transparent hover:border-indigo-400">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <p className="text-sm font-bold text-stone-800">{format(new Date(event.detected_at), 'HH:mm')}</p>
                              <p className="text-[10px] text-stone-400">{format(new Date(event.detected_at), 'MMM dd')}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                {event.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 max-w-xs">
                              <p className="text-sm text-stone-700 truncate">{event.description}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={cn(
                                'inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border',
                                event.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                event.severity === 'HIGH' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                event.severity === 'MEDIUM' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                'bg-indigo-50 text-indigo-600 border-indigo-200'
                              )}>
                                {event.severity}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-6 py-20 text-center">
                            <ActivitySquare className="h-12 w-12 text-stone-200 mx-auto mb-3" />
                            <p className="font-black text-stone-700">Baseline Stable</p>
                            <p className="text-sm text-stone-400 mt-1">No anomalies detected in the last 30 days</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right: Gemini AI Insights */}
            <div className="space-y-6">

              {/* Risk Level Badge */}
              {gemini && (
                <div className="p-6 bg-indigo-950 rounded-[24px] border border-indigo-900 relative overflow-hidden">
                  <div className="absolute -inset-10 bg-gradient-to-b from-indigo-500/20 to-transparent blur-2xl" />
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-indigo-400" />
                      <span className="text-xs font-black text-indigo-300 uppercase tracking-widest">Gemini Analysis</span>
                    </div>
                    <div className={cn(
                      'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border',
                      RISK_COLORS[gemini.risk_level]
                    )}>
                      <AlertTriangle className="h-3 w-3" />
                      Risk: {gemini.risk_level}
                    </div>
                    <p className="text-sm text-indigo-100 leading-relaxed">{gemini.summary}</p>
                  </div>
                </div>
              )}

              {/* Insights Cards */}
              {loadingInsights ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-4 bg-white rounded-2xl border border-stone-100 animate-pulse">
                      <div className="h-3 bg-stone-100 rounded w-24 mb-2" />
                      <div className="h-3 bg-stone-100 rounded w-full mb-1" />
                      <div className="h-3 bg-stone-100 rounded w-3/4" />
                    </div>
                  ))}
                </div>
              ) : gemini ? (
                <div className="space-y-3">
                  {gemini.insights.map((insight, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="p-4 bg-white rounded-2xl border border-stone-100 shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border', CATEGORY_COLORS[insight.category])}>
                          {CATEGORY_ICONS[insight.category]}
                          {insight.category}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-stone-800 mb-1">{insight.title}</p>
                      <p className="text-xs text-stone-500 leading-relaxed">{insight.detail}</p>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="p-6 bg-white rounded-2xl border border-stone-100 text-center">
                  <Brain className="h-8 w-8 text-stone-200 mx-auto mb-2" />
                  <p className="text-sm text-stone-400">Click "Ask Gemini" to generate AI insights</p>
                </div>
              )}

              {/* Recommendation */}
              {gemini?.recommendation && (
                <div className="p-5 bg-stone-900 rounded-2xl">
                  <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Top Recommendation</p>
                  <p className="text-sm text-white leading-relaxed">{gemini.recommendation}</p>
                </div>
              )}

              {/* System Info */}
              <div className="p-5 bg-white rounded-2xl border border-stone-100 space-y-3">
                <h4 className="text-xs font-black text-stone-500 uppercase tracking-widest flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" /> Data Sources
                </h4>
                {[
                  { label: 'Audit Trail', desc: 'All system actions (30 days)' },
                  { label: 'Cashier Shifts', desc: 'Float & discrepancy tracking' },
                  { label: 'Void Bills', desc: 'Cancelled transaction patterns' },
                  { label: 'Audit Exceptions', desc: 'Night audit flagged items' },
                ].map(s => (
                  <div key={s.label} className="flex items-start gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-stone-700">{s.label}</p>
                      <p className="text-[10px] text-stone-400">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
