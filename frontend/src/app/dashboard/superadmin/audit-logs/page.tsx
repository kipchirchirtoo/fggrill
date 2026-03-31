'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, Search, Download, RefreshCw, AlertTriangle,
  ChevronLeft, ChevronRight, Database, Lock, Activity,
  ShieldCheck, ShieldAlert, Info, Monitor, Smartphone,
  User, XCircle, Globe, Eye, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { adminLogsAPI, LogEntry, LogsOverview } from '@/lib/api/admin-logs';
import { exportAuditLogsPDF } from '@/lib/audit-logs-pdf';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UserRole } from '@/lib/auth-context';

// ── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: any; color: { bg: string; text: string };
}) => (
  <div className="p-5 bg-white border border-stone-200 overflow-hidden relative">
    <div className="flex items-start justify-between">
      <div className={cn('p-3', color.bg)}>
        <Icon className={cn('h-5 w-5', color.text)} />
      </div>
    </div>
    <div className="mt-4">
      <p className="text-3xl font-black text-stone-900 tracking-tight">{value}</p>
      <p className="text-sm font-medium text-stone-500 mt-1">{label}</p>
    </div>
  </div>
);

// ── Log Detail Drawer ─────────────────────────────────────────────────────────
const LogDetailDrawer = ({ log, onClose }: { log: LogEntry | null; onClose: () => void }) => {
  if (!log) return null;
  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-stone-900/40 z-[100]"
      />
      <div className="fixed top-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl z-[101] border-l border-stone-200 overflow-y-auto">
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-stone-900 uppercase tracking-tight">Log Detail</h2>
              <p className="text-sm text-stone-500 font-mono">ID: {log.id}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-stone-100 transition-colors">
              <XCircle className="h-6 w-6 text-stone-400" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-stone-50 border border-stone-100">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Severity</p>
              <span className={cn(
                'inline-flex items-center px-2.5 py-1 text-xs font-bold border',
                log.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-stone-100 text-stone-600 border-stone-200'
              )}>
                {log.severity || 'INFO'}
              </span>
            </div>
            <div className="p-4 bg-stone-50 border border-stone-100">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Status</p>
              <span className="text-sm font-bold text-stone-900 capitalize">{log.status}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Info className="h-4 w-4" /> System Context
            </h3>
            <div className="p-6 bg-stone-900 text-stone-300 font-mono text-xs leading-relaxed overflow-x-auto">
              <pre>{JSON.stringify({
                timestamp: log.created_at,
                category: log.category,
                ip: log.ip_address,
                user_agent: typeof log.device_info === 'object' ? log.device_info?.userAgent : log.device_info,
                details: log.details || {}
              }, null, 2)}</pre>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Globe className="h-4 w-4" /> Actor
            </h3>
            <div className="flex items-center gap-4 p-4 bg-stone-50 border border-stone-100">
              <div className="h-12 w-12 bg-stone-200 flex items-center justify-center text-xl font-bold text-stone-600">
                {log.user ? log.user.first_name[0] : '?'}
              </div>
              <div>
                <p className="font-bold text-stone-900">
                  {log.user ? `${log.user.first_name} ${log.user.last_name}` : log.email || 'System / Anonymous'}
                </p>
                <p className="text-xs text-stone-500">{log.email || log.user?.email || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Export to PDF ─────────────────────────────────────────────────────────────
async function handleExport(logs: LogEntry[], category: string, filters: { search?: string; dateFrom?: string; dateTo?: string }) {
  if (!logs.length) { toast.error('No logs to export'); return; }
  const toastId = toast.loading('Generating PDF...');
  try {
    await exportAuditLogsPDF(logs, category, filters);
    toast.success(`Exported ${logs.length} records`, { id: toastId });
  } catch (e) {
    toast.error('PDF export failed', { id: toastId });
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AuditLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [overview, setOverview] = useState<LogsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'security' | 'audit' | 'finance' | 'alerts'>('security');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const LIMIT = 20;

  const fetchOverview = useCallback(async () => {
    try {
      const res = await adminLogsAPI.getOverview();
      if (res.success) setOverview(res.data);
    } catch { /* silent */ }
  }, []);

  const fetchLogs = useCallback(async (resetPage = false) => {
    setLoading(true);
    const currentPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);
    try {
      const res = await adminLogsAPI.getLogs({
        category: activeTab,
        page: currentPage,
        limit: LIMIT,
        search: search.trim() || undefined,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
      }) as any;
      if (res.success) {
        setLogs(res.data || []);
        setTotalCount(res.count || 0);
      }
    } catch {
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, search, dateFrom, dateTo]);

  // Re-fetch when tab or page changes
  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { fetchLogs(); }, [activeTab, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(true);
  };

  const riskScore = useMemo(() => {
    if (!overview) return 0;
    return Math.min(100,
      overview.securityAlertsToday * 10 +
      overview.failedLoginsToday * 5 +
      overview.criticalEvents24h * 20
    );
  }, [overview]);

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

  const tabs = [
    { id: 'security', label: 'Access Control', icon: Lock },
    { id: 'audit', label: 'Audit Trail', icon: Database },
    { id: 'finance', label: 'Finance', icon: Activity },
    { id: 'alerts', label: 'Security Alerts', icon: AlertTriangle },
  ] as const;

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="max-w-[1600px] mx-auto space-y-6">
          <LogDetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
            <div>
              <h1 className="text-2xl font-black text-stone-900 tracking-tight">Audit Logs</h1>
              <p className="text-sm text-stone-500 mt-0.5">System-wide activity, security events, and operational trail</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { fetchOverview(); fetchLogs(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 text-sm font-bold text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                Refresh
              </button>
              <button
                onClick={() => handleExport(logs, activeTab, { search, dateFrom, dateTo })}
                className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-sm font-bold hover:bg-stone-800 transition-colors"
              >
                <Download className="h-4 w-4" />
                Export PDF
              </button>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Logins Today" value={overview?.loginsToday ?? 0} icon={ShieldCheck} color={{ bg: 'bg-emerald-50', text: 'text-emerald-600' }} />
            <StatCard label="Failed Logins" value={overview?.failedLoginsToday ?? 0} icon={ShieldAlert} color={{ bg: 'bg-rose-50', text: 'text-rose-600' }} />
            <StatCard label="Security Alerts" value={overview?.securityAlertsToday ?? 0} icon={AlertTriangle} color={{ bg: 'bg-amber-50', text: 'text-amber-600' }} />
            <StatCard label="Critical Events (24h)" value={overview?.criticalEvents24h ?? 0} icon={Shield} color={{ bg: 'bg-stone-100', text: 'text-stone-600' }} />
          </div>

          {/* Activity Chart */}
          <div className="bg-white border border-stone-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-black text-stone-900">Security Activity (24h)</h3>
                <p className="text-xs text-stone-500">Logins and alerts by hour</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 bg-emerald-500" /><span className="text-[10px] font-bold text-stone-400 uppercase">Logins</span></div>
                <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 bg-rose-500" /><span className="text-[10px] font-bold text-stone-400 uppercase">Alerts</span></div>
              </div>
            </div>
            <div className="h-[220px]">
              {overview?.activityTrend?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overview.activityTrend}>
                    <defs>
                      <linearGradient id="gLogins" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gAlerts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} interval={3} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 0, fontSize: 12 }} />
                    <Area type="monotone" dataKey="logins" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#gLogins)" />
                    <Area type="monotone" dataKey="alerts" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#gAlerts)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-stone-400 text-sm">No trend data available</div>
              )}
            </div>
          </div>

          {/* Log Table */}
          <div className="bg-white border border-stone-200">
            {/* Tabs + Filters */}
            <div className="p-4 border-b border-stone-100 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Tabs */}
                <div className="flex border border-stone-200 w-fit">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setPage(1); }}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors border-r border-stone-200 last:border-r-0',
                        activeTab === tab.id
                          ? 'bg-stone-900 text-white'
                          : 'bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-900'
                      )}
                    >
                      <tab.icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <form onSubmit={handleSearch} className="flex gap-2 flex-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Search by email, action, IP..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 border border-stone-200 text-sm focus:outline-none focus:border-stone-400 bg-white"
                    />
                  </div>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:border-stone-400 text-stone-600" />
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:border-stone-400 text-stone-600" />
                  <button type="submit" className="px-4 py-2 bg-stone-900 text-white text-sm font-bold hover:bg-stone-800 transition-colors flex items-center gap-2">
                    <Filter className="h-4 w-4" /> Filter
                  </button>
                </form>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="px-6 py-3 text-[11px] font-black text-stone-500 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-3 text-[11px] font-black text-stone-500 uppercase tracking-wider">Actor</th>
                    <th className="px-6 py-3 text-[11px] font-black text-stone-500 uppercase tracking-wider">Action / Message</th>
                    <th className="px-6 py-3 text-[11px] font-black text-stone-500 uppercase tracking-wider">IP Address</th>
                    <th className="px-6 py-3 text-[11px] font-black text-stone-500 uppercase tracking-wider text-center">Status</th>
                    <th className="px-6 py-3 text-[11px] font-black text-stone-500 uppercase tracking-wider text-center">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-6 py-4"><div className="h-4 bg-stone-100 w-28" /></td>
                        <td className="px-6 py-4"><div className="h-4 bg-stone-100 w-36" /></td>
                        <td className="px-6 py-4"><div className="h-4 bg-stone-100 w-64" /></td>
                        <td className="px-6 py-4"><div className="h-4 bg-stone-100 w-24" /></td>
                        <td className="px-6 py-4"><div className="h-6 bg-stone-100 w-16 mx-auto" /></td>
                        <td className="px-6 py-4"><div className="h-6 bg-stone-100 w-8 mx-auto" /></td>
                      </tr>
                    ))
                  ) : logs.length > 0 ? (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="font-bold text-stone-900">{format(new Date(log.created_at), 'HH:mm:ss')}</p>
                          <p className="text-[10px] text-stone-400 uppercase">{format(new Date(log.created_at), 'MMM dd, yyyy')}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 bg-stone-100 border border-stone-200 flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-stone-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-stone-900 truncate">
                                {log.user ? `${log.user.first_name} ${log.user.last_name}` : log.email || 'System'}
                              </p>
                              <p className="text-[10px] text-stone-400 truncate">{log.user?.email || log.email || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-stone-900 font-medium max-w-xs truncate">
                            {log.message || log.action || '—'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {typeof log.device_info === 'object' && log.device_info?.platform && (
                              <span className="flex items-center gap-1 text-[10px] text-stone-400">
                                {log.device_info.platform === 'Windows' ? <Monitor className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                                {log.device_info.platform}
                              </span>
                            )}
                            {log.auth_method && (
                              <span className="text-[10px] text-stone-400 font-mono uppercase bg-stone-100 px-1.5 py-0.5 border border-stone-200">
                                {log.auth_method}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-stone-500">
                          {log.ip_address || '—'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={cn(
                            'inline-flex items-center px-3 py-1 text-[10px] font-black uppercase tracking-wider border',
                            log.status === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            log.status === 'failed' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            'bg-stone-100 text-stone-600 border-stone-200'
                          )}>
                            {log.status || 'info'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1.5 hover:bg-stone-100 transition-colors text-stone-400 hover:text-stone-900"
                            title="View detail"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                        <Activity className="h-10 w-10 text-stone-200 mx-auto mb-3" />
                        <p className="text-stone-500 font-medium">No logs found for this filter</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
              <p className="text-xs text-stone-500">
                Showing page <span className="font-bold text-stone-900">{page}</span> of <span className="font-bold text-stone-900">{totalPages}</span>
                {totalCount > 0 && <> &mdash; <span className="font-bold text-stone-900">{totalCount}</span> total records</>}
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1 || loading}
                  onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 border border-stone-200 bg-white text-sm font-bold hover:bg-stone-50 disabled:opacity-30 transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                <button
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 border border-stone-200 bg-white text-sm font-bold hover:bg-stone-50 disabled:opacity-30 transition-colors flex items-center gap-1"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
