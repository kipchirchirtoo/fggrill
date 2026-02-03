'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, auditorReportsAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { BranchSelector, useBranch } from '@/lib/branch-context';
import {
    Search, Filter, Loader2, ClipboardList,
    RefreshCw, Utensils, FileDown, ShieldCheck,
    Clock, Info
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface UsageEntry {
    id: string;
    item_name: string;
    item_sku: string;
    quantity: number;
    unit_of_measure: string;
    usage_type: string;
    usage_date: string;
    shift: string;
    notes?: string;
    branch_id: number;
    branch?: { name: string };
    created_at: string;
}

export default function AuditorKitchenUsagePage() {
    const { activeBranchId } = useBranch();
    const [entries, setEntries] = useState<UsageEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchUsage = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await api.kitchen.getUsageEntries(
                activeBranchId === 0 ? undefined : (activeBranchId ?? undefined)
            );
            if (response.success) {
                setEntries(response.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch usage:', error);
            toast.error('Failed to load kitchen usage data');
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId]);

    useEffect(() => {
        fetchUsage();
    }, [fetchUsage]);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            await auditorReportsAPI.exportBrandedPdf('kitchen_usage', {
                branch_id: activeBranchId === 0 ? undefined : activeBranchId,
                type: typeFilter !== 'all' ? typeFilter : undefined
            });
            toast.success("Usage report exported successfully");
        } catch (e) {
            console.error(e);
            toast.error("Failed to export report");
        } finally {
            setIsExporting(false);
        }
    };

    const getUsageBadge = (type: string) => {
        const styles: Record<string, string> = {
            STAFF_MEAL: 'text-blue-600 bg-blue-50',
            COMPLIMENTARY: 'text-emerald-600 bg-emerald-50',
            TEST: 'text-amber-600 bg-amber-50',
            OTHER: 'text-stone-600 bg-stone-50'
        };
        const style = styles[type] || 'text-stone-600 bg-stone-50';
        return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${style}`}>{type.replace('_', ' ')}</span>;
    };

    const filteredEntries = entries.filter(entry =>
        (entry.item_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.item_sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.branch?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    ).filter(entry =>
        typeFilter === 'all' || entry.usage_type === typeFilter
    );

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-8 pb-10">
                    {/* Header */}
                    <div className="page-header flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center text-white shadow-lg">
                                <Utensils className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="page-title text-stone-900">Kitchen Usage Oversight</h1>
                                <p className="page-subtitle text-stone-500">Monitor production entries and internal consumption logs</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-3 bg-white border border-stone-100 rounded-xl px-4 h-[42px] shadow-sm group focus-within:ring-2 focus-within:ring-stone-900/5 transition-all">
                                <Search className="h-4 w-4 text-stone-300 group-focus-within:text-stone-900 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Filter entries..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="text-sm font-bold text-stone-900 outline-none w-40 placeholder:text-stone-300 placeholder:font-semibold"
                                />
                            </div>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="bg-white border border-stone-100 rounded-xl px-4 h-[42px] text-xs font-black uppercase tracking-widest text-stone-500 shadow-sm outline-none focus:ring-2 focus:ring-stone-900/5 transition-all appearance-none cursor-pointer hover:bg-stone-50 pr-10 relative"
                            >
                                <option value="all">Catalog: All Types</option>
                                <option value="STAFF_MEAL">Staff Meal</option>
                                <option value="COMPLIMENTARY">Complimentary</option>
                                <option value="TEST">Test Cooking</option>
                                <option value="OTHER">Other</option>
                            </select>
                            <BranchSelector />
                            <button onClick={handleExport} disabled={isExporting} className="btn-secondary h-[42px]">
                                <FileDown className={`h-4 w-4 ${isExporting ? 'animate-bounce text-blue-500' : ''}`} />
                            </button>
                            <button onClick={fetchUsage} className="btn-primary h-[42px] shadow-lg shadow-stone-900/10">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="ml-2">Sync</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats Highlights */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="stat-card bg-stone-900 text-white border-none shadow-xl shadow-stone-900/10">
                            <div className="stat-icon bg-white/10 text-white border-none">
                                <ClipboardList className="h-5 w-5" />
                            </div>
                            <p className="stat-value text-white">{filteredEntries.length}</p>
                            <p className="stat-label text-stone-400">Total Audit Entries</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon bg-blue-50 text-blue-500">
                                <Utensils className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{entries.filter(e => e.usage_type === 'STAFF_MEAL').length}</p>
                            <p className="stat-label">Staff Consumptions Detected</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon bg-emerald-50 text-emerald-500">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                            <p className="stat-value">Active</p>
                            <p className="stat-label">Station Coverage: 100%</p>
                        </div>
                    </div>

                    {/* Main Table */}
                    <div className="table-container shadow-sm border border-stone-100">
                        <div className="section-header p-5 border-b border-stone-100 bg-stone-50/30">
                            <div className="flex items-center justify-between w-full">
                                <div>
                                    <h2 className="section-title">Usage Records Ledger</h2>
                                    <p className="section-subtitle">Immutable log of manual kitchen production and consumption</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Operational Mode</p>
                                    <span className="badge-info">
                                        {activeBranchId === 0 ? 'Consolidated Audit' : 'Branch Node Audit'}
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
                                        <th className="table-header-cell">Stock Item</th>
                                        <th className="table-header-cell text-center">Protocol Type</th>
                                        <th className="table-header-cell text-right">Quantity</th>
                                        <th className="table-header-cell">Audit Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <Loader2 className="h-10 w-10 animate-spin text-stone-200" />
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Fetching immutable records...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredEntries.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Info className="h-10 w-10 text-stone-100" />
                                                    <p className="text-[11px] font-black uppercase tracking-widest text-stone-300">No anomalous usage detected</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEntries.map((entry) => (
                                            <tr key={entry.id} className="table-row group">
                                                <td className="table-cell">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-stone-900">{format(new Date(entry.usage_date), 'MMM dd, yyyy')}</span>
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
                                                    {getUsageBadge(entry.usage_type)}
                                                </td>
                                                <td className="table-cell text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-lg font-black text-stone-900 leading-none">{entry.quantity}</span>
                                                        <span className="text-[9px] text-stone-400 font-black uppercase tracking-widest mt-1">{entry.unit_of_measure}</span>
                                                    </div>
                                                </td>
                                                <td className="table-cell max-w-[200px]">
                                                    <p className="text-[11px] text-stone-500 font-bold italic line-clamp-2" title={entry.notes}>
                                                        {entry.notes || '—'}
                                                    </p>
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
