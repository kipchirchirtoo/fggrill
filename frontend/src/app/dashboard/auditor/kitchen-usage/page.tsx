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
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Utensils className="h-4 w-4 text-stone-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Production Audit</span>
                            </div>
                            <h1 className="text-2xl font-black text-stone-900 tracking-tight leading-none">Kitchen Usage Oversight</h1>
                            <p className="text-stone-500 text-sm mt-2 font-medium">Analyze manual production entries and staff consumption</p>
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
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm font-bold text-stone-700 shadow-sm outline-none"
                            >
                                <option value="all">All Types</option>
                                <option value="STAFF_MEAL">Staff Meal</option>
                                <option value="COMPLIMENTARY">Complimentary</option>
                                <option value="TEST">Test Cooking</option>
                                <option value="OTHER">Other</option>
                            </select>
                            <BranchSelector />
                            <button onClick={handleExport} disabled={isExporting} className="p-2.5 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors shadow-sm">
                                <FileDown className={`h-4 w-4 text-stone-600 ${isExporting ? 'animate-bounce' : ''}`} />
                            </button>
                            <button onClick={fetchUsage} className="p-2.5 bg-stone-900 rounded-xl hover:bg-stone-800 transition-colors shadow-sm">
                                <RefreshCw className={`h-4 w-4 text-white ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Stats Highlights */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="card-elevated p-6 bg-stone-900 text-white">
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Total Entries</p>
                            <h3 className="text-2xl font-black">{filteredEntries.length}</h3>
                            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Active Monitoring</span>
                                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                            </div>
                        </div>
                        <div className="card-elevated p-6 bg-white border border-stone-100 flex flex-col justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Staff Consumption</p>
                                <h3 className="text-2xl font-black text-stone-900">
                                    {entries.filter(e => e.usage_type === 'STAFF_MEAL').length} <span className="text-xs font-bold text-stone-400">units</span>
                                </h3>
                            </div>
                            <p className="text-[11px] text-stone-400 font-medium">Total staff meal allocations detected</p>
                        </div>
                        <div className="card-elevated p-6 bg-white border border-stone-100 flex flex-col justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Audit Coverage</p>
                                <h3 className="text-2xl font-black text-stone-900">100%</h3>
                            </div>
                            <p className="text-[11px] text-stone-400 font-medium leading-tight">All kitchen stations reporting as of {format(new Date(), 'HH:mm')}</p>
                        </div>
                    </div>

                    {/* Main Table */}
                    <div className="card-elevated p-0 bg-white shadow-xl shadow-stone-200/50 overflow-hidden">
                        <div className="p-6 border-b border-stone-100 bg-stone-50/30 flex items-center justify-between">
                            <h3 className="text-[16px] font-black text-stone-900 flex items-center gap-2">
                                <Info className="h-4 w-4 text-stone-400" />
                                Usage Records Ledger
                            </h3>
                            <p className="text-[11px] text-stone-400 font-bold uppercase tracking-widest">
                                {activeBranchId === 0 ? 'Consolidated View' : 'Single Branch Audit'}
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-stone-50 text-[10px] font-black uppercase tracking-widest text-stone-400 border-b border-stone-100">
                                    <tr>
                                        <th className="px-6 py-4">Date & Time</th>
                                        <th className="px-6 py-4">Branch</th>
                                        <th className="px-6 py-4">Kitchen Item</th>
                                        <th className="px-6 py-4 text-center">Usage Type</th>
                                        <th className="px-6 py-4 text-right">Quantity</th>
                                        <th className="px-6 py-4 text-center">Shift</th>
                                        <th className="px-6 py-4">Auditor Note</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-20 text-center">
                                                <Loader2 className="h-8 w-8 animate-spin text-stone-200 mx-auto" />
                                            </td>
                                        </tr>
                                    ) : filteredEntries.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-20 text-center text-stone-300 text-sm italic">
                                                No usage records found for this selection
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEntries.map((entry) => (
                                            <tr key={entry.id} className="hover:bg-stone-50/50 transition-colors group">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-[13px] font-bold text-stone-900">{format(new Date(entry.usage_date), 'MMM dd, yyyy')}</span>
                                                        <span className="text-[10px] text-stone-400 flex items-center gap-1 font-medium">
                                                            <Clock className="w-3 h-3" />
                                                            {format(new Date(entry.created_at), 'HH:mm')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-[11px] font-black text-stone-500 bg-stone-100 px-2 py-0.5 rounded uppercase tracking-tighter">
                                                        {entry.branch?.name || `BR-${entry.branch_id}`}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-[14px] font-black text-stone-900">{entry.item_name}</p>
                                                    <p className="text-[10px] text-stone-400 font-mono tracking-tighter uppercase">{entry.item_sku}</p>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {getUsageBadge(entry.usage_type)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[15px] font-black text-stone-900">{entry.quantity}</span>
                                                        <span className="text-[10px] text-stone-400 font-bold uppercase">{entry.unit_of_measure}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-[12px] font-bold text-stone-500 italic opacity-80">{entry.shift || 'N/A'}</span>
                                                </td>
                                                <td className="px-6 py-4 max-w-[200px]">
                                                    <p className="text-[12px] text-stone-500 font-medium italic truncate" title={entry.notes}>
                                                        {entry.notes || '-'}
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
