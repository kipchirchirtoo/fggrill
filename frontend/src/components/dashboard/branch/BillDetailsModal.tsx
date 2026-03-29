'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { XCircle, CheckCircle2, User, Calendar, FileText, DollarSign, Clock } from 'lucide-react';

interface BillDetailsModalProps {
    bill: any;
    onClose: () => void;
    onUpdate: () => void;
    isAuditor?: boolean;
}

export function BillDetailsModal({ bill, onClose, onUpdate, isAuditor = false }: BillDetailsModalProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleMarkAsPaid = async () => {
        if (!confirm('Are you sure you want to mark this bill as paid/deducted? This will update the status and cannot be easily undone.')) return;

        setIsLoading(true);
        try {
            // Safety check for simplePayroll API
            const payrollApi = api.staff?.simplePayroll;
            if (!payrollApi || typeof payrollApi.updateCreditBillStatus !== 'function') {
                toast.error('Update feature is currently unavailable');
                return;
            }

            const res = await payrollApi.updateCreditBillStatus(bill.id, 'paid');
            if (res.success) {
                toast.success('Bill marked as paid successfully');
                onUpdate();
                onClose();
            } else {
                toast.error(res.message || 'Failed to update bill status');
            }
        } catch (error) {
            console.error('Error updating bill', error);
            toast.error('Failed to update bill');
        } finally {
            setIsLoading(false);
        }
    };

    if (!bill) return null;

    // Detect Record Type
    const isLoan = 'total_amount' in bill;
    const isAdvance = 'request_date' in bill && !isLoan;
    const isCreditBill = !isLoan && !isAdvance;

    // Map properties based on type
    const amount = isLoan ? bill.total_amount : bill.amount;
    const balance = isLoan ? bill.remaining_balance : (isAdvance ? bill.amount : (bill.balance ?? bill.amount));
    const description = isCreditBill ? bill.description : bill.reason;
    const date = isCreditBill ? bill.date : (isLoan ? bill.start_date : bill.request_date);

    // Status Logic
    let statusLabel = '';
    let statusColor = '';
    let isSettled = false;

    if (isCreditBill) {
        // Restored Settled Logic: Check is_paid boolean primary, status enum fallback
        isSettled = bill.is_paid || 
                    bill.status === 'paid' || 
                    bill.status === 'paid_cash' || 
                    bill.status === 'deducted';
        
        statusLabel = isSettled ? 'Settled' : 'Pending Payment';
        statusColor = isSettled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
    } else if (isLoan) {
        isSettled = bill.status === 'completed';
        statusLabel = bill.status;
        statusColor = bill.status === 'active' ? 'bg-blue-100 text-blue-700' :
            bill.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                'bg-amber-100 text-amber-700';
    } else if (isAdvance) {
        isSettled = bill.status === 'deducted';
        statusLabel = isSettled ? 'Settled' : (bill.status === 'approved' ? 'Approved' : bill.status);
        statusColor = isSettled ? 'bg-emerald-100 text-emerald-700' :
            bill.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                bill.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700';
    }

    const typeLabel = isCreditBill ? 'Credit Bill' : (isLoan ? 'Staff Loan' : 'Salary Advance');

    return (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-stone-200 flex justify-between items-center bg-stone-50">
                    <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        {typeLabel} Details
                    </h3>
                    <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
                        <XCircle className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Header Info */}
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm text-stone-500 font-medium uppercase tracking-wide">Status</p>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase mt-1 ${statusColor}`}>
                                {isSettled ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                {statusLabel}
                            </span>
                        </div>
                        <div className="flex gap-4">
                            <div className="text-right">
                                <p className="text-sm text-stone-500 font-medium uppercase tracking-wide">
                                    {isLoan ? 'Total Loan' : 'Amount'}
                                </p>
                                <p className={`text-lg font-bold mt-0.5 ${isSettled ? 'text-stone-400 line-through decoration-stone-300' : 'text-stone-900'}`}>
                                    KES {amount?.toLocaleString()}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-blue-600 font-bold uppercase tracking-wide">Balance</p>
                                <p className="text-2xl font-black text-blue-700 mt-0.5">
                                    KES {balance.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 p-4 bg-stone-50 rounded-xl border border-stone-100">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-stone-500 text-xs font-bold uppercase">
                                <User className="h-3.5 w-3.5" /> Staff Member
                            </div>
                            <p className="font-semibold text-stone-900">
                                {bill.staff?.first_name} {bill.staff?.last_name || 'Unknown'}
                            </p>
                            <p className="text-xs text-stone-500">{bill.staff?.role || 'Staff'}</p>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-stone-500 text-xs font-bold uppercase">
                                <Calendar className="h-3.5 w-3.5" /> Date Recorded
                            </div>
                            <p className="font-semibold text-stone-900">
                                {new Date(date || bill.created_at).toLocaleDateString(undefined, {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm text-stone-500 font-medium uppercase tracking-wide">
                            {isCreditBill ? 'Description / Notes' : 'Reason for Request'}
                        </p>
                        <div className="p-4 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 leading-relaxed min-h-[80px]">
                            {description || 'No description provided.'}
                            {isLoan && bill.monthly_installment && (
                                <div className="mt-4 pt-3 border-t border-stone-100 text-stone-600">
                                    <p className="text-xs font-bold uppercase text-stone-400 mb-1">Repayment Details</p>
                                    <p>Monthly Installment: <span className="font-bold">KES {bill.monthly_installment.toLocaleString()}</span></p>
                                </div>
                            )}
                            {isSettled && (
                                <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2 text-emerald-600 font-bold italic">
                                    <CheckCircle2 className="h-4 w-4" /> This {typeLabel.toLowerCase()} has been fully processed/settled.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-stone-100 bg-stone-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-200 rounded-lg transition-colors"
                        disabled={isLoading}
                    >
                        Close
                    </button>

                    {isCreditBill && !bill.is_paid && !isAuditor && (
                        <button
                            onClick={handleMarkAsPaid}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                            )}
                            Settle Fully
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
