'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { auditAPI } from '@/lib/api';
import {
    Check, X, Eye, FileText, Building2, User,
    Calendar, RefreshCw, MessageSquare, ShieldCheck,
    ArrowRight, Clock, Wallet, Smartphone, CreditCard, Layers,
    ArrowDownLeft, ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DailyLogVerificationProps {
    title?: string;
    status?: 'submitted' | 'verified' | 'rejected';
}

export const DailyLogVerification: React.FC<DailyLogVerificationProps> = ({
    title = "Accountant Daily Logs Verification",
    status = 'submitted'
}) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<any>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [auditNotes, setAuditNotes] = useState('');

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.getDailyLogsStatus({ status });
            if (res.success) {
                setLogs(res.data || []);
            }
        } catch (error) {
            console.error('Error fetching daily logs:', error);
            toast.error('Failed to load daily logs for verification');
        } finally {
            setIsLoading(false);
        }
    }, [status]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleAudit = async (id: string, action: 'verified' | 'rejected') => {
        if (!auditNotes && action === 'rejected') {
            toast.error('Please provide notes when rejecting a log');
            return;
        }

        setIsActionLoading(true);
        try {
            const res = await auditAPI.verifyDailyLog(id, action, auditNotes);
            if (res.success) {
                toast.success(`Daily log ${action === 'verified' ? 'verified' : 'rejected'} successfully`);
                setSelectedLog(null);
                setAuditNotes('');
                fetchLogs();
            }
        } catch (error) {
            console.error('Verification failed:', error);
            toast.error(`Failed to ${action} daily log`);
        } finally {
            setIsActionLoading(false);
        }
    };

    if (isLoading && logs.length === 0) {
        return (
            <div className="card-elevated p-8 flex flex-col items-center justify-center bg-white min-h-[200px]">
                <RefreshCw className="h-8 w-8 animate-spin text-stone-300 mb-2" />
                <p className="text-[13px] font-medium text-stone-400 uppercase tracking-widest">Loading daily logs queue...</p>
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div className="card-elevated p-8 flex flex-col items-center justify-center bg-stone-50/50 min-h-[200px] border-dashed border-2 border-stone-200">
                <ShieldCheck className="h-10 w-10 text-stone-200 mb-3" />
                <p className="text-[14px] font-bold text-stone-400">No daily logs pending verification</p>
                <p className="text-[11px] text-stone-400 mt-1 uppercase tracking-widest">All accountant records are verified</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-stone-900 tracking-tight flex items-center gap-2">
                    {title}
                    <span className="bg-stone-900 text-white text-[10px] px-2 py-0.5 rounded-full">{logs.length}</span>
                </h3>
                <button onClick={fetchLogs} className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
                    <RefreshCw className={`h-4 w-4 text-stone-400 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {logs.map((log) => (
                    <div
                        key={log.id}
                        className={`card-elevated p-5 bg-white border-l-4 transition-all hover:shadow-md cursor-pointer ${selectedLog?.id === log.id ? 'border-stone-900 ring-1 ring-stone-900/5' : 'border-amber-400'
                            }`}
                        onClick={() => setSelectedLog(log)}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-stone-500 border border-stone-100">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[14px] font-bold text-stone-900 tracking-tight">
                                        Accountant Daily Log
                                    </p>
                                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">
                                        {format(new Date(log.log_date), 'MMMM do, yyyy')}
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
                                <span className="text-[12px] font-bold text-stone-600 truncate">{log.branch_name || 'Unknown Branch'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-stone-300" />
                                <span className="text-[12px] font-bold text-stone-600 truncate">
                                    {log.creator_name || 'Internal'}
                                </span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                            <div className="flex gap-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                                        <ArrowDownLeft className="h-2 w-2" /> In
                                    </span>
                                    <span className="text-[13px] font-black text-stone-900">KES {log.total_payments?.toLocaleString() || '0'}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest flex items-center gap-1">
                                        <ArrowUpRight className="h-2 w-2" /> Out
                                    </span>
                                    <span className="text-[13px] font-black text-stone-900">KES {log.total_expenses?.toLocaleString() || '0'}</span>
                                </div>
                            </div>
                            <ArrowRight className={`h-4 w-4 transition-transform ${selectedLog?.id === log.id ? 'translate-x-1 text-stone-900' : 'text-stone-300'}`} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Verification Detail Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-stone-100 flex flex-col scale-in-center">
                        <div className="px-6 py-5 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-stone-900 tracking-tight">Accountant Log Verification</h3>
                                <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest">
                                    Reference: {selectedLog.id.slice(0, 8)} • Branch: {selectedLog.branch_name}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="p-2 hover:bg-stone-200 rounded-full transition-colors text-stone-400"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Summary Totals */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <ArrowDownLeft className="h-3 w-3" /> Total Payments
                                    </p>
                                    <p className="text-xl font-black text-emerald-700">KES {selectedLog.total_payments?.toLocaleString()}</p>
                                </div>
                                <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <ArrowUpRight className="h-3 w-3" /> Total Expenses
                                    </p>
                                    <p className="text-xl font-black text-rose-700">KES {selectedLog.total_expenses?.toLocaleString()}</p>
                                </div>
                                <div className="p-4 bg-stone-900 rounded-xl text-white md:col-span-2">
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Daily Net Impact</p>
                                    <p className="text-xl font-black">
                                        {(selectedLog.total_payments - selectedLog.total_expenses) >= 0 ? '+' : ''}
                                        KES {(selectedLog.total_payments - selectedLog.total_expenses).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {/* Line Items Breakdown */}
                            <div className="space-y-4">
                                <h4 className="text-[12px] font-bold text-stone-900 uppercase tracking-widest border-l-2 border-stone-900 pl-2">Daily Line Items</h4>
                                <div className="border border-stone-100 rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-[13px]">
                                        <thead className="bg-stone-50 text-stone-500 font-bold">
                                            <tr>
                                                <th className="px-4 py-3 uppercase text-[10px]">Type</th>
                                                <th className="px-4 py-3 uppercase text-[10px]">Reference / Payee</th>
                                                <th className="px-4 py-3 uppercase text-[10px]">Description</th>
                                                <th className="px-4 py-3 uppercase text-[10px] text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {(selectedLog.lines || []).map((line: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-stone-50/50 transition-colors">
                                                    <td className="px-4 py-3 font-bold">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${line.type === 'payment' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                                            }`}>
                                                            {line.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-stone-900 font-semibold">{line.reference_number || line.payee}</td>
                                                    <td className="px-4 py-3 text-stone-500 font-medium max-w-xs truncate">{line.description}</td>
                                                    <td className={`px-4 py-3 text-right font-black ${line.type === 'payment' ? 'text-emerald-600' : 'text-rose-600'
                                                        }`}>
                                                        {line.type === 'payment' ? '+' : '-'} {line.amount.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                            {(selectedLog.lines || []).length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-12 text-center text-stone-400 italic">No line items recorded for this day</td>
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
                                    <label className="text-[12px] font-bold text-stone-900 uppercase tracking-widest">Auditor Remarks</label>
                                </div>
                                <textarea
                                    value={auditNotes}
                                    onChange={(e) => setAuditNotes(e.target.value)}
                                    placeholder="Add notes, discrepancy details, or approval remarks..."
                                    className="w-full h-24 p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-stone-400 transition-colors text-[14px] font-medium resize-none shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="px-6 py-5 bg-stone-50/50 border-t border-stone-100 flex gap-3">
                            <button
                                onClick={() => handleAudit(selectedLog.id, 'rejected')}
                                disabled={isActionLoading}
                                className="flex-1 py-3 px-4 bg-white border border-rose-200 text-rose-600 rounded-xl font-bold text-[13px] uppercase tracking-widest hover:bg-rose-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                            >
                                <X className="h-4 w-4" /> Reject Log
                            </button>
                            <button
                                onClick={() => handleAudit(selectedLog.id, 'verified')}
                                disabled={isActionLoading}
                                className="flex-1 py-3 px-4 bg-stone-900 text-white rounded-xl font-bold text-[13px] uppercase tracking-widest hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-stone-900/20 disabled:opacity-50 active:scale-95"
                            >
                                {isActionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Verify & Approve
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
