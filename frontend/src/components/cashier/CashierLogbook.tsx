'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { fetchAPI } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Calculator, AlertCircle, FileText, Check, TrendingUp, Shield, Clock } from 'lucide-react';
import { IOSCard } from '@/components/ui/ios-card';
import { Input } from '@/components/ui/input';
import { IOSButton } from '@/components/ui/ios-button';

interface LogbookLine {
    id?: string;
    section: 'credit_bill' | 'unpaid_bill' | 'paid_bill';
    customer_name: string;
    staff_id?: string; // Added to link to staff profile
    amount: number;
    reference: string;
}

interface LogbookData {
    id?: string;
    opening_float: number;
    closing_float: number;
    sales_breakdown: Record<string, number>;
    total_mpesa: number;
    total_swipe: number;
    notes: string;
    status: 'open' | 'pending_audit' | 'approved' | 'rejected';
    audit_notes?: string;

    // Virtual/Calculated
    credit_bills: LogbookLine[];
    unpaid_bills: LogbookLine[];
    paid_bills: LogbookLine[];
}

interface CashierLogbookProps {
    type: 'reception' | 'bar';
}

export function CashierLogbook({ type }: CashierLogbookProps) {
    const { user } = useAuth();
    const { activeBranch } = useBranch();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [logbook, setLogbook] = useState<LogbookData>({
        opening_float: 0,
        closing_float: 0,
        sales_breakdown: {},
        total_mpesa: 0,
        total_swipe: 0,
        notes: '',
        status: 'open',
        credit_bills: [],
        unpaid_bills: [],
        paid_bills: []
    });
    const [staffList, setStaffList] = useState<any[]>([]);

    useEffect(() => {
        loadStaff();
    }, []);

    const loadStaff = async () => {
        try {
            const res = await fetchAPI('/staff?status=active') as any;
            if (res.success) setStaffList(res.data);
        } catch (error) {
            console.error('Failed to load staff list', error);
        }
    };


    // Configuration based on type
    const isCentral = activeBranch?.is_main_branch || activeBranch?.name?.toLowerCase().includes('central');

    const salesColumns = type === 'reception'
        ? ['Restaurant', 'Accommodation', 'Swimming Pool', 'Conference', 'Events']
        : isCentral
            ? ['Executive Bar', 'Main Bar', 'Pool Tables', 'Pool Bar', 'Restaurant Drinks', 'Cocktails']
            : ['Main Bar', 'Pool Bar', 'Restaurant Drinks', 'Cocktails'];

    useEffect(() => {
        loadLogbook();
    }, [type]);

    const loadLogbook = async () => {
        setIsLoading(true);
        try {
            // Fetch today's logbook if exists
            // This is a mock call for now, assuming implementation of GET /cashier/logbook/today
            // We'll simulate empty or existing
            const response = await fetchAPI(`/cashier/logbook/today?type=${type}`) as any;
            if (response.success && response.data) {
                setLogbook(response.data); // Assuming API returns joined lines
            }
        } catch (error) {
            console.error(error); // Silently fail for new logbook
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (status: 'open' | 'pending_audit') => {
        setIsSaving(true);
        try {
            const payload = {
                ...logbook,
                type,
                status
            };

            const response = await fetchAPI('/cashier/logbook', {
                method: 'POST',
                body: JSON.stringify(payload)
            }) as any;

            if (response.success) {
                toast.success(status === 'pending_audit' ? 'Logbook submitted for audit' : 'Logbook saved successfully');
                if (response.data) setLogbook(prev => ({ ...prev, ...response.data }));
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to save logbook');
        } finally {
            setIsSaving(false);
        }
    };

    // Helper to calculate totals
    const getBreakdownTotal = () => Object.values(logbook.sales_breakdown).reduce((a, b) => a + (Number(b) || 0), 0);
    const getSectionTotal = (lines: LogbookLine[]) => lines.reduce((a, b) => a + (Number(b.amount) || 0), 0);

    const totalSales = getBreakdownTotal();
    const totalCredits = getSectionTotal(logbook.credit_bills);
    const totalUnpaid = getSectionTotal(logbook.unpaid_bills);
    const totalPaidBills = getSectionTotal(logbook.paid_bills);

    // Cash Expected = (Total Sales + Paid Bills + Opening Float) - (Credits + Unpaid + Mpesa + Swipe + Closing Float)
    // Wait, Closing float is usually retained cash. 
    // Usually: Cash Handled = Sales + Paid Bills.
    // Cash Accounted For = Credits + Unpaid + Mpesa + Swipe + Cash(Actual)
    // Let's use simple balancing:
    // Inflow: Opening Float + Total Sales + Paid Bills (cash collected from debts)
    // Outflow/Non-Cash: Credits + Unpaid + Mpesa + Swipe
    // Expected Cash In Hand (to be remitted) = Inflow - Outflow - Closing Float (if kept)
    // or Expected Cash = Inflow - Outflow.
    const expectedCash = (logbook.opening_float + totalSales + totalPaidBills) - (totalCredits + totalUnpaid + logbook.total_mpesa + logbook.total_swipe);
    const variance = (logbook.closing_float) - expectedCash; // Assuming closing_float IS the cash actual entered. Wait, usually closing float is "Float carried forward".
    // Let's add a separate "Cash Remitted" or "Cash Actual" field?
    // In the physical book image: "Cash" 49400.
    // The image has "Sales Breakdown", then "Less: Vouchers", "Closing Float".
    // So: Sales - Vouchers - Closing Float = Cash? 
    // Let's just use a simple "Cash Actual" field for "Cash In Hand". 
    // Logbook has "Closing Float" at top. Maybe that's next day's float?
    // Let's assume user enters "Cash Actual" as the cash they have.

    // Line Item Manager
    const addLine = (section: 'credit_bills' | 'unpaid_bills' | 'paid_bills') => {
        setLogbook(prev => ({
            ...prev,
            [section]: [...prev[section], { section: section.slice(0, -1), customer_name: '', amount: 0, reference: '' }]
        }));
    };

    const updateLine = (section: keyof LogbookData, index: number, field: keyof LogbookLine, value: any) => {
        if (!Array.isArray(logbook[section])) return;
        const newLines = [...(logbook[section] as LogbookLine[])];
        newLines[index] = { ...newLines[index], [field]: value };
        setLogbook(prev => ({ ...prev, [section]: newLines }));
    };

    const removeLine = (section: keyof LogbookData, index: number) => {
        if (!Array.isArray(logbook[section])) return;
        const newLines = [...(logbook[section] as LogbookLine[])];
        newLines.splice(index, 1);
        setLogbook(prev => ({ ...prev, [section]: newLines }));
    };

    const isReadOnly = logbook.status === 'approved' || logbook.status === 'pending_audit';

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
            {/* Status Header */}
            {logbook.status !== 'open' && (
                <div className={`p-4 rounded-2xl flex items-center justify-between border ${logbook.status === 'approved' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                    logbook.status === 'rejected' ? 'bg-rose-50 border-rose-100 text-rose-800' :
                        'bg-amber-50 border-amber-100 text-amber-800'
                    }`}>
                    <div className="flex items-center gap-3">
                        <Shield size={20} />
                        <div>
                            <p className="text-[13px] font-bold uppercase tracking-widest">
                                Status: {logbook.status?.replace('_', ' ')}
                            </p>
                            {logbook.status === 'rejected' && logbook.audit_notes && (
                                <p className="text-[12px] font-medium mt-0.5">Note: {logbook.audit_notes}</p>
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
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <IOSCard className="p-4 bg-blue-600 text-white border-none shadow-lg shadow-blue-900/20">
                    <div className="flex justify-between items-start">
                        <p className="text-blue-100 text-xs uppercase font-bold">Total Sales</p>
                        <TrendingUp size={16} className="text-blue-200" />
                    </div>
                    <p className="text-2xl font-bold mt-1">KES {totalSales.toLocaleString()}</p>
                </IOSCard>
                <IOSCard className={`p-4 border-none shadow-lg ${variance < 0 ? 'bg-rose-600 text-white shadow-rose-900/20' : variance > 0 ? 'bg-emerald-600 text-white shadow-emerald-900/20' : 'bg-stone-800 text-white shadow-stone-900/20'}`}>
                    <div className="flex justify-between items-start">
                        <p className="text-white/80 text-xs uppercase font-bold">Variance</p>
                        {variance < 0 ? <AlertCircle size={16} className="text-rose-200" /> : <Check size={16} className="text-emerald-200" />}
                    </div>
                    <p className="text-2xl font-bold mt-1">KES {variance.toLocaleString()}</p>
                    <p className="text-[10px] mt-1 opacity-80">Expected: {expectedCash.toLocaleString()}</p>
                </IOSCard>
                <IOSCard className="p-4 bg-white border-none shadow-sm">
                    <p className="text-stone-400 text-xs uppercase font-bold mb-2">Opening Float</p>
                    <Input
                        type="number"
                        className="h-8 bg-stone-50 font-bold"
                        value={logbook.opening_float}
                        disabled={isReadOnly}
                        onChange={e => setLogbook({ ...logbook, opening_float: parseFloat(e.target.value) || 0 })}
                    />
                </IOSCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Sales & Deductions */}
                <div className="space-y-6">
                    <IOSCard className="p-5 bg-white border-none shadow-sm">
                        <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
                            <Calculator size={16} className="text-orange-600" />
                            Sales Breakdown
                        </h3>
                        <div className="space-y-3">
                            {salesColumns.map(col => (
                                <div key={col} className="flex items-center justify-between gap-4">
                                    <label className="text-sm text-stone-600 font-medium">{col}</label>
                                    <Input
                                        type="number"
                                        className="w-32 h-9 bg-stone-50 text-right font-medium"
                                        value={logbook.sales_breakdown[col] || ''}
                                        disabled={isReadOnly}
                                        onChange={e => setLogbook({
                                            ...logbook,
                                            sales_breakdown: { ...logbook.sales_breakdown, [col]: parseFloat(e.target.value) || 0 }
                                        })}
                                    />
                                </div>
                            ))}
                            <div className="pt-3 mt-2 border-t border-stone-100 flex justify-between font-bold text-stone-900 bg-stone-50/50 p-2 rounded-lg">
                                <span>Total Sales</span>
                                <span>KES {totalSales.toLocaleString()}</span>
                            </div>
                        </div>
                    </IOSCard>

                    <IOSCard className="p-5 bg-white border-none shadow-sm">
                        <h3 className="font-bold text-stone-800 mb-4">Non-Cash Deductions</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs uppercase font-bold text-stone-400 mb-1 block">M-Pesa Total</label>
                                <Input
                                    type="number"
                                    className="bg-stone-50 font-bold"
                                    value={logbook.total_mpesa || ''}
                                    disabled={isReadOnly}
                                    onChange={e => setLogbook({ ...logbook, total_mpesa: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div>
                                <label className="text-xs uppercase font-bold text-stone-400 mb-1 block">Swipe (Card/PDQ)</label>
                                <Input
                                    type="number"
                                    className="bg-stone-50 font-bold"
                                    value={logbook.total_swipe || ''}
                                    disabled={isReadOnly}
                                    onChange={e => setLogbook({ ...logbook, total_swipe: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                    </IOSCard>

                    <IOSCard className="p-5 bg-white border-none shadow-sm">
                        <h3 className="font-bold text-stone-800 mb-4">Closing Reconciliation</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs uppercase font-bold text-stone-400 mb-1 block">Cash In Hand (Actual)</label>
                                <Input
                                    type="number"
                                    className="bg-stone-50 font-bold text-lg"
                                    value={logbook.closing_float || ''}
                                    disabled={isReadOnly}
                                    onChange={e => setLogbook({ ...logbook, closing_float: parseFloat(e.target.value) || 0 })}
                                // Using closing_float as "Cash Actual" for now based on logic above, or we can add specific field later.
                                // For now, let's treat 'closing_float' as the Cash Counted.
                                />
                                <p className="text-[10px] text-stone-400 mt-1">Enter total cash counted in drawer.</p>
                            </div>
                        </div>
                    </IOSCard>
                </div>

                {/* Right Column: Bills Lists */}
                <div className="space-y-6">
                    {/* Credit Bills */}
                    <IOSCard className="p-5 bg-white border-none shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                <FileText size={16} className="text-orange-600" />
                                Credit Bills (Staff/House)
                            </h3>
                            {!isReadOnly && (
                                <button onClick={() => addLine('credit_bills')} className="p-1 rounded bg-stone-100 hover:bg-stone-200"><Plus size={16} /></button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {logbook.credit_bills.map((line, i) => (
                                <div key={i} className="flex gap-2">
                                    <select
                                        className="h-8 text-xs flex-1 bg-stone-50 border border-stone-200 rounded px-2"
                                        value={line.staff_id || ''}
                                        disabled={isReadOnly}
                                        onChange={e => {
                                            const staffId = e.target.value;
                                            const staff = staffList.find(s => s.id === staffId);
                                            // Update both staff_id and name for display
                                            updateLine('credit_bills', i, 'staff_id', staffId);
                                            updateLine('credit_bills', i, 'customer_name', staff ? `${staff.first_name} ${staff.last_name}` : '');
                                        }}
                                    >
                                        <option value="">Select Staff Member</option>
                                        {staffList.map(staff => (
                                            <option key={staff.id} value={staff.id}>
                                                {staff.first_name} {staff.last_name} ({staff.role})
                                            </option>
                                        ))}
                                    </select>
                                    <Input
                                        placeholder="Amount"
                                        type="number"
                                        className="h-8 text-xs w-24 text-right"
                                        value={line.amount || ''}
                                        disabled={isReadOnly}
                                        onChange={e => updateLine('credit_bills', i, 'amount', parseFloat(e.target.value))}
                                    />
                                    {!isReadOnly && (
                                        <button onClick={() => removeLine('credit_bills', i)} className="text-stone-400 hover:text-red-500"><Trash2 size={14} /></button>
                                    )}
                                </div>
                            ))}
                            <div className="flex justify-end font-bold text-sm pt-2 border-t border-stone-50">
                                <span>Total: {totalCredits.toLocaleString()}</span>
                            </div>
                        </div>
                    </IOSCard>

                    {/* Unpaid Bills */}
                    <IOSCard className="p-5 bg-white border-none shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                <AlertCircle size={16} className="text-rose-600" />
                                Unpaid Bills (Pending)
                            </h3>
                            {!isReadOnly && (
                                <button onClick={() => addLine('unpaid_bills')} className="p-1 rounded bg-stone-100 hover:bg-stone-200"><Plus size={16} /></button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {logbook.unpaid_bills.map((line, i) => (
                                <div key={i} className="flex gap-2">
                                    <Input
                                        placeholder="Customer/Room"
                                        className="h-8 text-xs flex-1"
                                        value={line.customer_name}
                                        disabled={isReadOnly}
                                        onChange={e => updateLine('unpaid_bills', i, 'customer_name', e.target.value)}
                                    />
                                    <Input
                                        placeholder="Amount"
                                        type="number"
                                        className="h-8 text-xs w-24 text-right"
                                        value={line.amount || ''}
                                        disabled={isReadOnly}
                                        onChange={e => updateLine('unpaid_bills', i, 'amount', parseFloat(e.target.value))}
                                    />
                                    {!isReadOnly && (
                                        <button onClick={() => removeLine('unpaid_bills', i)} className="text-stone-400 hover:text-red-500"><Trash2 size={14} /></button>
                                    )}
                                </div>
                            ))}
                            <div className="flex justify-end font-bold text-sm pt-2 border-t border-stone-50">
                                <span>Total: {totalUnpaid.toLocaleString()}</span>
                            </div>
                        </div>
                    </IOSCard>

                    {/* Paid Bills */}
                    <IOSCard className="p-5 bg-white border-none shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                <Calculator size={16} className="text-emerald-600" />
                                Paid Bills (Debt Clearance)
                            </h3>
                            {!isReadOnly && (
                                <button onClick={() => addLine('paid_bills')} className="p-1 rounded bg-stone-100 hover:bg-stone-200"><Plus size={16} /></button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {logbook.paid_bills.map((line, i) => (
                                <div key={i} className="flex gap-2">
                                    <Input
                                        placeholder="Payer Name"
                                        className="h-8 text-xs flex-1"
                                        value={line.customer_name}
                                        disabled={isReadOnly}
                                        onChange={e => updateLine('paid_bills', i, 'customer_name', e.target.value)}
                                    />
                                    <Input
                                        placeholder="Amount"
                                        type="number"
                                        className="h-8 text-xs w-24 text-right"
                                        value={line.amount || ''}
                                        disabled={isReadOnly}
                                        onChange={e => updateLine('paid_bills', i, 'amount', parseFloat(e.target.value))}
                                    />
                                    {!isReadOnly && (
                                        <button onClick={() => removeLine('paid_bills', i)} className="text-stone-400 hover:text-red-500"><Trash2 size={14} /></button>
                                    )}
                                </div>
                            ))}
                            <div className="flex justify-end font-bold text-sm pt-2 border-t border-stone-50">
                                <span>Total: {totalPaidBills.toLocaleString()}</span>
                            </div>
                        </div>
                    </IOSCard>
                </div>
            </div>

            {/* Actions */}
            {!isReadOnly && (
                <div className="flex justify-end gap-4 p-4 bg-white rounded-xl shadow-sm border border-stone-100">
                    <IOSButton onClick={() => handleSave('open')} className="bg-stone-100 text-stone-800 hover:bg-stone-200 gap-2">
                        <Save size={16} />
                        Save Draft
                    </IOSButton>
                    <IOSButton onClick={() => handleSave('pending_audit')} className="bg-stone-900 hover:bg-black text-white gap-2 shadow-lg shadow-stone-900/20">
                        <Check size={16} />
                        Submit for Audit
                    </IOSButton>
                </div>
            )}
        </div>
    );
}

