'use client';

import { useState } from 'react';
import { Landmark, RefreshCw, CheckCircle2, AlertCircle, ArrowRight, ArrowDown, Search, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
    id: string;
    date: string;
    description: string;
    type: 'sale' | 'deposit';
    amount: number;
    status: 'matched' | 'unmatched';
    matchedId?: string;
}

export default function BankReconciliation() {
    const [view, setView] = useState<'overview' | 'reconcile'>('overview');

    // Mock balances
    const balances = {
        book: 1450000.00,
        bank: 1448500.00,
        unmatchedSales: 150000.00,
        unmatchedDeposits: 148500.00
    };

    const difference = balances.book - balances.bank;

    // Mock transactions
    const [transactions, setTransactions] = useState<Transaction[]>([
        { id: 'S1', date: '2024-01-05', description: 'Room Booking #BK-9842 (Cash)', type: 'sale', amount: 4500.00, status: 'unmatched' },
        { id: 'S2', date: '2024-01-05', description: 'Restaurant Bill #RS-2041 (M-Pesa)', type: 'sale', amount: 3200.00, status: 'unmatched' },
        { id: 'D1', date: '2024-01-06', description: 'Bank Deposit - Ref: CASH-105', type: 'deposit', amount: 4500.00, status: 'unmatched' },
        { id: 'D2', date: '2024-01-06', description: 'M-Pesa Settlement - QAX9421', type: 'deposit', amount: 3200.00, status: 'unmatched' },
    ]);

    const handleMatch = (saleId: string, depositId: string) => {
        setTransactions(prev => prev.map(t => {
            if (t.id === saleId || t.id === depositId) {
                return { ...t, status: 'matched', matchedId: t.id === saleId ? depositId : saleId };
            }
            return t;
        }));
        toast.success('Transactions matched successfully');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-[18px] font-bold text-stone-900">Bank Reconciliation</h2>
                    <p className="text-[12px] text-stone-500">Reconcile system sales with bank & M-Pesa statements</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn-secondary">
                        <RefreshCw className="h-4 w-4" />
                        <span>Refresh Data</span>
                    </button>
                    <button className="btn-primary bg-stone-900 text-white">
                        <span>Save Session</span>
                    </button>
                </div>
            </div>

            {/* Balances Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card-elevated p-5 bg-stone-50">
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">Company Book Balance</p>
                    <p className="text-[22px] font-bold text-stone-900">KES {balances.book.toLocaleString()}</p>
                    <p className="text-[11px] text-stone-500 mt-1">Updated 2h ago</p>
                </div>
                <div className="card-elevated p-5 bg-white border-2 border-stone-100">
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">Bank Statement Balance</p>
                    <p className="text-[22px] font-bold text-stone-900">KES {balances.bank.toLocaleString()}</p>
                    <p className="text-[11px] text-stone-500 mt-1">Last sync: Jan 06, 10:00 AM</p>
                </div>
                <div className={`card-elevated p-5 ${difference === 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${difference === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        Unreconciled Difference
                    </p>
                    <p className={`text-[22px] font-bold ${difference === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        KES {difference.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                        {difference === 0 ? (
                            <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> <span className="text-[11px] text-emerald-600 font-medium">Fully Matched</span></>
                        ) : (
                            <><AlertCircle className="h-3.5 w-3.5 text-rose-500" /> <span className="text-[11px] text-rose-600 font-medium">Discrepancy found</span></>
                        )}
                    </div>
                </div>
            </div>

            {/* Reconciliation Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sales (Book) Side */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[14px] font-bold text-stone-900 flex items-center gap-2">
                            <ArrowDown className="h-4 w-4 text-emerald-500" />
                            System Sales (Not Reconciled)
                        </h3>
                        <span className="text-[10px] font-bold bg-stone-100 px-2 py-0.5 rounded text-stone-500">2 ITEMS</span>
                    </div>
                    <div className="space-y-2">
                        {transactions.filter(t => t.type === 'sale' && t.status === 'unmatched').map(t => (
                            <div key={t.id} className="p-4 rounded-xl border border-stone-200 bg-white hover:border-stone-400 cursor-pointer transition-all group">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[13px] font-bold text-stone-900">{t.description}</p>
                                        <p className="text-[11px] text-stone-500">{t.date}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[13px] font-bold text-stone-900">KES {t.amount.toLocaleString()}</p>
                                        <button className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 ml-auto mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            Select to match <ArrowRight className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bank / M-Pesa Side */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[14px] font-bold text-stone-900 flex items-center gap-2">
                            <Landmark className="h-4 w-4 text-stone-600" />
                            Bank Statement Entries
                        </h3>
                        <span className="text-[10px] font-bold bg-stone-100 px-2 py-0.5 rounded text-stone-500">2 ITEMS</span>
                    </div>
                    <div className="space-y-2">
                        {transactions.filter(t => t.type === 'deposit' && t.status === 'unmatched').map(t => (
                            <div key={t.id} className="p-4 rounded-xl border border-stone-200 bg-white hover:border-stone-900 cursor-pointer transition-all">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[13px] font-bold text-stone-900">{t.description}</p>
                                        <p className="text-[11px] text-stone-500">{t.date}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[13px] font-bold text-stone-900">KES {t.amount.toLocaleString()}</p>
                                        <span className="text-[10px] font-bold text-stone-400 mt-1 block uppercase">Available</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Reconciliation History / Summary */}
            <div className="card-elevated p-0 overflow-hidden">
                <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                    <h3 className="text-[14px] font-bold text-stone-900">Recently Matched</h3>
                    <button className="text-[12px] text-stone-500 hover:text-stone-900 font-medium">View Full Audit Log</button>
                </div>
                <div className="p-4 flex items-center justify-center py-10 text-stone-400 bg-stone-50/20">
                    <div className="text-center">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        <p className="text-[12px]">All transactions today are reconciled</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                <p className="text-[12px] text-blue-700 font-medium">
                    Pro Tip: System automatically matches M-Pesa receipts when the transaction code (e.g. QAX9421) is recorded correctly in the POS.
                </p>
            </div>
        </div>
    );
}
