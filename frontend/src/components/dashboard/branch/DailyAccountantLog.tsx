'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { financeAPI, staffAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
    Plus, Trash2, Save, Calculator, AlertCircle,
    FileText, Check, TrendingUp, Shield, Clock,
    ArrowDownLeft, ArrowUpRight, Loader2, Calendar
} from 'lucide-react';
import { IOSCard } from '@/components/ui/ios-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/minimal/button';

interface LogLine {
    id?: string;
    entry_type: 'payment' | 'expense' | 'invoice_payment' | 'other';
    description: string;
    amount: number;
    payment_method?: string;
    category?: string;
    section: 'recorded_payments' | 'petty_cash_expenses' | 'other';
}

interface DailyLogData {
    id?: string;
    branch_id: number;
    log_date: string;
    opening_balance: number;
    closing_balance: number;
    total_payments: number;
    total_expenses: number;
    notes: string;
    status: 'draft' | 'submitted' | 'verified' | 'rejected';
    rejection_reason?: string;
    lines: LogLine[];
}

interface DailyAccountantLogProps {
    initialMode?: 'payments' | 'expenses';
}

export function DailyAccountantLog({ initialMode = 'payments' }: DailyAccountantLogProps) {
    const { user } = useAuth();
    const { activeBranch } = useBranch();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    const [log, setLog] = useState<DailyLogData>({
        branch_id: activeBranch?.id || 0,
        log_date: selectedDate,
        opening_balance: 0,
        closing_balance: 0,
        total_payments: 0,
        total_expenses: 0,
        notes: '',
        status: 'draft',
        lines: []
    });

    const loadLog = useCallback(async (date: string) => {
        if (!activeBranch?.id) return;
        setIsLoading(true);
        try {
            const response = await financeAPI.getDailyLogs({
                branch_id: activeBranch.id,
                log_date: date
            });
            if (response.success && response.data && response.data.length > 0) {
                setLog(response.data[0]);
            } else {
                // Initialize new log with previous day's closing balance if possible
                // For now just fresh
                setLog({
                    branch_id: activeBranch.id,
                    log_date: date,
                    opening_balance: 0,
                    closing_balance: 0,
                    total_payments: 0,
                    total_expenses: 0,
                    notes: '',
                    status: 'draft',
                    lines: []
                });
            }
        } catch (error) {
            console.error('Failed to load daily log:', error);
            toast.error('Failed to load daily log');
        } finally {
            setIsLoading(false);
        }
    }, [activeBranch?.id]);

    useEffect(() => {
        loadLog(selectedDate);
    }, [selectedDate, loadLog]);

    const handleSave = async (status: 'draft' | 'submitted') => {
        if (!activeBranch?.id) return;
        setIsSaving(true);
        try {
            const payload = {
                ...log,
                status,
                total_payments: paymentsTotal,
                total_expenses: expensesTotal,
                closing_balance: calculatedClosingBalance
            };

            const response = await financeAPI.saveDailyLog(payload);
            if (response.success) {
                toast.success(status === 'submitted' ? 'Log submitted for verification' : 'Draft saved successfully');
                if (response.data) setLog(response.data);
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to save daily log');
        } finally {
            setIsSaving(false);
        }
    };

    const addLine = (section: 'recorded_payments' | 'petty_cash_expenses') => {
        const newLine: LogLine = {
            entry_type: section === 'recorded_payments' ? 'payment' : 'expense',
            description: '',
            amount: 0,
            section: section
        };
        setLog(prev => ({
            ...prev,
            lines: [...prev.lines, newLine]
        }));
    };

    const updateLine = (index: number, field: keyof LogLine, value: any) => {
        const newLines = [...log.lines];
        newLines[index] = { ...newLines[index], [field]: value };
        setLog(prev => ({ ...prev, lines: newLines }));
    };

    const removeLine = (index: number) => {
        const newLines = [...log.lines];
        newLines.splice(index, 1);
        setLog(prev => ({ ...prev, lines: newLines }));
    };

    const payments = log.lines.filter(l => l.section === 'recorded_payments');
    const expenses = log.lines.filter(l => l.section === 'petty_cash_expenses');

    const paymentsTotal = payments.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    const expensesTotal = expenses.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    const calculatedClosingBalance = (Number(log.opening_balance) || 0) + paymentsTotal - expensesTotal;

    const isReadOnly = log.status === 'submitted' || log.status === 'verified';

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
                <p className="text-stone-500 font-medium">Loading Daily Log...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Date Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-stone-900 flex items-center justify-center text-white shadow-lg shadow-stone-900/20">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-stone-900">Daily Financial Log</h2>
                        <p className="text-stone-500 text-sm">Managing records for {activeBranch?.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-stone-100">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent border-none text-sm font-bold focus:ring-0 px-3 cursor-pointer"
                    />
                </div>
            </div>

            {/* Status Bar */}
            {log.status !== 'draft' && (
                <div className={`p-4 rounded-2xl flex items-center justify-between border ${log.status === 'verified' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                        log.status === 'rejected' ? 'bg-rose-50 border-rose-100 text-rose-800' :
                            'bg-amber-50 border-amber-100 text-amber-800'
                    }`}>
                    <div className="flex items-center gap-3">
                        <Shield size={20} />
                        <div>
                            <p className="text-[13px] font-bold uppercase tracking-widest">
                                Status: {log.status}
                            </p>
                            {log.status === 'rejected' && log.rejection_reason && (
                                <p className="text-[12px] font-medium mt-0.5">Reason: {log.rejection_reason}</p>
                            )}
                        </div>
                    </div>
                    {isReadOnly && (
                        <div className="flex items-center gap-2 text-[11px] font-bold px-3 py-1 bg-white/50 rounded-full text-stone-600">
                            <Clock size={12} /> READ ONLY
                        </div>
                    )}
                </div>
            )}

            {/* Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <IOSCard className="p-5 bg-white border-stone-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ArrowDownLeft size={48} className="text-stone-900" />
                    </div>
                    <p className="text-stone-400 text-[11px] font-bold uppercase tracking-widest mb-1">Opening Balance</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-stone-400 font-bold text-sm">KES</span>
                        <input
                            type="number"
                            className="bg-transparent border-none p-0 text-2xl font-bold focus:ring-0 w-full"
                            value={log.opening_balance || ''}
                            placeholder="0.00"
                            disabled={isReadOnly}
                            onChange={(e) => setLog({ ...log, opening_balance: parseFloat(e.target.value) || 0 })}
                        />
                    </div>
                </IOSCard>

                <IOSCard className="p-5 bg-stone-900 text-white border-none shadow-lg shadow-stone-900/20">
                    <p className="text-stone-400 text-[11px] font-bold uppercase tracking-widest mb-1">Closing Balance</p>
                    <p className="text-2xl font-bold">
                        <span className="text-stone-500 mr-2 text-sm">KES</span>
                        {calculatedClosingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <div className="mt-2 h-1 w-full bg-stone-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, (calculatedClosingBalance / (log.opening_balance || 1)) * 100)}%` }}
                        />
                    </div>
                </IOSCard>

                <IOSCard className="p-5 bg-white border-stone-100 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-stone-400 text-[11px] font-bold uppercase tracking-widest mb-2">Daily Movement</p>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                                    <ArrowDownLeft size={14} /> +{paymentsTotal.toLocaleString()}
                                </div>
                                <div className="flex items-center gap-2 text-rose-600 text-xs font-bold">
                                    <ArrowUpRight size={14} /> -{expensesTotal.toLocaleString()}
                                </div>
                            </div>
                        </div>
                        <div className={`p-2 rounded-xl ${paymentsTotal >= expensesTotal ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            <TrendingUp size={20} />
                        </div>
                    </div>
                </IOSCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payments Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="font-bold text-stone-900 flex items-center gap-2">
                            <ArrowDownLeft size={18} className="text-emerald-500" />
                            Payments Received
                        </h3>
                        {!isReadOnly && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => addLine('recorded_payments')}
                                className="h-8 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs"
                            >
                                <Plus size={14} className="mr-1" /> Add Record
                            </Button>
                        )}
                    </div>

                    <IOSCard className="p-2 bg-white border-stone-100 shadow-sm min-h-[300px]">
                        <div className="space-y-1">
                            {payments.map((line, idx) => {
                                const realIdx = log.lines.indexOf(line);
                                return (
                                    <div key={idx} className="group flex items-center gap-2 p-2 hover:bg-stone-50 rounded-xl transition-colors">
                                        <div className="flex-1 space-y-1">
                                            <Input
                                                className="h-9 bg-transparent border-none font-medium text-sm focus:ring-0 p-0"
                                                placeholder="Description (e.g. M-Pesa Remittance)"
                                                value={line.description}
                                                disabled={isReadOnly}
                                                onChange={(e) => updateLine(realIdx, 'description', e.target.value)}
                                            />
                                            <div className="flex items-center gap-2">
                                                <select
                                                    className="h-6 text-[10px] font-bold uppercase bg-stone-100 border-none rounded-md px-2 focus:ring-0"
                                                    value={line.payment_method || ''}
                                                    disabled={isReadOnly}
                                                    onChange={(e) => updateLine(realIdx, 'payment_method', e.target.value)}
                                                >
                                                    <option value="">Method</option>
                                                    <option value="M-Pesa">M-Pesa</option>
                                                    <option value="Bank">Bank</option>
                                                    <option value="Cash">Cash</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    className="w-28 h-9 bg-stone-50 border-none rounded-lg text-right font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500/20 pr-8"
                                                    value={line.amount || ''}
                                                    placeholder="0.00"
                                                    disabled={isReadOnly}
                                                    onChange={(e) => updateLine(realIdx, 'amount', parseFloat(e.target.value) || 0)}
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-500/50">KES</span>
                                            </div>
                                            {!isReadOnly && (
                                                <button
                                                    onClick={() => removeLine(realIdx)}
                                                    className="opacity-0 group-hover:opacity-100 p-2 text-stone-300 hover:text-rose-500 transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {payments.length === 0 && (
                                <div className="flex flex-col items-center justify-center p-12 text-stone-400">
                                    <Loader2 size={32} className="mb-2 opacity-20" />
                                    <p className="text-xs font-medium italic">No payments recorded for today</p>
                                </div>
                            )}
                        </div>
                    </IOSCard>
                </div>

                {/* Expenses Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="font-bold text-stone-900 flex items-center gap-2">
                            <ArrowUpRight size={18} className="text-rose-500" />
                            Daily Expenses
                        </h3>
                        {!isReadOnly && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => addLine('petty_cash_expenses')}
                                className="h-8 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs"
                            >
                                <Plus size={14} className="mr-1" /> Add Record
                            </Button>
                        )}
                    </div>

                    <IOSCard className="p-2 bg-white border-stone-100 shadow-sm min-h-[300px]">
                        <div className="space-y-1">
                            {expenses.map((line, idx) => {
                                const realIdx = log.lines.indexOf(line);
                                return (
                                    <div key={idx} className="group flex items-center gap-2 p-2 hover:bg-stone-50 rounded-xl transition-colors">
                                        <div className="flex-1 space-y-1">
                                            <Input
                                                className="h-9 bg-transparent border-none font-medium text-sm focus:ring-0 p-0"
                                                placeholder="Expense Description"
                                                value={line.description}
                                                disabled={isReadOnly}
                                                onChange={(e) => updateLine(realIdx, 'description', e.target.value)}
                                            />
                                            <div className="flex items-center gap-2">
                                                <select
                                                    className="h-6 text-[10px] font-bold uppercase bg-stone-100 border-none rounded-md px-2 focus:ring-0"
                                                    value={line.category || ''}
                                                    disabled={isReadOnly}
                                                    onChange={(e) => updateLine(realIdx, 'category', e.target.value)}
                                                >
                                                    <option value="">Category</option>
                                                    <option value="Supplies">Supplies</option>
                                                    <option value="Maintenance">Maintenance</option>
                                                    <option value="Transport">Transport</option>
                                                    <option value="Salaries">Salaries</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    className="w-28 h-9 bg-stone-50 border-none rounded-lg text-right font-bold text-rose-700 focus:ring-2 focus:ring-rose-500/20 pr-8"
                                                    value={line.amount || ''}
                                                    placeholder="0.00"
                                                    disabled={isReadOnly}
                                                    onChange={(e) => updateLine(realIdx, 'amount', parseFloat(e.target.value) || 0)}
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-rose-500/50">KES</span>
                                            </div>
                                            {!isReadOnly && (
                                                <button
                                                    onClick={() => removeLine(realIdx)}
                                                    className="opacity-0 group-hover:opacity-100 p-2 text-stone-300 hover:text-rose-500 transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {expenses.length === 0 && (
                                <div className="flex flex-col items-center justify-center p-12 text-stone-400">
                                    <Loader2 size={32} className="mb-2 opacity-20" />
                                    <p className="text-xs font-medium italic">No expenses recorded for today</p>
                                </div>
                            )}
                        </div>
                    </IOSCard>
                </div>
            </div>

            {/* Notes Section */}
            <IOSCard className="p-5 bg-white border-stone-100 shadow-sm">
                <h3 className="font-bold text-stone-900 mb-4 flex items-center gap-2">
                    <FileText size={18} className="text-stone-400" />
                    General Notes & Observations
                </h3>
                <textarea
                    className="w-full h-24 p-4 rounded-2xl bg-stone-50 border-none text-sm font-medium focus:ring-2 focus:ring-stone-900/5 resize-none"
                    placeholder="Add any daily notes, variances, or comments here..."
                    value={log.notes}
                    disabled={isReadOnly}
                    onChange={(e) => setLog({ ...log, notes: e.target.value })}
                />
            </IOSCard>

            {/* Footer Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl shadow-lg shadow-stone-200 border border-stone-100 sticky bottom-6 z-10">
                <div className="flex items-center gap-4 px-2">
                    <div className="text-left">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Calculated Balance</p>
                        <p className="text-lg font-black text-stone-900">KES {calculatedClosingBalance.toLocaleString()}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {!isReadOnly && (
                        <>
                            <Button
                                variant="ghost"
                                onClick={() => handleSave('draft')}
                                disabled={isSaving}
                                className="flex-1 sm:flex-none h-12 px-6 rounded-2xl font-bold text-stone-600 hover:bg-stone-100 transition-all"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                Save Draft
                            </Button>
                            <Button
                                onClick={() => handleSave('submitted')}
                                disabled={isSaving}
                                className="flex-1 sm:flex-none h-12 px-8 rounded-2xl bg-stone-900 text-white font-bold shadow-xl shadow-stone-900/20 hover:bg-black transition-all active:scale-95"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                                Submit for Verification
                            </Button>
                        </>
                    )}
                    {log.status === 'verified' && (
                        <div className="flex items-center gap-2 text-emerald-600 font-bold bg-emerald-50 px-6 py-3 rounded-2xl">
                            <Shield size={20} /> Verified by Auditor
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
