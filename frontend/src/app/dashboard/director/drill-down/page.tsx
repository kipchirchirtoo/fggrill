'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UserRole } from '@/lib/user-roles';
import {
  Search, ChevronRight, Building, Calendar, Database,
  ArrowRight, Layers, Flag, X, AlertTriangle, CheckCircle2,
  DollarSign, CreditCard, TrendingUp, BarChart3, Landmark, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });
const fmt = (n: number) => `KES ${(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STREAMS = [
  { id: 'Revenue Streams', icon: <TrendingUp className="w-5 h-5" />, color: 'text-emerald-600 bg-emerald-50' },
  { id: 'Payment Methods', icon: <CreditCard className="w-5 h-5" />, color: 'text-blue-600 bg-blue-50' },
  { id: 'Expense Categories', icon: <BarChart3 className="w-5 h-5" />, color: 'text-orange-600 bg-orange-50' },
  { id: 'Audit Logs', icon: <AlertTriangle className="w-5 h-5" />, color: 'text-rose-600 bg-rose-50' },
  { id: 'Banking', icon: <Landmark className="w-5 h-5" />, color: 'text-violet-600 bg-violet-50' },
];

const SEV: Record<string, string> = { CRITICAL: 'bg-rose-100 text-rose-700', HIGH: 'bg-orange-100 text-orange-700', MEDIUM: 'bg-amber-100 text-amber-700', LOW: 'bg-blue-100 text-blue-700' };
const STAT: Record<string, string> = { PENDING: 'bg-rose-100 text-rose-700', UNDER_REVIEW: 'bg-amber-100 text-amber-700', RESOLVED: 'bg-emerald-100 text-emerald-700', ESCALATED: 'bg-red-100 text-red-700' };

function subDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate() - days); return d; }
function fmtDate(d: Date) { return d.toISOString().split('T')[0]; }
function fmtDisplay(s: string) { try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return s; } }

export default function DrillDownPage() {
  const [level, setLevel] = useState<'COMPANY' | 'BRANCH' | 'DATE' | 'STREAM'>('COMPANY');
  const [sel, setSel] = useState<any>({ branch: null, date: null, stream: null });
  const [branches, setBranches] = useState<any[]>([]);
  const [streamData, setStreamData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskContext, setTaskContext] = useState<any>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/finance/branches`, { headers: authHeaders() })
      .then(r => r.json()).then(r => { if (r.success) setBranches(r.data || []); });
  }, []);

  useEffect(() => {
    if (level === 'STREAM' && sel.branch && sel.date && sel.stream) {
      setIsLoading(true);
      setStreamData(null);
      fetch(`${API_BASE}/api/finance/director/drill-down?branch_id=${sel.branch.id}&date=${sel.date}&stream=${encodeURIComponent(sel.stream)}`, { headers: authHeaders() })
        .then(r => r.json())
        .then(r => { if (r.success) setStreamData(r.data); else toast.error(r.message); })
        .catch(() => toast.error('Failed to load data'))
        .finally(() => setIsLoading(false));
    }
  }, [level, sel]);

  const nav = (newLevel: any, data?: any) => {
    setSearch('');
    if (newLevel === 'BRANCH') setSel({ ...sel, branch: data, date: null, stream: null });
    else if (newLevel === 'DATE') setSel({ ...sel, date: data, stream: null });
    else if (newLevel === 'STREAM') setSel({ ...sel, stream: data });
    setLevel(newLevel);
  };

  const resetTo = (lv: any) => {
    setSearch('');
    setLevel(lv);
    if (lv === 'COMPANY') setSel({ branch: null, date: null, stream: null });
    else if (lv === 'BRANCH') setSel({ ...sel, date: null, stream: null });
    else if (lv === 'DATE') setSel({ ...sel, stream: null });
  };

  const breadcrumbs = [
    { label: 'Famous Gate Hotels', level: 'COMPANY' },
    ...(sel.branch ? [{ label: sel.branch.name, level: 'BRANCH' }] : []),
    ...(sel.date ? [{ label: fmtDisplay(sel.date), level: 'DATE' }] : []),
    ...(sel.stream ? [{ label: sel.stream, level: 'STREAM' }] : []),
  ];

  const dates = Array.from({ length: 30 }).map((_, i) => fmtDate(subDays(new Date(), i)));
  const filteredBranches = branches.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));
  const filteredDates = dates.filter(d => d.includes(search));

  return (
    <ProtectedRoute allowedRoles={[UserRole.DIRECTOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Deep Drill-Down</h1>
              <p className="text-stone-500 mt-1">Full transparency from company to transaction level</p>
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-stone-200 shadow-sm overflow-x-auto">
            {breadcrumbs.map((item, i) => (
              <React.Fragment key={item.level}>
                {i > 0 && <ChevronRight className="w-4 h-4 text-stone-300 flex-shrink-0" />}
                <button onClick={() => resetTo(item.level as any)} className={`text-sm font-bold whitespace-nowrap transition-colors ${i === breadcrumbs.length - 1 ? 'text-[#007AFF]' : 'text-stone-500 hover:text-stone-800'}`}>
                  {item.label}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Explorer */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden min-h-[500px]">
            <div className="px-8 py-5 border-b border-stone-100 flex justify-between items-center bg-stone-50/30">
              <h3 className="text-sm font-black text-stone-700 uppercase tracking-widest">Explore {level} Data</h3>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-9 pr-4 py-2 text-sm bg-white border border-stone-200 rounded-xl outline-none w-56 focus:ring-2 focus:ring-[#007AFF]/10" />
              </div>
            </div>

            <div className="p-8">
              {/* Level: COMPANY → pick branch */}
              {level === 'COMPANY' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredBranches.length === 0 ? <div className="col-span-3 text-center text-stone-400 py-12">No branches found</div> :
                    filteredBranches.map(b => (
                      <DrillCard key={b.id} icon={<Building className="w-6 h-6" />} title={b.name} subtitle="Branch View" onClick={() => nav('BRANCH', { id: b.id, name: b.name })} />
                    ))}
                </div>
              )}

              {/* Level: BRANCH → pick date */}
              {level === 'BRANCH' && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {filteredDates.map(d => (
                    <DrillCard key={d} icon={<Calendar className="w-5 h-5" />} title={fmtDisplay(d)} subtitle="Daily Record" onClick={() => nav('DATE', d)} small />
                  ))}
                </div>
              )}

              {/* Level: DATE → pick stream */}
              {level === 'DATE' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {STREAMS.map(s => (
                    <DrillCard key={s.id} icon={s.icon} title={s.id} subtitle="Data Layer" color={s.color} onClick={() => nav('STREAM', s.id)} />
                  ))}
                </div>
              )}

              {/* Level: STREAM → real data */}
              {level === 'STREAM' && (
                <div className="space-y-6">
                  {isLoading && (
                    <div className="flex flex-col items-center justify-center py-20">
                      <Loader2 className="w-10 h-10 text-[#007AFF] animate-spin mb-4" />
                      <p className="text-stone-500">Loading {sel.stream} data...</p>
                    </div>
                  )}

                  {!isLoading && streamData && !streamData.hasRecord && (
                    <div className="bg-stone-50 rounded-2xl border border-dashed border-stone-200 p-12 text-center">
                      <Database className="w-10 h-10 text-stone-300 mx-auto mb-4" />
                      <p className="text-stone-600 font-semibold">No financial record found</p>
                      <p className="text-stone-400 text-sm mt-1">{sel.branch?.name} — {fmtDisplay(sel.date)}</p>
                    </div>
                  )}

                  {!isLoading && streamData?.hasRecord && (
                    <>
                      {/* Summary bar */}
                      <div className="flex flex-wrap gap-4">
                        <div className="bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 flex-1 min-w-[180px]">
                          <p className="text-xs font-bold text-stone-400 uppercase mb-1">Branch</p>
                          <p className="text-lg font-black text-stone-900">{streamData.branchName}</p>
                        </div>
                        <div className="bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 flex-1 min-w-[180px]">
                          <p className="text-xs font-bold text-stone-400 uppercase mb-1">Date</p>
                          <p className="text-lg font-black text-stone-900">{fmtDisplay(streamData.date)}</p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-4 flex-1 min-w-[180px]">
                          <p className="text-xs font-bold text-emerald-500 uppercase mb-1">Total Revenue</p>
                          <p className="text-lg font-black text-emerald-800">{fmt(streamData.totalRevenue)}</p>
                        </div>
                        <div className={`${streamData.netProfit >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-rose-50 border-rose-200'} border rounded-2xl px-6 py-4 flex-1 min-w-[180px]`}>
                          <p className={`text-xs font-bold uppercase mb-1 ${streamData.netProfit >= 0 ? 'text-blue-500' : 'text-rose-500'}`}>Net Profit</p>
                          <p className={`text-lg font-black ${streamData.netProfit >= 0 ? 'text-blue-800' : 'text-rose-700'}`}>{fmt(streamData.netProfit)}</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 flex-1 min-w-[180px]">
                          <p className="text-xs font-bold text-amber-500 uppercase mb-1">Status</p>
                          <p className="text-lg font-black text-amber-800 capitalize">{streamData.recordStatus || '—'}</p>
                        </div>
                      </div>

                      {/* Flag for Review button */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => { setTaskContext({ branch: sel.branch, date: sel.date, stream: sel.stream, summary: streamData.summary }); setShowTaskModal(true); }}
                          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow transition-colors"
                        >
                          <Flag className="w-4 h-4" /> Flag for Review
                        </button>
                      </div>

                      {/* Data table */}
                      <StreamTable stream={sel.stream} rows={streamData.rows} summary={streamData.summary} />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {showTaskModal && <ReviewTaskModal context={taskContext} onClose={() => setShowTaskModal(false)} />}
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function StreamTable({ stream, rows, summary }: any) {
  const s = stream.toLowerCase();

  if (rows.length === 0) {
    return (
      <div className="bg-stone-50 rounded-2xl border border-dashed p-10 text-center">
        <p className="text-stone-500">No {stream} entries recorded for this date.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
      {/* Summary row */}
      {summary?.label && (
        <div className="px-6 py-3 bg-stone-50 border-b border-stone-200 flex justify-between items-center">
          <span className="text-sm font-bold text-stone-600">{summary.label}</span>
          <span className="text-sm font-black text-stone-900">
            {summary.total != null ? fmt(summary.total) : `${summary.totalBanked != null ? fmt(summary.totalBanked) + ' banked' : ''}`}
          </span>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-900 text-white">
            {s.includes('revenue') && (<><th className="text-left px-5 py-3 font-semibold">Stream</th><th className="text-right px-5 py-3 font-semibold">Amount</th><th className="text-right px-5 py-3 font-semibold">% of Total</th></>)}
            {s.includes('payment') && (<><th className="text-left px-5 py-3 font-semibold">Method</th><th className="text-right px-5 py-3 font-semibold">Amount</th></>)}
            {s.includes('expense') && (<><th className="text-left px-5 py-3 font-semibold">Category</th><th className="text-right px-5 py-3 font-semibold">Amount</th></>)}
            {s.includes('audit') && (<><th className="text-left px-5 py-3 font-semibold">Type</th><th className="px-5 py-3 font-semibold">Severity</th><th className="px-5 py-3 font-semibold">Status</th><th className="text-left px-5 py-3 font-semibold">Description</th></>)}
            {s.includes('bank') && (<><th className="text-right px-5 py-3 font-semibold">Amount</th><th className="px-5 py-3 font-semibold">Account</th><th className="px-5 py-3 font-semibold">Reference</th><th className="px-5 py-3 font-semibold">Method</th><th className="px-5 py-3 font-semibold">Time</th></>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, i: number) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
              {s.includes('revenue') && (<><td className="px-5 py-3 font-medium text-stone-800">{row.stream}</td><td className="px-5 py-3 text-right font-bold text-stone-900">{fmt(row.amount)}</td><td className="px-5 py-3 text-right text-stone-500">{row.percentage}</td></>)}
              {s.includes('payment') && (<><td className="px-5 py-3 font-medium text-stone-800">{row.method}</td><td className="px-5 py-3 text-right font-bold text-stone-900">{fmt(row.amount)}</td></>)}
              {s.includes('expense') && (<><td className="px-5 py-3 font-medium text-stone-800">{row.category}</td><td className="px-5 py-3 text-right font-bold text-stone-900">{fmt(row.amount)}</td></>)}
              {s.includes('audit') && (<><td className="px-5 py-3 font-medium text-stone-800">{row.flag_type}</td><td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${SEV[row.severity] || ''}`}>{row.severity}</span></td><td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STAT[row.status] || ''}`}>{(row.status || '').replace('_',' ')}</span></td><td className="px-5 py-3 text-stone-500 max-w-xs truncate">{row.description}</td></>)}
              {s.includes('bank') && (<><td className="px-5 py-3 text-right font-bold text-stone-900">{fmt(row.amount)}</td><td className="px-5 py-3 text-stone-700">{row.account}</td><td className="px-5 py-3 text-stone-500">{row.reference}</td><td className="px-5 py-3 text-stone-500 capitalize">{row.method}</td><td className="px-5 py-3 text-stone-500">{row.time}</td></>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewTaskModal({ context, onClose }: any) {
  const [form, setForm] = useState({ title: `Review: ${context?.stream} — ${context?.branch?.name}`, description: `Please review the ${context?.stream} data for ${context?.branch?.name} on ${context?.date}. Investigate any anomalies and provide a detailed report.`, assigned_to_role: 'branch_accountant', priority: 'HIGH', due_date: '', director_notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/finance/director/tasks`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ ...form, branch_id: context?.branch?.id, related_record_date: context?.date, related_stream: context?.stream })
      });
      const r = await res.json();
      if (r.success) { toast.success('Review task assigned successfully!'); onClose(); }
      else toast.error(r.message || 'Failed to create task');
    } catch { toast.error('Failed to create task'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2"><Flag className="w-5 h-5 text-rose-600" /><h3 className="text-xl font-bold text-stone-900">Assign Review Task</h3></div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg"><X className="w-5 h-5 text-stone-400" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">Title</label>
            <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-[#007AFF]" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">Assign to Role</label>
            <select value={form.assigned_to_role} onChange={e => setForm({...form, assigned_to_role: e.target.value})} className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-[#007AFF]">
              <option value="branch_accountant">Branch Accountant</option>
              <option value="auditor">Auditor</option>
              <option value="hr_manager">HR Manager</option>
              <option value="branch_manager">Branch Manager</option>
              <option value="general_manager">General Manager</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">Priority</label>
            <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-[#007AFF]">
              <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">Due Date</label>
            <input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-[#007AFF]" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">Instructions</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={4} className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-[#007AFF] resize-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">Director's Notes (internal)</label>
            <textarea value={form.director_notes} onChange={e => setForm({...form, director_notes: e.target.value})} rows={2} className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-[#007AFF] resize-none" placeholder="Private notes..." />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-stone-200 rounded-xl py-2.5 font-bold text-stone-700 hover:bg-stone-50 text-sm">Cancel</button>
          <button onClick={submit} disabled={submitting || !form.title} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-2.5 font-bold text-sm disabled:opacity-50 transition-colors">
            {submitting ? 'Assigning...' : 'Assign Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DrillCard({ icon, title, subtitle, onClick, color, small }: any) {
  return (
    <button onClick={onClick} className={`group bg-white ${small ? 'p-4' : 'p-6'} rounded-2xl border border-stone-200 shadow-sm hover:border-[#007AFF] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left relative overflow-hidden`}>
      <div className="absolute top-0 right-0 w-20 h-20 bg-[#007AFF]/5 rounded-full -mr-6 -mt-6 group-hover:scale-150 transition-transform duration-500" />
      <div className={`p-2.5 rounded-xl border border-stone-100 w-fit mb-3 ${color || 'bg-stone-50 text-stone-700'} group-hover:bg-[#007AFF] group-hover:text-white group-hover:border-[#007AFF] transition-colors`}>{icon}</div>
      <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1">{subtitle}</p>
      <h4 className={`${small ? 'text-sm' : 'text-base'} font-bold text-stone-900 group-hover:text-[#007AFF] transition-colors`}>{title}</h4>
      <div className="mt-3 flex items-center gap-1 text-xs font-bold text-[#007AFF] opacity-0 group-hover:opacity-100 transition-opacity">Explore <ArrowRight className="w-3 h-3" /></div>
    </button>
  );
}
