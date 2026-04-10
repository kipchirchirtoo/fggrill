'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
    Check, X, Eye, FileText, Building2, User,
    Calendar, RefreshCw, MessageSquare, ShieldCheck,
    ArrowRight, Clock, Wallet, Smartphone, CreditCard, Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface CashierLogbookVerificationProps {
    title?: string;
    status?: 'pending_audit' | 'approved' | 'rejected';
}

export const CashierLogbookVerification: React.FC<CashierLogbookVerificationProps> = ({
    title = "Logbook Verification Queue",
    status = 'pending_audit'
}) => {
    const [logbooks, setLogbooks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedLogbook, setSelectedLogbook] = useState<any>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [auditNotes, setAuditNotes] = useState('');

    const fetchLogbooks = useCallback(async () => {
        setIsLoading(true);
        try {
            // @ts-ignore - status exists in the backend API but we need to update the frontend types if strictly checked
            const res = await api.audit.getPendingLogbooks({ status });
            if (res.success) {
                setLogbooks(res.data || []);
            }
        } catch (error) {
            console.error('Error fetching logbooks:', error);
            toast.error('Failed to load logbooks for verification');
        } finally {
            setIsLoading(false);
        }
    }, [status]);

    useEffect(() => {
        fetchLogbooks();
    }, [fetchLogbooks]);

    const handleAudit = async (id: string, action: 'approve' | 'reject') => {
        if (!auditNotes && action === 'reject') {
            toast.error('Please provide notes when rejecting a logbook');
            return;
        }

        setIsActionLoading(true);
        try {
            const res = await api.cashier.auditLogbook(id, action, auditNotes);
            if (res.success) {
                toast.success(`Logbook ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
                setSelectedLogbook(null);
                setAuditNotes('');
                fetchLogbooks();
            }
        } catch (error) {
            console.error('Audit failed:', error);
            toast.error(`Failed to ${action} logbook`);
        } finally {
            setIsActionLoading(false);
        }
    };

    if (isLoading && logbooks.length === 0) {
        return (
            <div className="card-elevated p-8 flex flex-col items-center justify-center bg-white min-h-[200px]">
                <RefreshCw className="h-8 w-8 animate-spin text-stone-300 mb-2" />
                <p className="text-[13px] font-medium text-stone-400 uppercase tracking-widest">Loading queue...</p>
            </div>
        );
    }

    if (logbooks.length === 0) {
        return (
            <div className="card-elevated p-8 flex flex-col items-center justify-center bg-stone-50/50 min-h-[200px] border-dashed border-2 border-stone-200">
                <ShieldCheck className="h-10 w-10 text-stone-200 mb-3" />
                <p className="text-[14px] font-bold text-stone-400">No logbooks pending verification</p>
                <p className="text-[11px] text-stone-400 mt-1 uppercase tracking-widest">All records are current</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-stone-900 tracking-tight flex items-center gap-2">
                    {title}
                    <span className="bg-stone-900 text-white text-[10px] px-2 py-0.5 rounded-full">{logbooks.length}</span>
                </h3>
                <button onClick={fetchLogbooks} className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
                    <RefreshCw className={`h-4 w-4 text-stone-400 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {logbooks.map((logbook) => (
                    <div
                        key={logbook.id}
                        className={`card-elevated p-5 bg-white border-l-4 transition-all hover:shadow-md cursor-pointer ${selectedLogbook?.id === logbook.id ? 'border-stone-900 ring-1 ring-stone-900/5' : 'border-amber-400'
                            }`}
                        onClick={() => setSelectedLogbook(logbook)}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-stone-500 border border-stone-100">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[14px] font-bold text-stone-900 tracking-tight">
                                        {logbook.type === 'reception' ? 'Reception Log' : 'Bar Log'}
                                    </p>
                                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">
                                        {format(new Date(logbook.log_date), 'MMMM do, yyyy')}
                                    </p>
                                </div>
                            </div>
                            <div className="px-2 py-1 rounded-md bg-amber-50 text-amber-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                                <Clock className="h-3 w-3" /> PENDING
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5 text-stone-300" />
                                <span className="text-[12px] font-bold text-stone-600 truncate">{logbook.branch?.name || 'Unknown Branch'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-stone-300" />
                                <span className="text-[12px] font-bold text-stone-600 truncate">
                                    {logbook.cashier?.first_name} {logbook.cashier?.last_name}
                                </span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Net Collection</span>
                                <span className="text-[14px] font-black text-stone-900">KES {logbook.net_collection?.toLocaleString() || '0'}</span>
                            </div>
                            <ArrowRight className={`h-4 w-4 transition-transform ${selectedLogbook?.id === logbook.id ? 'translate-x-1 text-stone-900' : 'text-stone-300'}`} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Verification Detail Modal */}
            {selectedLogbook && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-stone-100 flex flex-col scale-in-center">
                        <div className="px-6 py-5 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-stone-900 tracking-tight">Logbook Verification</h3>
                                <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest">
                                    Submitted by {selectedLogbook.cashier?.first_name} • {selectedLogbook.branch?.name}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedLogbook(null)}
                                className="p-2 hover:bg-stone-200 rounded-full transition-colors text-stone-400"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Summary Totals */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <Wallet className="h-3 w-3" /> Opening
                                    </p>
                                    <p className="text-md font-black text-stone-900">KES {selectedLogbook.opening_float?.toLocaleString()}</p>
                                </div>
                                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <Wallet className="h-3 w-3" /> Closing
                                    </p>
                                    <p className="text-md font-black text-stone-900">KES {selectedLogbook.closing_float?.toLocaleString()}</p>
                                </div>
                                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 border-dashed">
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <Smartphone className="h-3 w-3" /> M-Pesa
                                    </p>
                                    <p className="text-md font-black text-emerald-700">KES {selectedLogbook.total_mpesa?.toLocaleString()}</p>
                                </div>
                                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 border-dashed">
                                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <CreditCard className="h-3 w-3" /> Swipe
                                    </p>
                                    <p className="text-md font-black text-blue-700">KES {selectedLogbook.total_swipe?.toLocaleString()}</p>
                                </div>
                            </div>

                            {/* Sales Breakdown JSON Display */}
                            {selectedLogbook.sales_breakdown && Object.keys(selectedLogbook.sales_breakdown).length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-[11px] font-bold text-stone-900 uppercase tracking-widest flex items-center gap-2">
                                        <Layers className="h-3.5 w-3.5 text-stone-400" /> Revenue Distribution
                                    </h4>
                                    <div className="bg-stone-50/50 rounded-xl border border-stone-100 p-4 grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
                                        {Object.entries(selectedLogbook.sales_breakdown).map(([key, value]: [string, any]) => (
                                            <div key={key}>
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-0.5">{key.replace(/_/g, ' ')}</p>
                                                <p className="text-[14px] font-black text-stone-900">KES {Number(value).toLocaleString()}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Summary Footer */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-stone-100 rounded-xl border border-stone-200">
                                    <p className="text-[11px] font-bold text-stone-500 uppercase tracking-widest mb-1">Total Sales Record</p>
                                    <p className="text-xl font-black text-stone-900">KES {selectedLogbook.total_sales?.toLocaleString() || '0'}</p>
                                </div>
                                <div className="p-4 bg-stone-900 rounded-xl text-white shadow-lg shadow-stone-900/20">
                                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-1">Net Cash Collection</p>
                                    <p className="text-xl font-black">KES {selectedLogbook.net_collection?.toLocaleString()}</p>
                                </div>
                            </div>

                            {/* Section Details */}
                            <div className="space-y-4">
                                <h4 className="text-[12px] font-bold text-stone-900 uppercase tracking-widest border-l-2 border-stone-900 pl-2">Line Items Breakdown</h4>
                                <div className="border border-stone-100 rounded-xl overflow-hidden">
                                    <table className="w-full text-left text-[13px]">
                                        <thead className="bg-stone-50 text-stone-500 font-bold">
                                            <tr>
                                                <th className="px-4 py-2 uppercase text-[10px]">Section</th>
                                                <th className="px-4 py-2 uppercase text-[10px]">Guest / Customer</th>
                                                <th className="px-4 py-2 uppercase text-[10px]">Reference</th>
                                                <th className="px-4 py-2 uppercase text-[10px] text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {(selectedLogbook.lines || []).map((line: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-stone-50/50">
                                                    <td className="px-4 py-2.5 font-bold uppercase text-[11px]">{line.section}</td>
                                                    <td className="px-4 py-2.5 text-stone-600 font-medium">{line.customer_name}</td>
                                                    <td className="px-4 py-2.5 text-stone-400 font-mono text-[11px]">{line.reference || '-'}</td>
                                                    <td className="px-4 py-2.5 text-right font-black text-stone-900">KES {line.amount.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                            {(selectedLogbook.lines || []).length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-8 text-center text-stone-400 italic font-medium">No line items recorded</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Verification Notes */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <MessageSquare className="h-4 w-4 text-stone-400" />
                                    <label className="text-[12px] font-bold text-stone-900 uppercase tracking-widest">Verification Remarks</label>
                                </div>
                                <textarea
                                    value={auditNotes}
                                    onChange={(e) => setAuditNotes(e.target.value)}
                                    placeholder="Add notes, discrepancy details, or approval remarks..."
                                    className="w-full h-24 p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-stone-400 transition-colors text-[14px] font-medium"
                                />
                            </div>
                        </div>

                        <div className="px-6 py-5 bg-stone-50/50 border-t border-stone-100 flex gap-3">
                            <button
                                onClick={() => handleAudit(selectedLogbook.id, 'reject')}
                                disabled={isActionLoading}
                                className="flex-1 py-3 px-4 bg-white border border-rose-200 text-rose-600 rounded-xl font-bold text-[13px] uppercase tracking-widest hover:bg-rose-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <X className="h-4 w-4" /> Reject Record
                            </button>
                            <button
                                onClick={() => handleAudit(selectedLogbook.id, 'approve')}
                                disabled={isActionLoading}
                                className="flex-1 py-3 px-4 bg-stone-900 text-white rounded-xl font-bold text-[13px] uppercase tracking-widest hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-stone-900/20 disabled:opacity-50"
                            >
                                {isActionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Approve & Verify
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
