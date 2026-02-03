'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import {
    BookOpen, Search, RefreshCw, Filter,
    FileText, CheckCircle, Clock, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

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
    created_at: string;
    status: 'draft' | 'submitted' | 'verified';
    submitted_at?: string;
    branch_id: number;
}

export default function AuditorLedgerPage() {
    const { activeBranchId } = useBranch();
    const [entries, setEntries] = useState<KitchenLedgerEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('submitted');

    useEffect(() => {
        fetchEntries();
    }, [activeBranchId, statusFilter]);

    const fetchEntries = async () => {
        setIsLoading(true);
        try {
            // Fetch submitted entries for the branch
            const response = await api.kitchen.getLedger({
                branch_id: activeBranchId,
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
    };

    const handleVerifyEntry = async (entry: KitchenLedgerEntry) => {
        if (!confirm('Mark this entry as verified?')) return;

        try {
            await api.kitchen.updateLedgerStatus(String(entry.id), 'verified');
            toast.success('Entry verified');
            fetchEntries();
        } catch (error: any) {
            toast.error(error.message || 'Failed to verify entry');
        }
    };

    const handleDownloadReport = async (format: 'pdf' | 'excel') => {
        try {
            toast.success(`Generating ${format.toUpperCase()} report...`);
            await api.auditorReports.exportBrandedPdf('kitchen_ledger', {
                branch_id: activeBranchId,
                format: format,
                status: statusFilter === 'all' ? undefined : statusFilter
            });
            toast.success('Report downloaded');
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to download report');
        }
    };

    const filteredEntries = entries.filter(entry =>
        entry.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.entry_number.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            draft: 'bg-stone-100 text-stone-600 border-stone-200',
            submitted: 'bg-blue-50 text-blue-700 border-blue-200',
            verified: 'bg-green-50 text-green-700 border-green-200'
        };
        const style = styles[status] || styles['draft'];
        return (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${style}`}>
                {status}
            </span>
        );
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="page-title">Kitchen Ledger Audit</h1>
                            <p className="page-subtitle">Review and verify kitchen operations</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleDownloadReport('pdf')}
                                className="btn-secondary"
                            >
                                <FileText className="h-4 w-4" />
                                <span>Export PDF</span>
                            </button>
                            <button
                                onClick={fetchEntries}
                                className="btn-secondary"
                                disabled={isLoading}
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="card-elevated p-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <input
                                    type="text"
                                    placeholder="Search by item or entry number..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="input-field pl-10"
                                />
                            </div>
                            <div className="w-48">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="input-field"
                                >
                                    <option value="all">All Status</option>
                                    <option value="submitted">Submitted</option>
                                    <option value="verified">Verified</option>
                                    <option value="draft">Draft</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="card-elevated overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-stone-50 border-b border-stone-100">
                                    <tr>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Entry Info</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Item</th>
                                        <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Consumption</th>
                                        <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Sales Diff</th>
                                        <th className="px-5 py-3 text-center text-[11px] font-bold text-stone-500 uppercase">Status</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Remarks</th>
                                        <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {isLoading ? (
                                        <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-stone-500">Loading ledger...</td></tr>
                                    ) : filteredEntries.length === 0 ? (
                                        <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-stone-500">No entries found</td></tr>
                                    ) : (
                                        filteredEntries.map((entry) => {
                                            const variance = entry.expected_sales - entry.system_sales;
                                            return (
                                                <tr key={entry.id} className="hover:bg-stone-50/50 transition-colors">
                                                    <td className="px-5 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-[13px] font-medium text-stone-900">{new Date(entry.entry_date).toLocaleDateString()}</span>
                                                            <span className="text-[10px] text-stone-500 font-mono">{entry.entry_number}</span>
                                                            {entry.submitted_at && (
                                                                <span className="text-[10px] text-stone-400 flex items-center gap-1 mt-0.5">
                                                                    <Clock className="w-3 h-3" />
                                                                    {new Date(entry.submitted_at).toLocaleTimeString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <p className="text-[13px] font-semibold text-stone-900">{entry.item_name}</p>
                                                        <p className="text-[10px] text-stone-500">{entry.unit_of_measure}</p>
                                                    </td>
                                                    <td className="px-5 py-3 text-right">
                                                        <div className="flex flex-col text-[12px]">
                                                            <span className="text-stone-600">Used: {entry.used_quantity.toFixed(2)}</span>
                                                            <span className="text-red-500">Waste: {entry.wastage_quantity.toFixed(2)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className={`text-[13px] font-bold ${variance > 0 ? 'text-red-600' : variance < 0 ? 'text-green-600' : 'text-stone-400'}`}>
                                                                {variance > 0 ? '-' : '+'} KES {Math.abs(variance).toLocaleString()}
                                                            </span>
                                                            <span className="text-[10px] text-stone-400">Exp: {entry.expected_sales.toLocaleString()}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3 text-center">
                                                        {getStatusBadge(entry.status || 'draft')}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <p className="text-[12px] text-stone-600 italic truncate max-w-[150px]" title={entry.remarks}>
                                                            {entry.remarks || '-'}
                                                        </p>
                                                    </td>
                                                    <td className="px-5 py-3 text-right">
                                                        {entry.status === 'submitted' && (
                                                            <button
                                                                onClick={() => handleVerifyEntry(entry)}
                                                                className="btn-primary py-1 px-2 text-xs h-8"
                                                            >
                                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                                Verify
                                                            </button>
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
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
