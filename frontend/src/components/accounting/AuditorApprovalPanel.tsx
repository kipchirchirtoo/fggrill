'use client';

import { useState } from 'react';
import { Shield, Clock, CheckCircle, XCircle, FileText, AlertTriangle, Eye, ArrowRight, User } from 'lucide-react';
import { toast } from 'sonner';

interface ApprovalRequest {
    id: string;
    type: 'STOCK_ADJUSTMENT' | 'EXPENSE_APPROVAL' | 'JOURNAL_POSTING';
    entityId: string;
    entityType: string;
    requestedBy: string;
    date: string;
    amount?: number;
    description: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
}

export default function AuditorApprovalPanel() {
    const [requests, setRequests] = useState<ApprovalRequest[]>([
        { id: '1', type: 'STOCK_ADJUSTMENT', entityId: 'S-772', entityType: 'Stock Count', requestedBy: 'Alice Accountant', date: '2024-01-06 14:20', amount: -4500, description: 'Variance found in Beer inventory (Missing 12 bottles)', priority: 'high' },
        { id: '2', type: 'EXPENSE_APPROVAL', entityId: 'E-105', entityType: 'Operational Expense', requestedBy: 'Alice Accountant', date: '2024-01-06 16:45', amount: 12500, description: 'Maintenance: Water pump repair (Plumber Co.)', priority: 'normal' },
        { id: '3', type: 'JOURNAL_POSTING', entityId: 'J-2041', entityType: 'Journal Entry', requestedBy: 'Alice Accountant', date: '2024-01-07 09:15', description: 'Monthly depreciation posting for Furniture', priority: 'low' },
    ]);

    const handleAction = (id: string, action: 'approved' | 'rejected') => {
        setRequests(prev => prev.filter(r => r.id !== id));
        toast.success(`Request ${action} successfully`);
    };

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'urgent': return 'bg-rose-100 text-rose-700';
            case 'high': return 'bg-orange-100 text-orange-700';
            case 'normal': return 'bg-blue-100 text-blue-700';
            default: return 'bg-stone-100 text-stone-600';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-[18px] font-bold text-stone-900 flex items-center gap-2">
                        <Shield className="h-5 w-5 text-stone-900" />
                        Pending Auditor Approvals
                    </h2>
                    <p className="text-[12px] text-stone-500">Sign off on pending financial transactions and adjustments</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-stone-100 rounded-lg text-[11px] font-bold text-stone-600">
                    <Clock className="h-3.5 w-3.5" />
                    AVERAGE WAIT: 4.2 HOURS
                </div>
            </div>

            {requests.length === 0 ? (
                <div className="card-elevated py-20 flex flex-col items-center text-center">
                    <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                        <CheckCircle className="h-8 w-8 text-emerald-500" />
                    </div>
                    <h3 className="text-[16px] font-bold text-stone-900">Queue is Empty</h3>
                    <p className="text-[12px] text-stone-500">All pending requests have been processed.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {requests.map((request) => (
                        <div key={request.id} className="card-elevated hover:shadow-md transition-all overflow-hidden border-l-4 border-l-stone-900">
                            <div className="p-5">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-stone-50 flex items-center justify-center shrink-0">
                                            {request.type === 'STOCK_ADJUSTMENT' ? <AlertTriangle className="h-5 w-5 text-orange-500" /> :
                                                request.type === 'EXPENSE_APPROVAL' ? <FileText className="h-5 w-5 text-blue-500" /> :
                                                    <Shield className="h-5 w-5 text-emerald-500" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-[14px] font-bold text-stone-900">{request.entityType}: {request.entityId}</h3>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getPriorityColor(request.priority)}`}>
                                                    {request.priority}
                                                </span>
                                            </div>
                                            <p className="text-[12px] text-stone-600 font-medium mb-3">{request.description}</p>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-medium">
                                                    <User className="h-3.5 w-3.5" />
                                                    {request.requestedBy}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-medium">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {request.date}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-3 justify-center min-w-[200px]">
                                        {request.amount !== undefined && (
                                            <div className="text-right">
                                                <p className="text-[11px] font-bold text-stone-400 uppercase leading-none mb-1">Impact Value</p>
                                                <p className={`text-[18px] font-bold ${request.amount < 0 ? 'text-rose-600' : 'text-stone-900'}`}>
                                                    {request.amount < 0 ? '-' : ''}KES {Math.abs(request.amount).toLocaleString()}
                                                </p>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <button className="p-2 rounded-lg bg-stone-50 border border-stone-200 text-stone-500 hover:text-stone-900 hover:bg-white transition-all">
                                                <Eye className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleAction(request.id, 'rejected')}
                                                className="px-4 py-2 rounded-lg bg-rose-50 text-rose-600 text-[12px] font-bold hover:bg-rose-100 transition-all border border-rose-100"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => handleAction(request.id, 'approved')}
                                                className="px-6 py-2 rounded-lg bg-stone-900 text-white text-[12px] font-bold hover:bg-stone-800 transition-all shadow-sm"
                                            >
                                                Approve
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                    <p className="text-[12px] text-amber-900 font-bold mb-1">Audit Policy Reminder</p>
                    <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                        Approving a Stock Adjustment will permanently modify the system inventory balance. Please ensure physical count sheets are uploaded and verified before signing off.
                    </p>
                </div>
            </div>
        </div>
    );
}
