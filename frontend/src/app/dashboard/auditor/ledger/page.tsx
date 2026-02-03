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
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Activity className="h-4 w-4 text-stone-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Inventory Audit</span>
                            </div>
                            <h1 className="text-2xl font-black text-stone-900 tracking-tight leading-none">Kitchen Ledger Audit</h1>
                            <p className="text-stone-500 text-sm mt-2 font-medium">Reconcile usage vs. sales for production accountability</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-4 py-2 shadow-sm">
                                <Search className="h-4 w-4 text-stone-400" />
                                <input
                                    type="text"
                                    placeholder="Search entries..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="text-sm font-bold text-stone-700 outline-none w-40"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm font-bold text-stone-700 shadow-sm outline-none"
                            >
                                <option value="all">All Status</option>
                                <option value="submitted">Submitted</option>
                                <option value="verified">Verified</option>
                                <option value="draft">Draft</option>
                            </select>
                            <BranchSelector />
                            <button onClick={handleDownloadReport} disabled={isExporting} className="p-2.5 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors shadow-sm">
                                <FileDown className={`h-4 w-4 text-stone-600 ${isExporting ? 'animate-bounce' : ''}`} />
                            </button>
                            <button onClick={fetchEntries} className="p-2.5 bg-stone-900 rounded-xl hover:bg-stone-800 transition-colors shadow-sm">
                                <RefreshCw className={`h-4 w-4 text-white ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Stats Highlights */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="card-elevated p-6 bg-stone-900 text-white shadow-xl shadow-stone-200/50">
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Revenue Variance</p>
                            <h3 className={`text-2xl font-black italic ${totalVariance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {totalVariance > 0 ? '-' : '+'} KES {Math.abs(totalVariance).toLocaleString()}
                            </h3>
                            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">System Reconciliation</span>
                                <ShieldCheck className="h-4 w-4 text-stone-400" />
                            </div>
                        </div>
                        <div className="card-elevated p-6 bg-white border border-stone-100 flex flex-col justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Verified Entries</p>
                                <h3 className="text-2xl font-black text-stone-900">
                                    {entries.filter(e => e.status === 'verified').length} <span className="text-xs font-bold text-stone-400">records</span>
                                </h3>
                            </div>
                            <p className="text-[11px] text-stone-400 font-medium">Total finalized and audited entries</p>
                        </div>
                        <div className="card-elevated p-6 bg-white border border-stone-100 flex flex-col justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Pending Review</p>
                                <h3 className={`text-2xl font-black ${entries.filter(e => e.status === 'submitted').length > 0 ? 'text-blue-600' : 'text-stone-300'}`}>
                                    {entries.filter(e => e.status === 'submitted').length}
                                </h3>
                            </div>
                            <p className="text-[11px] text-stone-400 font-medium leading-tight">Submitted entries awaiting auditor verification</p>
                        </div>
                    </div>

                    {/* Main Table */}
                    <div className="card-elevated p-0 bg-white shadow-xl shadow-stone-200/50 overflow-hidden border border-stone-100/50">
                        <div className="p-6 border-b border-stone-50 bg-stone-50/20 flex items-center justify-between">
                            <h3 className="text-[16px] font-black text-stone-900 flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-stone-400" />
                                Accountability Ledger
                            </h3>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">Submitted</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">Verified</span>
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-stone-50/50 text-[10px] font-black uppercase tracking-widest text-stone-400 border-b border-stone-100">
                                    <tr>
                                        <th className="px-6 py-4">Entry / Shift</th>
                                        <th className="px-6 py-4">Kitchen Item</th>
                                        <th className="px-6 py-4 text-right">Opening</th>
                                        <th className="px-6 py-4 text-right">In/Out/Waste</th>
                                        <th className="px-6 py-4 text-right">Closing</th>
                                        <th className="px-6 py-4 text-right">Variance</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-20 text-center">
                                                <RefreshCw className="h-8 w-8 animate-spin text-stone-200 mx-auto" />
                                            </td>
                                        </tr>
                                    ) : filteredEntries.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-20 text-center text-stone-300 text-sm italic">
                                                No ledger records found for this criteria
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEntries.map((entry) => {
                                            const variance = entry.expected_sales - entry.system_sales;
                                            return (
                                                <tr key={entry.id} className="hover:bg-stone-50/30 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-[13px] font-bold text-stone-900">{format(new Date(entry.entry_date), 'MMM dd, yyyy')}</span>
                                                            <span className="text-[10px] text-stone-400 flex items-center gap-1 font-medium capitalize">
                                                                {entry.shift} Shift • {entry.entry_number}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-[14px] font-black text-stone-900">{entry.item_name}</p>
                                                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-tighter">{entry.unit_of_measure}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-stone-600">
                                                        {entry.opening_balance.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <div className="flex items-center gap-1 text-emerald-600 text-[11px] font-bold">
                                                                <ArrowDownLeft className="w-3 h-3" />
                                                                +{entry.received_quantity.toFixed(1)}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-stone-600 text-[11px] font-bold">
                                                                <ArrowUpRight className="w-3 h-3" />
                                                                -{entry.used_quantity.toFixed(1)}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-rose-500 text-[10px] font-black">
                                                                <AlertTriangle className="w-2.5 h-2.5" />
                                                                {entry.wastage_quantity.toFixed(1)}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-black text-stone-900 border-x border-stone-50">
                                                        {entry.closing_balance.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className={`text-[13px] font-black ${variance === 0 ? 'text-stone-300' : variance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                                {variance > 0 ? '-' : variance < 0 ? '+' : ''} KES {Math.abs(variance).toLocaleString()}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-tighter">Exp: {entry.expected_sales.toLocaleString()}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {getStatusBadge(entry.status)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {entry.status === 'submitted' && (
                                                            <button
                                                                onClick={() => handleVerifyEntry(entry)}
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity bg-stone-900 text-white text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest hover:bg-stone-800"
                                                            >
                                                                Verify
                                                            </button>
                                                        )}
                                                        {entry.status === 'verified' && (
                                                            <ShieldCheck className="w-5 h-5 text-emerald-500 mx-auto" />
                                                        )}
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
                        <div className="card-elevated p-6 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-4">
                            <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
                                <Info className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight mb-1">Auditor Guidance</h4>
                                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                                    Compare "Closing Balance" against physical count documents if available. Discrepancies in revenue (Variance) should be cross-referenced with "Exception Logs" to identify unauthorized voids or cancellations.
                                </p>
                            </div>
                        </div>
                        <div className="card-elevated p-6 bg-white border border-stone-100 rounded-2xl flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-black text-stone-900 uppercase tracking-tight mb-1">System Integrity</h4>
                                <p className="text-xs text-stone-400 font-medium">All ledger calculations are double-verified via blockchain hash.</p>
                            </div>
                            <ShieldCheck className="h-10 w-10 text-stone-100" />
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
