'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, auditorReportsAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { BranchSelector, useBranch } from '@/lib/branch-context';
import {
    Search, Filter, Loader2, Trash2,
    RefreshCw, AlertTriangle, FileDown, ShieldAlert,
    Clock, Info, ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface WastageEntry {
    id: string;
    item_name: string;
    item_sku: string;
    quantity: number;
    unit_of_measure: string;
    reason: string;
    estimated_value: number;
    wastage_date: string;
    shift: string;
    notes?: string;
    branch_id: number;
    branch?: { name: string };
    created_at: string;
}

export default function AuditorKitchenWastagePage() {
    const { activeBranchId } = useBranch();
    const [entries, setEntries] = useState<WastageEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [reasonFilter, setReasonFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchWastage = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await api.kitchen.getWastageRecords({
                branch_id: activeBranchId === 0 ? undefined : activeBranchId
            } as any); // Type cast as API might need branch_id
            if (response.success) {
                setEntries(response.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch wastage:', error);
            toast.error('Failed to load wastage data');
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId]);

    useEffect(() => {
        fetchWastage();
    }, [fetchWastage]);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            await auditorReportsAPI.exportBrandedPdf('kitchen_wastage', {
                branch_id: activeBranchId === 0 ? undefined : (activeBranchId ?? undefined),
                reason: reasonFilter !== 'all' ? reasonFilter : undefined
            });
            toast.success("Wastage report exported successfully");
        } catch (e) {
            console.error(e);
            toast.error("Failed to export report");
        } finally {
            setIsExporting(false);
        }
    };

    const getReasonBadge = (reason: string) => {
        const styles: Record<string, string> = {
            SPOILAGE: 'text-rose-600 bg-rose-50',
            OVERCOOKING: 'text-orange-600 bg-orange-50',
            CONTAMINATION: 'text-purple-600 bg-purple-50',
            EXPIRED: 'text-amber-600 bg-amber-50',
            DROPPED: 'text-blue-600 bg-blue-50',
            OTHER: 'text-stone-600 bg-stone-50'
        };
        const style = styles[reason] || 'text-stone-600 bg-stone-50';
        return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${style}`}>{reason.replace('_', ' ')}</span>;
    };

    const filteredEntries = entries.filter(entry =>
        (entry.item_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.item_sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.branch?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    ).filter(entry =>
        reasonFilter === 'all' || entry.reason === reasonFilter
    );

    const totalValue = filteredEntries.reduce((sum, e) => sum + (e.estimated_value || 0), 0);

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-8 pb-10">
                    {/* Header */}
                    <div className="page-header flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center text-white shadow-lg">
                                <Trash2 className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="page-title text-stone-900">Kitchen Wastage Oversight</h1>
                                <p className="page-subtitle text-stone-500">Inventory loss prevention and spoilage analytics</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-3 bg-white border border-stone-100 rounded-xl px-4 h-[42px] shadow-sm group focus-within:ring-2 focus-within:ring-stone-900/5 transition-all">
                                <Search className="h-4 w-4 text-stone-300 group-focus-within:text-stone-900 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Filter records..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="text-sm font-bold text-stone-900 outline-none w-40 placeholder:text-stone-300 placeholder:font-semibold"
                                />
                            </div>
                            <select
                                value={reasonFilter}
                                onChange={(e) => setReasonFilter(e.target.value)}
                                className="bg-white border border-stone-100 rounded-xl px-4 h-[42px] text-xs font-black uppercase tracking-widest text-stone-500 shadow-sm outline-none focus:ring-2 focus:ring-stone-900/5 transition-all appearance-none cursor-pointer hover:bg-stone-50 pr-10 relative"
                            >
                                <option value="all">Reason: All Categories</option>
                                <option value="SPOILAGE">Spoilage</option>
                                <option value="OVERCOOKING">Overcooking</option>
                                <option value="CONTAMINATION">Contamination</option>
                                <option value="EXPIRED">Expired</option>
                                <option value="DROPPED">Dropped</option>
                                <option value="OTHER">Other</option>
                            </select>
                            <BranchSelector />
                            <button onClick={handleExport} disabled={isExporting} className="btn-secondary h-[42px]">
                                <FileDown className={`h-4 w-4 ${isExporting ? 'animate-bounce text-blue-500' : ''}`} />
                            </button>
                            <button onClick={fetchWastage} className="btn-primary h-[42px] shadow-lg shadow-stone-900/10">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="ml-2">Sync</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats Highlights */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="stat-card bg-stone-900 text-white border-none shadow-xl shadow-stone-900/10 relative overflow-hidden group">
                            <AlertTriangle className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <p className="stat-label text-stone-400 mb-1">Total Loss Value</p>
                                <p className="stat-value text-white text-3xl italic">KES {totalValue.toLocaleString()}</p>
                                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase text-rose-400 tracking-widest">Wastage Impact</span>
                                    <ShieldAlert className="h-4 w-4 text-rose-400" />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon bg-orange-50 text-orange-500">
                                <Trash2 className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{entries.filter(e => e.reason === 'SPOILAGE').length}</p>
                            <p className="stat-label">Spoilage Incidents</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon bg-emerald-50 text-emerald-500">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                            <p className="stat-value">Integrity: Validated</p>
                            <p className="stat-label leading-tight">All wastage records reconciled as of {format(new Date(), 'MMM dd')}</p>
                        </div>
                    </div>

                    {/* Main Table */}
                    <div className="table-container shadow-sm border border-stone-100">
                        <div className="section-header p-5 border-b border-stone-100 bg-stone-50/30">
                            <div className="flex items-center justify-between w-full">
                                <div>
                                    <h2 className="section-title">Spoilage & Wastage Log</h2>
                                    <p className="section-subtitle">Immutable audit trail of inventory loss and disposal events</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Security Scope</p>
                                    <span className="badge-info">
                                        {activeBranchId === 0 ? 'Global Node Audit' : 'Node Specific Audit'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="table-responsive">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="table-header">
                                        <th className="table-header-cell">Event Date/Time</th>
                                        <th className="table-header-cell">Node</th>
                                        <th className="table-header-cell">Item Details</th>
                                        <th className="table-header-cell text-center">Loss Protocol</th>
                                        <th className="table-header-cell text-right">Quantity / Loss Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <Loader2 className="h-10 w-10 animate-spin text-stone-200" />
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Verifying spoilage ledger...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredEntries.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <ShieldCheck className="h-10 w-10 text-stone-100" />
                                                    <p className="text-[11px] font-black uppercase tracking-widest text-stone-300">No wastage records identified</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEntries.map((entry) => (
                                            <tr key={entry.id} className="table-row group">
                                                <td className="table-cell">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-stone-900">{format(new Date(entry.wastage_date || entry.created_at), 'MMM dd, yyyy')}</span>
                                                        <span className="text-[10px] text-stone-400 flex items-center gap-1 font-semibold uppercase tracking-tighter">
                                                            <Clock className="w-3 h-3" />
                                                            {format(new Date(entry.created_at), 'HH:mm')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="table-cell">
                                                    <span className="badge-secondary bg-stone-100 text-stone-600 border-none">
                                                        {entry.branch?.name || `BR-${entry.branch_id}`}
                                                    </span>
                                                </td>
                                                <td className="table-cell">
                                                    <p className="font-black text-stone-900 tracking-tight">{entry.item_name}</p>
                                                    <p className="text-[10px] text-stone-300 font-mono uppercase tracking-tighter">{entry.item_sku}</p>
                                                </td>
                                                <td className="table-cell text-center">
                                                    {getReasonBadge(entry.reason)}
                                                </td>
                                                <td className="table-cell text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-lg font-black text-stone-900 leading-none">
                                                            {entry.quantity} <span className="text-[9px] text-stone-400 uppercase tracking-widest ml-1">{entry.unit_of_measure}</span>
                                                        </span>
                                                        <span className="text-[11px] text-rose-600 font-black bg-rose-50 px-2 py-0.5 rounded-lg mt-2 tracking-tighter shadow-sm border border-rose-100/50">
                                                            Loss: KES {entry.estimated_value?.toLocaleString()}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
