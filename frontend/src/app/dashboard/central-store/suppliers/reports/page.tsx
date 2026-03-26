'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { procurementAPI } from '@/lib/api';
import {
    PieChart, TrendingUp, AlertCircle, History,
    Download, RefreshCw, ShieldCheck, ChevronRight,
    FileText, Calendar, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt = (val: any) => {
    const n = Number(val);
    if (isNaN(n)) return '0';
    return n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const fmtDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const dayAge = (d: string) =>
    Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);

const ageBadge = (days: number) => {
    if (days <= 30) return 'bg-emerald-100 text-emerald-700';
    if (days <= 60) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
};

const actionColor: Record<string, string> = {
    CREATE: 'bg-blue-100 text-blue-700',
    UPDATE: 'bg-amber-100 text-amber-700',
    DELETE: 'bg-red-100 text-red-700',
    APPROVE: 'bg-emerald-100 text-emerald-700',
    REJECT: 'bg-red-100 text-red-600',
    SUBMIT: 'bg-purple-100 text-purple-700',
};

// ─── nav links ───────────────────────────────────────────────────────────────
const NAV = [
    { label: 'Suppliers', href: '/dashboard/central-store/suppliers' },
    { label: 'POs', href: '/dashboard/central-store/suppliers/purchase-orders' },
    { label: 'GRN', href: '/dashboard/central-store/suppliers/grn' },
    { label: 'Invoices', href: '/dashboard/central-store/suppliers/invoices' },
    { label: 'Payments', href: '/dashboard/central-store/suppliers/payments' },
    { label: 'Reports', href: '/dashboard/central-store/suppliers/reports' },
];

// ─── types ───────────────────────────────────────────────────────────────────
interface AuditLog {
    id: string;
    action_type: string;
    entity_type: string;
    entity_id: string;
    user_name?: string;
    performed_by?: string;
    description?: string;
    action_timestamp: string;
    old_values?: any;
    new_values?: any;
}

type Tab = 'vat' | 'grni' | 'aging' | 'audit';

// ─── component ───────────────────────────────────────────────────────────────
export default function ProcurementReportsPage() {
    const { user } = useAuth();

    // date range (default = current month)
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    const [fromDate, setFromDate] = useState(firstOfMonth);
    const [toDate, setToDate] = useState(todayStr);

    const [vatSummary, setVatSummary] = useState<any>(null);
    const [grniLogs, setGrniLogs] = useState<any[]>([]);
    const [agingData, setAgingData] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('vat');

    // ── fetchers ────────────────────────────────────────────────────────────
    const fetchVATReport = useCallback(async () => {
        setIsLoading(true);
        try {
            const r = await procurementAPI.getVATReport({ from_date: fromDate, to_date: toDate });
            if (r.success) setVatSummary(r);
            else toast.error('Failed to load VAT report');
        } catch { toast.error('Error loading VAT report'); }
        finally { setIsLoading(false); }
    }, [fromDate, toDate]);

    const fetchGRNIReport = useCallback(async () => {
        setIsLoading(true);
        try {
            const r = await procurementAPI.getGRNIReport();
            if (r.success) setGrniLogs(r.data || []);
            else toast.error('Failed to load GRNI report');
        } catch { toast.error('Error loading GRNI report'); }
        finally { setIsLoading(false); }
    }, []);

    const fetchAgingReport = useCallback(async () => {
        setIsLoading(true);
        try {
            const r = await procurementAPI.getAgingAnalysis();
            if (r.success) setAgingData(r.data || []);
            else toast.error('Failed to load aging report');
        } catch { toast.error('Error loading aging report'); }
        finally { setIsLoading(false); }
    }, []);

    const fetchAuditLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const r = await procurementAPI.getAuditTrail({ from_date: fromDate, to_date: toDate });
            if (r.success) setAuditLogs(r.data || []);
            else toast.error('Failed to load audit trail');
        } catch { toast.error('Error loading audit trail'); }
        finally { setIsLoading(false); }
    }, [fromDate, toDate]);

    useEffect(() => {
        if (activeTab === 'vat') fetchVATReport();
        else if (activeTab === 'grni') fetchGRNIReport();
        else if (activeTab === 'aging') fetchAgingReport();
        else if (activeTab === 'audit') fetchAuditLogs();
    }, [activeTab, fetchVATReport, fetchGRNIReport, fetchAgingReport, fetchAuditLogs]);

    // ── exports ─────────────────────────────────────────────────────────────
    const handleExportVAT = () =>
        toast.promise(
            procurementAPI.exportVATReportPDF({ from_date: fromDate, to_date: toDate }),
            { loading: 'Generating KRA VAT Report…', success: 'Downloaded!', error: 'Export failed' }
        );

    const handleExportAll = () =>
        toast.promise(
            procurementAPI.exportProcurementIntelligencePDF({ from_date: fromDate, to_date: toDate }),
            { loading: 'Generating Procurement Report…', success: 'Downloaded!', error: 'Export failed' }
        );

    // ── refresh current tab ─────────────────────────────────────────────────
    const refresh = () => {
        if (activeTab === 'vat') fetchVATReport();
        else if (activeTab === 'grni') fetchGRNIReport();
        else if (activeTab === 'aging') fetchAgingReport();
        else fetchAuditLogs();
    };

    const TABS: { id: Tab; label: string; sub: string; Icon: any }[] = [
        { id: 'vat', label: 'VAT Input', sub: 'KRA Tax Summary', Icon: PieChart },
        { id: 'grni', label: 'GRNI', sub: 'Goods Rec Not Inv', Icon: TrendingUp },
        { id: 'aging', label: 'Aging', sub: 'Payables Analysis', Icon: AlertCircle },
        { id: 'audit', label: 'Audit Trail', sub: 'Immutable Logs', Icon: History },
    ];

    const Spinner = () => (
        <div className="flex flex-col items-center justify-center py-20 text-stone-300 gap-3">
            <RefreshCw className="animate-spin w-8 h-8" />
            <span className="text-sm text-stone-400">Loading data…</span>
        </div>
    );

    const Empty = ({ msg }: { msg: string }) => (
        <div className="py-16 text-center text-stone-400 italic text-sm">{msg}</div>
    );

    return (
        <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="space-y-6">

                    {/* ── Header ── */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Procurement Intelligence</h1>
                            <p className="text-gray-500 text-sm">Compliance reports & immutable audit trails</p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <IOSButton variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />} onClick={refresh}>
                                Refresh
                            </IOSButton>
                            <IOSButton variant="secondary" size="sm" leftIcon={<Download size={14} />} onClick={handleExportAll}>
                                Export All
                            </IOSButton>
                        </div>
                    </div>

                    {/* ── Sub-nav ── */}
                    <div className="flex flex-wrap gap-2 pb-2 border-b border-stone-100">
                        {NAV.map(n => (
                            <button
                                key={n.href}
                                onClick={() => (window.location.href = n.href)}
                                className={`h-8 px-3 text-xs rounded-lg transition-colors font-medium ${
                                    n.href.endsWith('/reports')
                                        ? 'bg-stone-900 text-white'
                                        : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                                }`}
                            >
                                {n.label}
                            </button>
                        ))}
                    </div>

                    {/* ── Date range (for VAT + Audit) ── */}
                    {(activeTab === 'vat' || activeTab === 'audit') && (
                        <IOSCard className="p-4">
                            <div className="flex flex-wrap items-end gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block mb-1">
                                        From Date
                                    </label>
                                    <input
                                        type="date"
                                        value={fromDate}
                                        onChange={e => setFromDate(e.target.value)}
                                        className="h-9 px-3 rounded-lg border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block mb-1">
                                        To Date
                                    </label>
                                    <input
                                        type="date"
                                        value={toDate}
                                        onChange={e => setToDate(e.target.value)}
                                        className="h-9 px-3 rounded-lg border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                                    />
                                </div>
                                <IOSButton variant="primary" size="sm" leftIcon={<Calendar size={14} />} onClick={refresh}>
                                    Apply
                                </IOSButton>
                            </div>
                        </IOSCard>
                    )}

                    {/* ── Tab Selector ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {TABS.map(({ id, label, sub, Icon }) => {
                            const active = activeTab === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => setActiveTab(id)}
                                    className={`p-3 rounded-xl border transition-all text-left group ${
                                        active
                                            ? 'border-[#007AFF] bg-blue-50/60 ring-1 ring-[#007AFF]/40 shadow-sm'
                                            : 'border-stone-100 bg-white hover:bg-stone-50 hover:border-stone-200'
                                    }`}
                                >
                                    <Icon size={18} className={active ? 'text-[#007AFF]' : 'text-stone-400'} />
                                    <p className="text-[10px] font-bold uppercase mt-2 text-stone-500">{label}</p>
                                    <p className={`text-xs font-semibold truncate ${active ? 'text-[#007AFF]' : 'text-stone-700'}`}>
                                        {sub}
                                    </p>
                                </button>
                            );
                        })}
                    </div>

                    {/* ───────────────── MAIN CONTENT ───────────────── */}
                    <IOSCard className="min-h-[420px]">

                        {/* ── VAT Report ── */}
                        {activeTab === 'vat' && (
                            <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-stone-900">VAT Input Summary</h3>
                                        <p className="text-xs text-stone-400">Approved invoices — {fmtDate(fromDate)} to {fmtDate(toDate)}</p>
                                    </div>
                                    <IOSButton variant="secondary" size="sm" leftIcon={<Download size={14} />} onClick={handleExportVAT}>
                                        KRA Format
                                    </IOSButton>
                                </div>

                                {isLoading ? <Spinner /> : (
                                    <>
                                        {/* KPI cards */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="p-4 bg-stone-50 rounded-xl">
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Taxable Purchases</p>
                                                <p className="text-2xl font-black text-stone-900 mt-1">
                                                    KES {fmt(vatSummary?.summary?.total_subtotal)}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-emerald-50 rounded-xl">
                                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Input VAT (16%)</p>
                                                <p className="text-2xl font-black text-emerald-700 mt-1">
                                                    KES {fmt(vatSummary?.summary?.total_vat)}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-amber-50 rounded-xl">
                                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Withholding VAT</p>
                                                <p className="text-2xl font-black text-amber-700 mt-1">
                                                    KES {fmt(vatSummary?.summary?.total_withholding)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Table */}
                                        <div className="rounded-xl border border-stone-100 overflow-hidden">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-stone-50 border-b border-stone-100">
                                                    <tr>
                                                        {['Invoice #', 'Supplier', 'Date', 'Taxable Amt', 'VAT'].map(h => (
                                                            <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase text-stone-500">
                                                                {h}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-50">
                                                    {vatSummary?.data?.map((inv: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-stone-50 transition-colors">
                                                            <td className="px-4 py-2.5 font-mono text-stone-600">{inv.invoice_number}</td>
                                                            <td className="px-4 py-2.5 font-semibold text-stone-800">{inv.supplier?.name || '—'}</td>
                                                            <td className="px-4 py-2.5 text-stone-500">{fmtDate(inv.invoice_date)}</td>
                                                            <td className="px-4 py-2.5 text-right font-mono">{fmt(inv.subtotal)}</td>
                                                            <td className="px-4 py-2.5 text-right font-mono text-emerald-600">{fmt(inv.vat_amount)}</td>
                                                        </tr>
                                                    ))}
                                                    {(!vatSummary?.data || vatSummary.data.length === 0) && (
                                                        <tr><td colSpan={5}><Empty msg="No VAT transactions for this period" /></td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ── GRNI Report ── */}
                        {activeTab === 'grni' && (
                            <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-stone-900">GRNI Control Account</h3>
                                        <p className="text-xs text-stone-400">Goods Received Not Invoiced — open liability</p>
                                    </div>
                                    <IOSButton variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />} onClick={fetchGRNIReport}>
                                        Refresh
                                    </IOSButton>
                                </div>

                                {isLoading ? <Spinner /> : (
                                    <>
                                        {/* KPI */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-4 bg-amber-50 rounded-xl">
                                                <p className="text-[10px] font-bold text-amber-600 uppercase">Open Items</p>
                                                <p className="text-2xl font-black text-amber-700 mt-1">{grniLogs.length}</p>
                                            </div>
                                            <div className="p-4 bg-rose-50 rounded-xl">
                                                <p className="text-[10px] font-bold text-rose-600 uppercase">Estimated Liability</p>
                                                <p className="text-2xl font-black text-rose-700 mt-1">
                                                    KES {fmt(grniLogs.reduce((s, i) => s + Number(i.estimated_amount || 0), 0))}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-stone-100 overflow-hidden">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-stone-50 border-b border-stone-100">
                                                    <tr>
                                                        {['GRN #', 'Supplier', 'Received', 'Est. Liability', 'Age'].map(h => (
                                                            <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase text-stone-500">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-50">
                                                    {grniLogs.map((item, idx) => {
                                                        const age = dayAge(item.created_at);
                                                        return (
                                                            <tr key={idx} className="hover:bg-stone-50 transition-colors">
                                                                <td className="px-4 py-2.5 font-mono text-stone-600">{item.grn?.grn_number || '—'}</td>
                                                                <td className="px-4 py-2.5 font-semibold text-stone-800">{item.supplier?.name || '—'}</td>
                                                                <td className="px-4 py-2.5 text-stone-500">{fmtDate(item.grn?.grn_date || item.created_at)}</td>
                                                                <td className="px-4 py-2.5 text-right font-mono font-semibold text-amber-600">
                                                                    {fmt(item.estimated_amount)}
                                                                </td>
                                                                <td className="px-4 py-2.5">
                                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${ageBadge(age)}`}>
                                                                        {age}d
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {grniLogs.length === 0 && (
                                                        <tr><td colSpan={5}><Empty msg="No outstanding GRNI items — all received goods are invoiced" /></td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ── Aging Report ── */}
                        {activeTab === 'aging' && (
                            <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-stone-900">Accounts Payable Aging</h3>
                                        <p className="text-xs text-stone-400">Outstanding balances by supplier & duration bucket</p>
                                    </div>
                                    <IOSButton variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />} onClick={fetchAgingReport}>
                                        Refresh
                                    </IOSButton>
                                </div>

                                {isLoading ? <Spinner /> : (
                                    <>
                                        {/* Totals */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {[
                                                { label: '0–30 Days', key: 'current_amount', color: 'bg-emerald-50 text-emerald-700' },
                                                { label: '31–60 Days', key: 'days_30_amount', color: 'bg-amber-50 text-amber-700' },
                                                { label: '61–90 Days', key: 'days_60_amount', color: 'bg-orange-50 text-orange-700' },
                                                { label: '90+ Days', key: 'days_90_plus_amount', color: 'bg-red-50 text-red-700' },
                                            ].map(({ label, key, color }) => (
                                                <div key={key} className={`p-3 rounded-xl ${color}`}>
                                                    <p className={`text-[10px] font-bold uppercase tracking-wide opacity-70`}>{label}</p>
                                                    <p className="text-lg font-black mt-1">
                                                        {fmt(agingData.reduce((s, i) => s + Number(i[key] || 0), 0))}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="rounded-xl border border-stone-100 overflow-x-auto">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-stone-50 border-b border-stone-100">
                                                    <tr>
                                                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-stone-500">Supplier</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-stone-500 text-right">0–30</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-stone-500 text-right">31–60</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-stone-500 text-right">61–90</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-red-500 text-right">90+</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-stone-500 text-right bg-stone-100">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-50">
                                                    {agingData.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-stone-50 transition-colors">
                                                            <td className="px-4 py-2.5">
                                                                <div className="flex items-center gap-2">
                                                                    <Building2 size={14} className="text-stone-300 shrink-0" />
                                                                    <span className="font-semibold text-stone-800">
                                                                        {item.supplier?.name || '—'}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-mono text-emerald-600">{fmt(item.current_amount)}</td>
                                                            <td className="px-4 py-2.5 text-right font-mono text-amber-600">{fmt(item.days_30_amount)}</td>
                                                            <td className="px-4 py-2.5 text-right font-mono text-orange-600">{fmt(item.days_60_amount)}</td>
                                                            <td className="px-4 py-2.5 text-right font-mono font-bold text-red-500">{fmt(item.days_90_plus_amount)}</td>
                                                            <td className="px-4 py-2.5 text-right font-black text-[#007AFF] bg-stone-50">{fmt(item.current_balance)}</td>
                                                        </tr>
                                                    ))}
                                                    {agingData.length === 0 && (
                                                        <tr><td colSpan={6}><Empty msg="No aging data — all supplier balances are clear" /></td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ── Audit Trail ── */}
                        {activeTab === 'audit' && (
                            <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-stone-900">Immutable Audit Trail</h3>
                                        <p className="text-xs text-stone-400">
                                            All procurement actions — {fmtDate(fromDate)} to {fmtDate(toDate)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck size={16} className="text-emerald-500" />
                                        <span className="text-xs text-emerald-600 font-semibold">Tamper-proof log</span>
                                    </div>
                                </div>

                                {isLoading ? <Spinner /> : (
                                    <>
                                        {/* Summary */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {(['CREATE', 'APPROVE', 'UPDATE', 'REJECT'] as const).map(action => (
                                                <div key={action} className="p-3 bg-stone-50 rounded-xl">
                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${actionColor[action] || 'bg-stone-100 text-stone-600'}`}>
                                                        {action}
                                                    </span>
                                                    <p className="text-xl font-black text-stone-800 mt-1">
                                                        {auditLogs.filter(l => l.action_type === action).length}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Timeline */}
                                        <div className="rounded-xl border border-stone-100 overflow-hidden">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-stone-50 border-b border-stone-100">
                                                    <tr>
                                                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-stone-500">Timestamp</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-stone-500">Action</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-stone-500">Entity</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-stone-500">Performed By</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-stone-500">Description</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-50">
                                                    {auditLogs.map((log, idx) => (
                                                        <tr key={log.id || idx} className="hover:bg-stone-50 transition-colors">
                                                            <td className="px-4 py-2.5 text-stone-500 font-mono whitespace-nowrap">
                                                                {log.action_timestamp
                                                                    ? new Date(log.action_timestamp).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })
                                                                    : '—'}
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${actionColor[log.action_type] || 'bg-stone-100 text-stone-600'}`}>
                                                                    {log.action_type}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <span className="font-semibold text-stone-700">{log.entity_type}</span>
                                                                {log.entity_id && (
                                                                    <span className="ml-1 text-stone-400 font-mono">
                                                                        #{String(log.entity_id).slice(0, 8)}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-stone-600 font-medium">
                                                                {log.user_name || log.performed_by || 'System'}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-stone-500 max-w-[200px] truncate">
                                                                {log.description || '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {auditLogs.length === 0 && (
                                                        <tr><td colSpan={5}><Empty msg="No audit events recorded for this period" /></td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                    </IOSCard>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
