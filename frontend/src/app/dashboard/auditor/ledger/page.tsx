'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBranch, BranchSelector } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UserRole } from '@/lib/auth-context';
import {
    BookOpen, Search, RefreshCw, Filter,
    FileText, CheckCircle, Clock, AlertCircle, AlertTriangle,
    ArrowUpRight, ArrowDownLeft, Info, FileDown,
    ShieldCheck, Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { api, auditorReportsAPI } from '@/lib/api';
import { format } from 'date-fns';

interface KitchenLedgerEntry {
    id: number;
    entry_number: string;
    entry_date: string;
    item_id: string;
    item_name: string;
    opening_balance: number;
    received_quantity: number;
    used_quantity: number;
    wastage_quantity: number;
    closing_balance: number;
    expected_sales: number;
    system_sales: number;
    unit_of_measure: string;
    remarks: string;
    shift: string;
    created_at: string;
    status: 'draft' | 'submitted' | 'verified';
    submitted_at?: string;
    branch_id: number;
}

export default function AuditorLedgerPage() {
    const { activeBranchId } = useBranch();
    const [entries, setEntries] = useState<KitchenLedgerEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('submitted');

    const fetchEntries = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await api.kitchen.getLedger({
                branch_id: activeBranchId === 0 ? undefined : (activeBranchId ?? undefined),
                status: statusFilter === 'all' ? undefined : statusFilter
            });
            if (response.success) {
                setEntries(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching ledger:', error);
            toast.error('Failed to load ledger entries');
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId, statusFilter]);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    const handleVerifyEntry = async (entry: KitchenLedgerEntry) => {
        try {
            const response = await api.kitchen.updateLedgerStatus(String(entry.id), 'verified');
            if (response.success) {
                toast.success('Entry verified successfully');
                fetchEntries();
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to verify entry');
        }
    };

    const handleDownloadReport = async () => {
        setIsExporting(true);
        try {
            await auditorReportsAPI.exportBrandedPdf('kitchen_ledger', {
                branch_id: activeBranchId === 0 ? undefined : (activeBranchId ?? undefined),
                status: statusFilter === 'all' ? undefined : statusFilter
            });
            toast.success('Report downloaded');
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to download report');
        } finally {
            setIsExporting(false);
        }
    };

    const filteredEntries = entries.filter(entry =>
        (entry.item_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.entry_number || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            draft: 'bg-stone-100 text-stone-500',
            submitted: 'bg-blue-50 text-blue-600',
            verified: 'bg-emerald-50 text-emerald-600'
        };
        const style = styles[status] || styles['draft'];
        return (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${style}`}>
                {status}
            </span>
        );
    };

    const totalVariance = filteredEntries.reduce((sum, e) => sum + (e.expected_sales - e.system_sales), 0);

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="space-y-8 pb-10">
                    {/* Header */}
                    <div className="page-header flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center text-white shadow-lg">
                                <Activity className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="page-title text-stone-900">Kitchen Ledger Audit</h1>
                                <p className="page-subtitle">Reconcile usage vs. sales for production accountability</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-stone-100/50 border border-stone-200 rounded-xl px-3 py-1.5 shadow-sm h-10">
                                <Search className="h-3.5 w-3.5 text-stone-400" />
                                <input
                                    type="text"
                                    placeholder="Search entries..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="text-[12px] font-semibold text-stone-700 bg-transparent outline-none w-40"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-stone-100/50 border border-stone-200 rounded-xl px-3 py-1.5 text-[12px] font-semibold text-stone-700 shadow-sm outline-none h-10"
                            >
                                <option value="all">All Status</option>
                                <option value="submitted">Submitted</option>
                                <option value="verified">Verified</option>
                                <option value="draft">Draft</option>
                            </select>
                            <BranchSelector />
                            <button onClick={handleDownloadReport} disabled={isExporting} className="btn-secondary">
                                <FileDown className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
                            </button>
                            <button onClick={fetchEntries} className="btn-primary">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Stats Highlights */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className={`stat-card ${totalVariance > 0 ? 'bg-rose-900 text-white shadow-rose-900/10' : 'bg-stone-900 text-white shadow-stone-900/10'} border-none shadow-xl`}>
                            <div className="stat-icon bg-white/10 text-white border-none">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <p className="stat-value text-white">KES {Math.abs(totalVariance).toLocaleString()}</p>
                            <p className="stat-label text-stone-400">Total Revenue Variance</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon bg-emerald-50 text-emerald-500">
                                <CheckCircle className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{entries.filter(e => e.status === 'verified').length}</p>
                            <p className="stat-label">Verified Records</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon bg-blue-50 text-blue-500">
                                <Clock className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{entries.filter(e => e.status === 'submitted').length}</p>
                            <p className="stat-label">Pending Verification</p>
                        </div>
                    </div>

                    {/* Main Table */}
                    <div className="table-container shadow-sm border border-stone-100">
                        <div className="section-header p-5 border-b border-stone-100">
                            <div>
                                <h2 className="section-title">Accountability Ledger</h2>
                                <p className="section-subtitle">Real-time reconciliation of production usage vs. system sales</p>
                            </div>
                        </div>
                        <div className="table-responsive">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="table-header">
                                        <th className="table-header-cell">Entry / Shift</th>
                                        <th className="table-header-cell">Kitchen Item</th>
                                        <th className="table-header-cell text-right">Opening</th>
                                        <th className="table-header-cell text-right">In/Out/Waste</th>
                                        <th className="table-header-cell text-right">Closing</th>
                                        <th className="table-header-cell text-right">Variance</th>
                                        <th className="table-header-cell text-center">Status</th>
                                        <th className="table-header-cell"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-2 opacity-50">
                                                    <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
                                                    <span className="text-[11px] font-black uppercase tracking-widest text-stone-400">Syncing ledger records...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredEntries.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-20 text-center">
                                                <span className="text-[11px] font-black uppercase tracking-widest text-stone-300">No records found</span>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEntries.map((entry) => {
                                            const variance = entry.expected_sales - entry.system_sales;
                                            return (
                                                <tr key={entry.id} className="table-row group">
                                                    <td className="table-cell">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-stone-900">{format(new Date(entry.entry_date), 'MMM dd, yyyy')}</span>
                                                            <span className="text-[10px] text-stone-400 flex items-center gap-1 font-semibold capitalize tracking-tight">
                                                                {entry.shift} Shift • {entry.entry_number}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="table-cell">
                                                        <p className="font-bold text-stone-900">{entry.item_name}</p>
                                                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{entry.unit_of_measure}</p>
                                                    </td>
                                                    <td className="table-cell text-right font-semibold text-stone-600">
                                                        {entry.opening_balance.toFixed(2)}
                                                    </td>
                                                    <td className="table-cell text-right">
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold">
                                                                <ArrowDownLeft className="w-3 h-3" />
                                                                +{entry.received_quantity.toFixed(1)}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-stone-600 text-[10px] font-bold">
                                                                <ArrowUpRight className="w-3 h-3" />
                                                                -{entry.used_quantity.toFixed(1)}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-rose-500 text-[9px] font-black tracking-tighter">
                                                                <AlertTriangle className="w-2.5 h-2.5" />
                                                                {entry.wastage_quantity.toFixed(1)}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="table-cell text-right font-bold text-stone-900">
                                                        {entry.closing_balance.toFixed(2)}
                                                    </td>
                                                    <td className="table-cell text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className={`font-bold ${variance === 0 ? 'text-stone-300' : variance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                                {variance > 0 ? '-' : variance < 0 ? '+' : ''} KES {Math.abs(variance).toLocaleString()}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest opacity-60">Exp: {entry.expected_sales.toLocaleString()}</span>
                                                        </div>
                                                    </td>
                                                    <td className="table-cell text-center">
                                                        <span className={
                                                            entry.status === 'verified' ? 'badge-success' :
                                                                entry.status === 'submitted' ? 'badge-info' :
                                                                    'badge-warning'
                                                        }>
                                                            {entry.status}
                                                        </span>
                                                    </td>
                                                    <td className="table-cell text-right">
                                                        <div className="flex justify-end pr-2">
                                                            {entry.status === 'submitted' && (
                                                                <button
                                                                    onClick={() => handleVerifyEntry(entry)}
                                                                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-stone-900 text-white text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest hover:bg-stone-800 shadow-lg shadow-stone-900/10"
                                                                >
                                                                    Verify
                                                                </button>
                                                            )}
                                                            {entry.status === 'verified' && (
                                                                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                                                                    <ShieldCheck className="w-4 h-4" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="card-elevated p-6 bg-amber-50/50 border border-amber-100 flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                <Info className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-stone-900 uppercase tracking-tight mb-1">Auditor Guidance</h4>
                                <p className="text-xs text-stone-600 font-medium leading-relaxed">
                                    Compare "Closing Balance" against physical count documents if available. Discrepancies in revenue (Variance) should be cross-referenced with "Exception Logs" to identify unauthorized voids or cancellations.
                                </p>
                            </div>
                        </div>
                        <div className="card-elevated p-6 bg-white border border-stone-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center text-stone-500 shrink-0">
                                    <ShieldCheck className="h-6 w-6" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-stone-900 uppercase tracking-tight mb-1">System Integrity</h4>
                                    <p className="text-xs text-stone-400 font-medium">All ledger calculations are double-verified via system production logs.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
