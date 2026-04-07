'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { XCircle, CheckCircle2, User, Calendar, FileText, Clock, ChevronDown, ChevronUp, Banknote, History } from 'lucide-react';
interface BillDetailsModalProps {
    bill: any;
    onClose: () => void;
    onUpdate: () => void;
    isAuditor?: boolean;
}

export function BillDetailsModal({ bill, onClose, onUpdate, isAuditor = false }: BillDetailsModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [showPartialForm, setShowPartialForm] = useState(false);
    const [partialAmount, setPartialAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'mpesa' | 'deduction'>('cash');
    const [paymentRef, setPaymentRef] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);

    if (!bill) return null;

    // Detect Record Type
    const isLoan = 'total_amount' in bill;
    const isAdvance = 'request_date' in bill && !isLoan;
    const isCreditBill = !isLoan && !isAdvance;

    // Map properties based on type
    const amount = isLoan ? bill.total_amount : bill.amount;
    const balance = isLoan
        ? bill.remaining_balance
        : (isAdvance ? bill.amount : (bill.balance ?? bill.amount));
    const description = isCreditBill ? bill.description : bill.reason;
    const date = isCreditBill ? bill.date : (isLoan ? bill.start_date : bill.request_date);
    const paidAmount = isCreditBill ? (bill.paid_amount || 0) : 0;

    // Status Logic
    let statusLabel = '';
    let statusColor = '';
    let isSettled = false;

    if (isCreditBill) {
        isSettled = bill.is_paid ||
            bill.status === 'paid' ||
            bill.status === 'paid_cash' ||
            bill.status === 'deducted';
        const isPartial = bill.status === 'partial';
        statusLabel = isSettled ? 'Fully Settled' : isPartial ? 'Partially Paid' : 'Pending Payment';
        statusColor = isSettled
            ? 'bg-emerald-100 text-emerald-700'
            : isPartial
                ? 'bg-blue-100 text-blue-700'
                : 'bg-amber-100 text-amber-700';
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

    // Use balance from DB if positive; fall back to full amount for legacy pending bills with balance=0
    const currentBalance = isCreditBill
        ? (bill.balance > 0 ? bill.balance : (isSettled ? 0 : bill.amount))
        : balance;

    const canSettle = isCreditBill && !isSettled && !isAuditor;

    const handleFullSettle = async () => {
        if (!confirm('Mark this bill as fully paid? This cannot be easily undone.')) return;
        setIsLoading(true);
        try {
            const payrollApi = api.staff?.simplePayroll;
            if (!payrollApi?.updateCreditBillStatus) {
                toast.error('Update feature is currently unavailable');
                return;
            }
            const res = await payrollApi.updateCreditBillStatus(bill.id, 'paid');
            if (res.success) {
                toast.success('Bill fully settled');
                onUpdate();
                onClose();
            } else {
                toast.error(res.message || 'Failed to settle bill');
            }
        } catch {
            toast.error('Failed to settle bill');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePartialPayment = async () => {
        const amt = parseFloat(partialAmount);
        if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
        if (amt > currentBalance) { toast.error(`Amount exceeds remaining balance of KES ${currentBalance.toLocaleString()}`); return; }

        setIsLoading(true);
        try {
            const payrollApi = api.staff?.simplePayroll;
            if (!payrollApi?.partialPayCreditBill) {
                toast.error('Partial payment feature is currently unavailable');
                return;
            }
            const res = await payrollApi.partialPayCreditBill(bill.id, {
                amount: amt,
                payment_method: paymentMethod,
                reference: paymentRef || undefined,
                notes: paymentNotes || undefined
            });
            if (res.success) {
                toast.success(res.message || `Payment of KES ${amt.toLocaleString()} recorded`);
                setShowPartialForm(false);
                setPartialAmount('');
                setPaymentRef('');
                setPaymentNotes('');
                onUpdate();
                onClose();
            } else {
                toast.error(res.message || 'Failed to record payment');
            }
        } catch {
            toast.error('Failed to record payment');
        } finally {
            setIsLoading(false);
        }
    };

    const loadPaymentHistory = async () => {
        if (showHistory) { setShowHistory(false); return; }
        setHistoryLoading(true);
        try {
            const payrollApi = api.staff?.simplePayroll;
            if (payrollApi?.getCreditBillPayments) {
                const res = await payrollApi.getCreditBillPayments(bill.id);
                if (res.success) setPaymentHistory((res as any).data || []);
            }
        } catch { /* silent */ }
        finally {
            setHistoryLoading(false);
            setShowHistory(true);
        }
    };

    return (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-stone-200 flex justify-between items-center bg-stone-50 shrink-0">
                    <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        {typeLabel} Details
                    </h3>
                    <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
                        <XCircle className="h-5 w-5" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1">
                    <div className="p-6 space-y-5">
                        {/* Status + Amounts */}
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs text-stone-500 font-bold uppercase tracking-wide">Status</p>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase mt-1 ${statusColor}`}>
                                    {isSettled ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                    {statusLabel}
                                </span>
                            </div>
                            <div className="flex gap-4">
                                <div className="text-right">
                                    <p className="text-xs text-stone-500 font-bold uppercase tracking-wide">
                                        {isLoan ? 'Total Loan' : 'Original'}
                                    </p>
                                    <p className="text-base font-bold text-stone-400 line-through mt-0.5">
                                        KES {amount?.toLocaleString()}
                                    </p>
                                </div>
                                {isCreditBill && paidAmount > 0 && (
                                    <div className="text-right">
                                        <p className="text-xs text-emerald-600 font-bold uppercase tracking-wide">Paid</p>
                                        <p className="text-base font-bold text-emerald-600 mt-0.5">
                                            KES {paidAmount.toLocaleString()}
                                        </p>
                                    </div>
                                )}
                                <div className="text-right">
                                    <p className="text-xs text-blue-600 font-bold uppercase tracking-wide">Balance</p>
                                    <p className={`text-2xl font-black mt-0.5 ${isSettled ? 'text-stone-300' : 'text-blue-700'}`}>
                                        KES {isSettled ? '0' : currentBalance?.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Progress bar for partial */}
                        {isCreditBill && paidAmount > 0 && !isSettled && (
                            <div>
                                <div className="flex justify-between text-[11px] text-stone-400 mb-1">
                                    <span>Payment progress</span>
                                    <span>{Math.round((paidAmount / amount) * 100)}%</span>
                                </div>
                                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full transition-all"
                                        style={{ width: `${Math.min(100, (paidAmount / amount) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Staff + Date */}
                        <div className="grid grid-cols-2 gap-4 p-4 bg-stone-50 rounded-xl border border-stone-100">
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-stone-400 text-xs font-bold uppercase">
                                    <User className="h-3.5 w-3.5" /> Staff Member
                                </div>
                                <p className="font-semibold text-stone-900">
                                    {bill.staff?.first_name} {bill.staff?.last_name || 'Unknown'}
                                </p>
                                <p className="text-xs text-stone-500">{bill.staff?.role || 'Staff'}</p>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-stone-400 text-xs font-bold uppercase">
                                    <Calendar className="h-3.5 w-3.5" /> Date Recorded
                                </div>
                                <p className="font-semibold text-stone-900 text-sm">
                                    {new Date(date || bill.created_at).toLocaleDateString(undefined, {
                                        year: 'numeric', month: 'long', day: 'numeric'
                                    })}
                                </p>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <p className="text-xs text-stone-500 font-bold uppercase tracking-wide">
                                {isCreditBill ? 'Description / Notes' : 'Reason for Request'}
                            </p>
                            <div className="p-3 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 leading-relaxed min-h-[60px]">
                                {description || 'No description provided.'}
                                {isLoan && bill.monthly_installment && (
                                    <div className="mt-3 pt-3 border-t border-stone-100 text-stone-600">
                                        <p className="text-xs font-bold uppercase text-stone-400 mb-1">Repayment Details</p>
                                        <p>Monthly Installment: <span className="font-bold">KES {bill.monthly_installment.toLocaleString()}</span></p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Partial Payment Form */}
                        {canSettle && showPartialForm && (
                            <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-4 space-y-3">
                                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Banknote className="h-3.5 w-3.5" /> Record Payment
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                                            Amount (max KES {currentBalance?.toLocaleString()})
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max={currentBalance}
                                            value={partialAmount}
                                            onChange={e => setPartialAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Method</label>
                                        <select
                                            value={paymentMethod}
                                            onChange={e => setPaymentMethod(e.target.value as any)}
                                            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        >
                                            <option value="cash">Cash</option>
                                            <option value="mpesa">M-Pesa</option>
                                            <option value="bank">Bank Transfer</option>
                                            <option value="deduction">Payroll Deduction</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Reference / Receipt No. (optional)</label>
                                    <input
                                        type="text"
                                        value={paymentRef}
                                        onChange={e => setPaymentRef(e.target.value)}
                                        placeholder="e.g. MPESA code, receipt number..."
                                        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Notes (optional)</label>
                                    <input
                                        type="text"
                                        value={paymentNotes}
                                        onChange={e => setPaymentNotes(e.target.value)}
                                        placeholder="Any additional notes..."
                                        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                    />
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() => setShowPartialForm(false)}
                                        className="flex-1 px-3 py-2 text-sm text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                                        disabled={isLoading}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handlePartialPayment}
                                        disabled={isLoading || !partialAmount}
                                        className="flex-1 px-3 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                    >
                                        {isLoading ? (
                                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <Banknote className="h-4 w-4" />
                                        )}
                                        Confirm Payment
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Payment History */}
                        {isCreditBill && (
                            <div>
                                <button
                                    onClick={loadPaymentHistory}
                                    className="flex items-center gap-1.5 text-xs font-bold text-stone-500 hover:text-stone-700 transition-colors"
                                >
                                    <History className="h-3.5 w-3.5" />
                                    Payment History
                                    {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                    {historyLoading && <div className="h-3 w-3 border border-stone-300 border-t-stone-600 rounded-full animate-spin ml-1" />}
                                </button>
                                {showHistory && (
                                    <div className="mt-2 border border-stone-100 rounded-xl overflow-hidden">
                                        {paymentHistory.length === 0 ? (
                                            <p className="text-xs text-stone-400 text-center py-4">No payments recorded yet</p>
                                        ) : (
                                            <table className="w-full text-xs">
                                                <thead className="bg-stone-50 text-stone-400 font-bold uppercase">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left">Date</th>
                                                        <th className="px-3 py-2 text-right">Amount</th>
                                                        <th className="px-3 py-2 text-left">Method</th>
                                                        <th className="px-3 py-2 text-left">Ref</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-50">
                                                    {paymentHistory.map((p: any) => (
                                                        <tr key={p.id} className="hover:bg-stone-50/50">
                                                            <td className="px-3 py-2 text-stone-600">
                                                                {new Date(p.payment_date).toLocaleDateString()}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">
                                                                KES {parseFloat(p.amount).toLocaleString()}
                                                            </td>
                                                            <td className="px-3 py-2 text-stone-500 capitalize">{p.payment_method}</td>
                                                            <td className="px-3 py-2 text-stone-400">{p.reference || '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-stone-100 bg-stone-50 flex justify-end gap-2 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-200 rounded-lg transition-colors"
                        disabled={isLoading}
                    >
                        Close
                    </button>

                    {canSettle && !showPartialForm && (
                        <>
                            <button
                                onClick={() => setShowPartialForm(true)}
                                className="px-4 py-2 text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-1.5"
                            >
                                <Banknote className="h-4 w-4" />
                                Partial Payment
                            </button>
                            <button
                                onClick={handleFullSettle}
                                disabled={isLoading}
                                className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                )}
                                Settle Fully
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
