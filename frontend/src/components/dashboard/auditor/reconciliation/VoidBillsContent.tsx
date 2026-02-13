'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
    XCircle, CheckCircle, Search, Filter,
    Download, Clock, AlertTriangle, FileText,
    ArrowRight, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';

interface VoidBillsContentProps {
    branchId: number | null;
}

export function VoidBillsContent({ branchId }: VoidBillsContentProps) {
    const [voidBills, setVoidBills] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [processingId, setProcessingId] = useState<string | null>(null);

    const loadData = async () => {
        if (!branchId) return;
        setIsLoading(true);
        try {
            const res = await api.staff.simplePayroll.auditor.getVoidBills({
                branch_id: branchId,
                status: statusFilter === 'all' ? undefined : statusFilter
            });

            if (res.success && Array.isArray(res.data)) {
                setVoidBills(res.data);
            }
        } catch (error) {
            console.error('Error loading void bills', error);
            toast.error('Failed to load void bills');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [branchId, statusFilter]);

    const handleReview = async (id: string, status: 'reviewed' | 'disputed') => {
        const notes = prompt(`Enter ${status} notes (optional):`);
        if (notes === null) return;

        setProcessingId(id);
        try {
            const res = await api.staff.simplePayroll.auditor.reviewVoidBill(id, {
                status,
                notes: notes || undefined
            });

            if (res.success) {
                toast.success(`Bill marked as ${status}`);
                loadData();
            } else {
                toast.error(res.message || `Failed to mark bill as ${status}`);
            }
        } catch (error) {
            console.error('Review error', error);
            toast.error('An error occurred during review');
        } finally {
            setProcessingId(null);
        }
    };

    const filteredBills = voidBills.filter(bill =>
        bill.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bill.waiter_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="p-12 text-center">
                <div className="inline-block animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mb-4"></div>
                <p className="text-stone-500">Loading void bills for audit...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search & Filter */}
            <div className="flex flex-col md:flex-row gap-4 p-4 bg-stone-50 border-b border-stone-200">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <input
                        type="text"
                        placeholder="Search order # or waiter name..."
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending Review</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="disputed">Disputed</option>
                    </select>
                    <button className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50">
                        <Download className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-stone-500 uppercase bg-stone-50/50">
                        <tr>
                            <th className="px-4 py-3 font-medium">Order Details</th>
                            <th className="px-4 py-3 font-medium">Waiter</th>
                            <th className="px-4 py-3 font-medium text-right">Amount</th>
                            <th className="px-4 py-3 font-medium text-center">Status</th>
                            <th className="px-4 py-3 font-medium">Audit Notes</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {filteredBills.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-stone-400">
                                    No voided bills found for this criteria.
                                </td>
                            </tr>
                        ) : (
                            filteredBills.map((bill) => (
                                <tr key={bill.id} className="hover:bg-stone-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-stone-900">#{bill.order_number}</div>
                                        <div className="text-xs text-stone-500 flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(bill.migrated_at).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-stone-600">
                                        {bill.waiter_name}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-stone-900">
                                        KES {bill.total_amount?.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {bill.status === 'pending' && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                                                PENDING
                                            </span>
                                        )}
                                        {bill.status === 'reviewed' && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                REVIEWED
                                            </span>
                                        )}
                                        {bill.status === 'disputed' && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-700 border border-rose-200">
                                                DISPUTED
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-stone-500 max-w-xs truncate">
                                        {bill.audit_notes || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {bill.status === 'pending' ? (
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    onClick={() => handleReview(bill.id, 'reviewed')}
                                                    disabled={processingId === bill.id}
                                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                    title="Mark as Reviewed"
                                                >
                                                    <CheckCircle className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleReview(bill.id, 'disputed')}
                                                    disabled={processingId === bill.id}
                                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                    title="Dispute"
                                                >
                                                    <AlertTriangle className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-stone-400 italic text-xs">Processed</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
