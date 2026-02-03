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
    Clock, Info
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
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Trash2 className="h-4 w-4 text-stone-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Loss Prevention</span>
                            </div>
                            <h1 className="text-2xl font-black text-stone-900 tracking-tight leading-none">Kitchen Wastage Oversight</h1>
                            <p className="text-stone-500 text-sm mt-2 font-medium">Monitor and analyze kitchen spoilage and wastage loss</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-4 py-2 shadow-sm">
                                <Search className="h-4 w-4 text-stone-400" />
                                <input
                                    type="text"
                                    placeholder="Search records..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="text-sm font-bold text-stone-700 outline-none w-40"
                                />
                            </div>
                            <select
                                value={reasonFilter}
                                onChange={(e) => setReasonFilter(e.target.value)}
                                className="bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm font-bold text-stone-700 shadow-sm outline-none"
                            >
                                <option value="all">All Reasons</option>
                                <option value="SPOILAGE">Spoilage</option>
                                <option value="OVERCOOKING">Overcooking</option>
                                <option value="CONTAMINATION">Contamination</option>
                                <option value="EXPIRED">Expired</option>
                                <option value="DROPPED">Dropped</option>
                                <option value="OTHER">Other</option>
                            </select>
                            <BranchSelector />
                            <button onClick={handleExport} disabled={isExporting} className="p-2.5 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors shadow-sm">
                                <FileDown className={`h-4 w-4 text-stone-600 ${isExporting ? 'animate-bounce' : ''}`} />
                            </button>
                            <button onClick={fetchWastage} className="p-2.5 bg-stone-900 rounded-xl hover:bg-stone-800 transition-colors shadow-sm">
                                <RefreshCw className={`h-4 w-4 text-white ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Stats Highlights */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="card-elevated p-6 bg-rose-600 text-white shadow-rose-200/50">
                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-200 mb-1">Total Loss Value</p>
                            <h3 className="text-2xl font-black italic">KES {totalValue.toLocaleString()}</h3>
                            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-rose-200 uppercase tracking-widest">Wastage Impact</span>
                                <AlertTriangle className="h-4 w-4 text-rose-200" />
                            </div>
                        </div>
                        <div className="card-elevated p-6 bg-white border border-stone-100 flex flex-col justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Spoilage Incidents</p>
                                <h3 className="text-2xl font-black text-stone-900">
                                    {entries.filter(e => e.reason === 'SPOILAGE').length} <span className="text-xs font-bold text-stone-400">cases</span>
                                </h3>
                            </div>
                            <p className="text-[11px] text-stone-400 font-medium">Critical storage or handling issues</p>
                        </div>
                        <div className="card-elevated p-6 bg-white border border-stone-100 flex flex-col justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Oversight Status</p>
                                <h3 className="text-2xl font-black text-stone-900 flex items-center gap-2">
                                    Secure <ShieldAlert className="h-5 w-5 text-emerald-500" />
                                </h3>
                            </div>
                            <p className="text-[11px] text-stone-400 font-medium leading-tight">All waste accurately logged for {format(new Date(), 'MMM yyyy')}</p>
                        </div>
                    </div>

                    {/* Main Table */}
                    <div className="card-elevated p-0 bg-white shadow-xl shadow-stone-200/50 overflow-hidden">
                        <div className="p-6 border-b border-stone-100 bg-stone-50/30 flex items-center justify-between">
                            <h3 className="text-[16px] font-black text-stone-900 flex items-center gap-2">
                                <Info className="h-4 w-4 text-stone-400" />
                                Spoilage & Wastage Log
                            </h3>
                            <p className="text-[11px] text-stone-400 font-bold uppercase tracking-widest">
                                {activeBranchId === 0 ? 'Consolidated View' : 'Branch Specific Audit'}
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-stone-50 text-[10px] font-black uppercase tracking-widest text-stone-400 border-b border-stone-100">
                                    <tr>
                                        <th className="px-6 py-4">Date & Time</th>
                                        <th className="px-6 py-4">Branch</th>
                                        <th className="px-6 py-4">Item Details</th>
                                        <th className="px-6 py-4 text-center">Reason</th>
                                        <th className="px-6 py-4 text-right">Quantity / Value</th>
                                        <th className="px-6 py-4 text-center">Shift</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-20 text-center">
                                                <Loader2 className="h-8 w-8 animate-spin text-stone-200 mx-auto" />
                                            </td>
                                        </tr>
                                    ) : filteredEntries.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-20 text-center text-stone-300 text-sm italic">
                                                No wastage records found for this selection
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEntries.map((entry) => (
                                            <tr key={entry.id} className="hover:bg-stone-50/50 transition-colors group">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-[13px] font-bold text-stone-900">{format(new Date(entry.wastage_date || entry.created_at), 'MMM dd, yyyy')}</span>
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
                                                    {getReasonBadge(entry.reason)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[15px] font-black text-stone-900">{entry.quantity} <span className="text-[10px] text-stone-400 uppercase">{entry.unit_of_measure}</span></span>
                                                        <span className="text-[11px] text-rose-600 font-bold bg-rose-50 px-1.5 rounded tracking-tighter">KES {entry.estimated_value?.toLocaleString()}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-[12px] font-bold text-stone-500 italic opacity-80">{entry.shift || 'N/A'}</span>
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
