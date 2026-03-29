'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Activity,
  Terminal,
  ChevronLeft,
  ChevronRight,
  Database,
  Lock,
  Calendar,
  Eye,
  Zap,
  ShieldCheck,
  ShieldAlert,
  Info,
  ExternalLink,
  Smartphone,
  Monitor,
  Globe
} from 'lucide-react';
import { format } from 'date-fns';
import { adminLogsAPI, LogEntry, LogsOverview } from '@/lib/api/admin-logs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UserRole } from '@/lib/auth-context';

// --- Components ---

const RiskMeter = ({ score }: { score: number }) => {
  const getColor = (s: number) => {
    if (s < 30) return 'text-emerald-500';
    if (s < 70) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getLabel = (s: number) => {
    if (s < 30) return 'Low Risk';
    if (s < 70) return 'Elevated';
    return 'High Threat';
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-stone-900/5 dark:bg-white/5 rounded-3xl border border-stone-200/50 dark:border-white/10 backdrop-blur-md relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-3">
             <ShieldCheck className={cn("h-5 w-5 opacity-20", getColor(score))} />
        </div>
        <div className="relative h-24 w-24 flex items-center justify-center">
            <svg className="h-full w-full -rotate-90">
                <circle
                    cx="48" cy="48" r="40"
                    fill="none" stroke="currentColor" strokeWidth="8"
                    className="text-stone-200 dark:text-stone-800"
                />
                <circle
                    cx="48" cy="48" r="40"
                    fill="none" stroke="currentColor" strokeWidth="8"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * score) / 100}
                    strokeLinecap="round"
                    className={cn("transition-all duration-1000 ease-out", getColor(score))}
                />
            </svg>
            <span className={cn("absolute text-2xl font-black", getColor(score))}>{score}%</span>
        </div>
        <p className="mt-3 text-xs font-bold uppercase tracking-widest text-stone-500">{getLabel(score)}</p>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color, trend }: any) => (
  <motion.div 
    whileHover={{ y: -4 }}
    className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200/60 dark:border-white/5 shadow-sm overflow-hidden relative"
  >
    <div className="flex items-start justify-between">
      <div className={cn("p-3 rounded-2xl", color.bg)}>
        <Icon className={cn("h-5 w-5", color.text)} />
      </div>
      {trend && (
        <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full", trend > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div className="mt-4">
      <p className="text-3xl font-black text-stone-900 dark:text-white tracking-tight">{value}</p>
      <p className="text-sm font-medium text-stone-500 mt-1">{label}</p>
    </div>
    <div className="absolute bottom-0 right-0 opacity-[0.03] pointer-events-none">
        <Icon className="h-20 w-20 translate-y-6 translate-x-4" />
    </div>
  </motion.div>
);

const LogDetailDrawer = ({ log, onClose }: { log: LogEntry | null, onClose: () => void }) => (
  <AnimatePresence>
    {log && (
      <>
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[100]"
        />
        <motion.div 
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 h-full w-full max-w-xl bg-white dark:bg-stone-950 shadow-2xl z-[101] border-l border-stone-200 dark:border-white/10 overflow-y-auto"
        >
          <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-stone-900 dark:text-white uppercase tracking-tight">Post-Event Analysis</h2>
                <p className="text-sm text-stone-500">Log ID: <span className="font-mono">{log.id}</span></p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors"><XCircle className="h-6 w-6 text-stone-400" /></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-stone-50 dark:bg-white/5 rounded-2xl border border-stone-100 dark:border-white/5">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Severity</p>
                    <span className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border",
                        log.severity === 'CRITICAL' ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-stone-100 text-stone-600 border-stone-200"
                    )}>
                        {log.severity || 'INFO'}
                    </span>
                </div>
                <div className="p-4 bg-stone-50 dark:bg-white/5 rounded-2xl border border-stone-100 dark:border-white/5">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Status</p>
                    <span className="text-sm font-bold text-stone-900 dark:text-white capitalize">{log.status}</span>
                </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <Info className="h-4 w-4" /> System Context
              </h3>
              <div className="p-6 bg-stone-900 rounded-3xl text-stone-300 font-mono text-xs leading-relaxed overflow-x-auto shadow-inner">
                 <pre>{JSON.stringify({
                   timestamp: log.created_at,
                   category: log.category,
                   ip: log.ip_address,
                   user_agent: typeof log.device_info === 'object' ? log.device_info.userAgent : log.device_info,
                   details: log.details || {}
                 }, null, 2)}</pre>
              </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Actor Identity
                </h3>
                <div className="flex items-center gap-4 p-4 bg-stone-50 dark:bg-white/5 rounded-2xl border border-stone-100 dark:border-white/5">
                    <div className="h-12 w-12 rounded-full bg-stone-200 flex items-center justify-center text-xl font-bold text-stone-600">
                        {log.user ? log.user.first_name[0] : '?'}
                    </div>
                    <div>
                        <p className="font-bold text-stone-900 dark:text-white">
                            {log.user ? `${log.user.first_name} ${log.user.last_name}` : log.email || 'System / Anonymous'}
                        </p>
                        <p className="text-xs text-stone-500">{log.email || 'N/A'}</p>
                    </div>
                </div>
            </div>

            <button className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-900/20">
                <ShieldCheck className="h-4 w-4" />
                Validate Entity & Trace Back
            </button>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// --- Main Page ---

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [overview, setOverview] = useState<LogsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'security' | 'audit' | 'finance' | 'alerts'>('security');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const fetchOverview = async () => {
    try {
      const res = await adminLogsAPI.getOverview();
      if (res.success) setOverview(res.data);
    } catch (err) {
      console.error('Failed to fetch logs overview', err);
    }
  };

  const fetchLogs = async (refresh = false) => {
    setLoading(true);
    try {
      const currentPage = refresh ? 1 : page;
      const res = await adminLogsAPI.getLogs({
        category: activeTab,
        page: currentPage,
        limit: 20,
        search: search.trim() || undefined
      });

      if (res.success) {
        setLogs(res.data);
        setHasMore(res.data.length === 20);
        if (refresh) setPage(1);
      }
    } catch (err) {
      toast.error('Failed to retrieve logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchLogs(true);
  }, [activeTab]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(true);
  };

  // Calculate Risk Level based on failed logins and alerts
  const riskScore = useMemo(() => {
    if (!overview) return 0;
    const alertWeight = overview.securityAlertsToday * 10;
    const failedWeight = overview.failedLoginsToday * 5;
    const criticalWeight = overview.criticalEvents24h * 20;
    return Math.min(100, alertWeight + failedWeight + criticalWeight);
  }, [overview]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
          <LogDetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />

          {/* Hero Header */}
          <div className="relative p-12 bg-stone-900 overflow-hidden rounded-[40px] shadow-2xl shadow-stone-900/30">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
            <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-emerald-500/10 to-transparent" />
            
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-400 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em]">
                        <Zap className="h-3 w-3 animate-pulse" /> Live Security Environment
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter leading-none">
                        Digital Fortress <span className="text-emerald-500">Audit</span>
                    </h1>
                    <p className="text-stone-400 max-w-xl text-lg font-medium">
                        Unified system forensics, real-time threat intelligence, and operational transparency powered by HIRALL Core Engine.
                    </p>
                    <div className="flex items-center gap-4 pt-4">
                        <button 
                            onClick={() => { fetchOverview(); fetchLogs(true); }}
                            className="px-6 py-3 bg-white text-stone-950 rounded-2xl font-bold hover:bg-stone-100 transition-all flex items-center gap-2 shadow-xl shadow-white/5 active:scale-95"
                        >
                            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                            Synch Core
                        </button>
                        <button className="px-6 py-3 bg-white/5 text-white border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-all flex items-center gap-2">
                            <Download className="h-4 w-4" />
                            Export Intelligence
                        </button>
                    </div>
                </div>

                <div className="w-full lg:w-auto flex gap-6">
                    <RiskMeter score={riskScore} />
                    <div className="hidden xl:flex flex-col gap-3 justify-center">
                        <div className="flex items-center gap-2 text-stone-400 text-xs font-bold uppercase tracking-widest">
                            <Activity className="h-4 w-4 text-emerald-500" /> System: Nominal
                        </div>
                        <div className="flex items-center gap-2 text-stone-400 text-xs font-bold uppercase tracking-widest font-mono">
                            LATENCY: 42MS
                        </div>
                    </div>
                </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            {/* Left Column: Analytics & Ticker */}
            <div className="xl:col-span-3 space-y-8">
                {/* Trend Chart */}
                <motion.div 
                   initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                   className="bg-white dark:bg-stone-900 p-8 rounded-[32px] border border-stone-200/60 dark:border-white/5 shadow-sm"
                >
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-stone-900 dark:text-white tracking-tight">Security Activity (24h)</h3>
                            <p className="text-sm text-stone-500 font-medium italic">Detection frequency grouped by hourly intervals</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-emerald-500" /><span className="text-[10px] font-bold text-stone-400 uppercase">Logins</span></div>
                            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-rose-500" /><span className="text-[10px] font-bold text-stone-400 uppercase">Alerts</span></div>
                        </div>
                    </div>
                    
                    <div className="h-[300px] w-full">
                        {overview?.activityTrend ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={overview.activityTrend}>
                                    <defs>
                                        <linearGradient id="colorLogins" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                                    <XAxis 
                                        dataKey="time" 
                                        axisLine={false} tickLine={false} 
                                        tick={{fontSize: 10, fill: '#888'}} 
                                        interval={2}
                                    />
                                    <YAxis hide />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}
                                    />
                                    <Area 
                                        type="monotone" dataKey="logins" 
                                        stroke="#10b981" strokeWidth={3} 
                                        fillOpacity={1} fill="url(#colorLogins)" 
                                    />
                                    <Area 
                                        type="monotone" dataKey="alerts" 
                                        stroke="#ef4444" strokeWidth={3} 
                                        fillOpacity={1} fill="url(#colorAlerts)" 
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-stone-400 font-medium">Aggregating telemetry...</div>
                        )}
                    </div>
                </motion.div>

                {/* Main Log Registry */}
                <div className="bg-white dark:bg-stone-900 rounded-[32px] border border-stone-200/60 dark:border-white/5 shadow-2xl overflow-hidden flex flex-col min-h-[700px]">
                    {/* Tabs & Controls */}
                    <div className="p-8 border-b border-stone-100 dark:border-white/5 space-y-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                            <div className="flex p-1.5 bg-stone-100 dark:bg-stone-800 rounded-2xl w-fit">
                            {[
                                { id: 'security', label: 'Access Control', icon: Lock },
                                { id: 'audit', label: 'Operational Trail', icon: Database },
                                { id: 'finance', label: 'Financial Recon', icon: Activity },
                                { id: 'alerts', label: 'Security Alerts', icon: AlertTriangle }
                            ].map((tab) => (
                                <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={cn(
                                    "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                                    activeTab === tab.id 
                                    ? "bg-white dark:bg-stone-700 text-stone-950 dark:text-white shadow-xl shadow-stone-900/5 rotate-0 scale-100" 
                                    : "text-stone-500 hover:text-stone-700 dark:text-stone-400 rotate-1 scale-95"
                                )}
                                >
                                    <tab.icon className="h-4 w-4" />
                                    {tab.label}
                                </button>
                            ))}
                            </div>

                            <form onSubmit={handleSearch} className="relative flex-1 max-lg group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-stone-400 group-focus-within:text-stone-950 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Intercept IPs, IDs, or events..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3.5 bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 transition-all outline-none text-stone-900 dark:text-white"
                                />
                            </form>
                        </div>
                    </div>

                    {/* Registry View */}
                    <div className="flex-1">
                        <table className="w-full text-left border-collapse table-auto">
                            <thead>
                            <tr className="bg-stone-50/50 dark:bg-white/5 border-b border-stone-100 dark:border-white/5">
                                <th className="px-8 py-5 text-[11px] font-black text-stone-400 uppercase tracking-widest">Metadata / Clock</th>
                                <th className="px-8 py-5 text-[11px] font-black text-stone-400 uppercase tracking-widest">Authorized Actor</th>
                                <th className="px-8 py-5 text-[11px] font-black text-stone-400 uppercase tracking-widest">Instruction / Node</th>
                                <th className="px-8 py-5 text-[11px] font-black text-stone-400 uppercase tracking-widest text-center">Security Status</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-white/5">
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td className="px-8 py-6"><div className="h-4 bg-stone-100 dark:bg-white/5 rounded w-32" /></td>
                                    <td className="px-8 py-6"><div className="h-10 w-10 bg-stone-100 dark:bg-white/5 rounded-full" /></td>
                                    <td className="px-8 py-6"><div className="h-4 bg-stone-100 dark:bg-white/5 rounded w-64" /></td>
                                    <td className="px-8 py-6"><div className="h-8 bg-stone-100 dark:bg-white/5 rounded-full w-24 mx-auto" /></td>
                                </tr>
                                ))
                            ) : logs.length > 0 ? (
                                logs.map((log) => (
                                <tr 
                                    key={log.id} 
                                    onClick={() => setSelectedLog(log)}
                                    className="hover:bg-stone-50 dark:hover:bg-white/5 transition-all group cursor-pointer border-l-4 border-transparent hover:border-emerald-500"
                                >
                                    <td className="px-8 py-6 whitespace-nowrap">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-stone-100 dark:bg-white/10 rounded-2xl text-stone-500 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                                                {log.category === 'security' ? <Lock className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-stone-900 dark:text-white">
                                                    {format(new Date(log.created_at), 'HH:mm:ss')}
                                                </p>
                                                <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                                                    {format(new Date(log.created_at), 'MMM dd, yyyy')}
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
                                                    {log.user ? `${log.user.first_name} ${log.user.last_name}` : (log.email || 'System Operation')}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1 w-1 rounded-full bg-emerald-500" />
                                                    <p className="text-[11px] text-stone-500 font-mono tracking-tight">{log.ip_address || 'DIRECT_LINK'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="max-w-md">
                                            <p className="text-sm font-bold text-stone-900 dark:text-white leading-tight">
                                                {log.message || log.action || 'System process execution'}
                                            </p>
                                            <div className="mt-1 flex items-center gap-3">
                                                {typeof log.device_info === 'object' && log.device_info?.platform && (
                                                    <span className="flex items-center gap-1 text-[10px] text-stone-500 font-bold items-center">
                                                        {log.device_info.platform === 'Windows' ? <Monitor className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                                                        {log.device_info.platform}
                                                    </span>
                                                )}
                                                {log.auth_method && (
                                                    <span className="text-[10px] text-stone-400 font-mono uppercase bg-stone-100 dark:bg-white/5 px-2 py-0.5 rounded border border-stone-200 dark:border-white/5">
                                                        METHOD: {log.auth_method}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className={cn(
                                            "inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] border transition-all",
                                            log.status === 'success' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : 
                                            log.status === 'failed' ? "bg-rose-500/10 text-rose-600 border-rose-500/20 shadow-lg shadow-rose-500/10" :
                                            "bg-stone-100 text-stone-600 border-stone-200"
                                        )}>
                                            {log.status}
                                        </span>
                                    </td>
                                </tr>
                                ))
                            ) : (
                                <tr>
                                <td colSpan={4} className="px-8 py-32 text-center">
                                    <Activity className="h-16 w-16 text-stone-200 mx-auto mb-4" />
                                    <h3 className="text-2xl font-black text-stone-900 dark:text-white mt-4">Registry Nullified</h3>
                                    <p className="text-stone-500 font-medium">No activity detected for the current node configuration.</p>
                                </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Grid */}
                    <div className="p-8 border-t border-stone-100 dark:border-white/5 bg-stone-50/30 dark:bg-white/5 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-stone-400 font-bold uppercase tracking-widest">
                                Page Segment: <span className="text-stone-900 dark:text-white">{page}</span> / <span className="text-stone-900 dark:text-white">Tele-Index</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                disabled={page === 1 || loading}
                                onClick={() => setPage(p => p - 1)}
                                className="px-6 py-2.5 rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-stone-800 text-sm font-bold hover:bg-stone-50 disabled:opacity-30 transition-all flex items-center gap-2 active:scale-95"
                            >
                                <ChevronLeft className="h-4 w-4" /> Previous
                            </button>
                            <button
                                disabled={!hasMore || loading}
                                onClick={() => setPage(p => p + 1)}
                                className="px-6 py-2.5 rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-stone-800 text-sm font-bold hover:bg-stone-50 disabled:opacity-30 transition-all flex items-center gap-2 active:scale-95"
                            >
                                Next <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Mini Stats & Radar */}
            <div className="space-y-8">
                <StatCard 
                    label="Authorized Logins" value={overview?.loginsToday ?? 0} 
                    icon={ShieldCheck} trend={12} 
                    color={{ bg: 'bg-emerald-500/10', text: 'text-emerald-500' }} 
                />
                <StatCard 
                    label="Blocked Intrusions" value={overview?.failedLoginsToday ?? 0} 
                    icon={ShieldAlert} trend={-5} 
                    color={{ bg: 'bg-rose-500/10', text: 'text-rose-500' }} 
                />
                <StatCard 
                    label="System Alerts" value={overview?.securityAlertsToday ?? 0} 
                    icon={AlertTriangle} trend={2} 
                    color={{ bg: 'bg-amber-500/10', text: 'text-amber-500' }} 
                />
                
                <div className="p-8 bg-stone-900 rounded-[32px] border border-white/5 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent" />
                    <div className="relative z-10 space-y-4 text-center">
                        <Terminal className="h-10 w-10 text-indigo-400 mx-auto" />
                        <h4 className="text-lg font-black text-white uppercase tracking-tighter italic">Live Observation</h4>
                        <p className="text-xs text-stone-400 leading-relaxed font-medium">
                            The security subsystem is cross-referencing activity footprints across all Hilton HIRALL nodes.
                        </p>
                        <div className="pt-4 flex justify-center">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                </span>
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Telemetry Active</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-white dark:bg-stone-900 rounded-[32px] border border-stone-200/60 dark:border-white/5 space-y-6">
                    <h4 className="text-sm font-black text-stone-900 dark:text-white uppercase tracking-widest">Active Watchlist</h4>
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-white/5 border border-stone-100 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-xs font-bold text-stone-500">IP</div>
                                    <p className="text-xs font-bold text-stone-900 dark:text-white">192.168.1.{i * 15}</p>
                                </div>
                                <span className="text-[10px] font-bold text-rose-500 uppercase">Flagged</span>
                            </div>
                        ))}
                    </div>
                    <button className="w-full text-center text-xs font-bold text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors">View All Watchlisted</button>
                </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
