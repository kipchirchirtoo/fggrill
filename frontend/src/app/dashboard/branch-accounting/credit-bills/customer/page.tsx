'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { cashierAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { downloadBlob } from '@/lib/api/core';
import {
    ArrowLeft,
    Building2,
    Calendar,
    ChevronDown,
    Filter,
    Loader2,
    MinusCircle,
    Phone,
    Plus,
    PlusCircle,
    Printer,
    Search,
    Tag,
    Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type CreditItem = {
    description: string;
    quantity: string;
    unitPrice: string;
};

type CreditForm = {
    customerName: string;
    customerType: string;
    customerPhone: string;
    billType: string;
    paymentTerms: string;
    dueDate: string;
    remarks: string;
    items: CreditItem[];
};

type UnpaidBill = {
    id: string;
    bill_number?: string;
    scan_reference?: string;
    customer_name?: string;
    customer_type?: string;
    customer_phone?: string;
    total_amount?: number;
    balance_amount?: number;
    payment_terms?: string;
    due_date?: string;
    bill_date?: string;
    created_at?: string;
    status?: string;
    remarks?: string;
    reference_type?: string;
    source_type?: string;
    items?: CreditItem[];
};

const BILL_TYPES = [
    { value: 'conference', label: 'Conference' },
    { value: 'banqueting', label: 'Banqueting' },
    { value: 'accommodation', label: 'Accommodation' },
    { value: 'additional_service', label: 'Additional Service' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'bar', label: 'Bar' },
    { value: 'other', label: 'Other' }
];

const CUSTOMER_TYPES = [
    { value: 'corporate', label: 'Corporate' },
    { value: 'walk_in', label: 'Walk-in' },
    { value: 'guest', label: 'Hotel Guest' },
    { value: 'other', label: 'Other' }
];

const createInitialForm = (): CreditForm => ({
    customerName: '',
    customerType: 'corporate',
    customerPhone: '',
    billType: 'other',
    paymentTerms: '30 days',
    dueDate: new Date().toISOString().split('T')[0],
    remarks: '',
    items: [{ description: '', quantity: '1', unitPrice: '0' }]
});

const formatDate = (val?: string | null) => {
    if (!val) return '—';
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

const escapeHtml = (val: string) =>
    val
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

export default function BranchCustomerCreditPage() {
    const { activeBranchId, activeBranch } = useBranch();
    const router = useRouter();

    const [form, setForm] = useState<CreditForm>(createInitialForm);
    const [bills, setBills] = useState<UnpaidBill[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const totalAmount = useMemo(() => {
        return form.items.reduce((sum, item) => {
            const qty = parseFloat(item.quantity || '0');
            const price = parseFloat(item.unitPrice || '0');
            if (Number.isNaN(qty) || Number.isNaN(price)) return sum;
            return sum + qty * price;
        }, 0);
    }, [form.items]);

    const filteredBills = useMemo(() => {
        const term = search.trim().toLowerCase();
        const scoped = bills.filter(bill => {
            if (!bill) return false;
            if (bill.source_type === 'KYOGONG') return false;
            if (bill.reference_type && bill.reference_type !== 'branch_customer_credit') return false;
            const typeOk = !bill.reference_type
                ? ['corporate', 'walk_in', 'guest', 'other'].includes((bill.customer_type || '').toLowerCase())
                : true;
            if (!typeOk) return false;
            if (!term) return true;
            return (
                bill.customer_name?.toLowerCase().includes(term) ||
                bill.bill_number?.toLowerCase().includes(term) ||
                bill.scan_reference?.toLowerCase().includes(term)
            );
        });

        return scoped.sort((a, b) => {
            const aDate = new Date(a.bill_date || a.created_at || '').getTime();
            const bDate = new Date(b.bill_date || b.created_at || '').getTime();
            return bDate - aDate;
        });
    }, [bills, search]);

    const totalOutstanding = useMemo(() => {
        return filteredBills.reduce((sum, bill) => sum + (Number(bill.balance_amount) || Number(bill.total_amount) || 0), 0);
    }, [filteredBills]);

    const handlePrintOutstanding = useCallback(() => {
        if (typeof window === 'undefined') return;

        if (!filteredBills.length) {
            toast.info('No customer credit bills to print.');
            return;
        }

        const printWindow = window.open('', '_blank', 'width=900,height=650');
        if (!printWindow) {
            toast.error('Unable to open print dialog. Please check your popup settings.');
            return;
        }

        const branchTitle = activeBranch?.name ? escapeHtml(activeBranch.name) : 'Branch';

        const billsHtml = filteredBills.map((bill, index) => {
            const outstanding = Number(bill.balance_amount ?? bill.total_amount ?? 0);
            const statusLabel = (bill.status || 'pending').replace(/_/g, ' ').toUpperCase();
            const lineItemsHtml = (bill.items || []).map((item: any, idx: number) => {
                const qty = Number(item.quantity ?? item.qty ?? 0);
                const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0);
                const amount = qty * unitPrice;
                return `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${escapeHtml(item.description || '—')}</td>
                        <td>${qty.toLocaleString()}</td>
                        <td>${escapeHtml(formatCurrency(unitPrice))}</td>
                        <td>${escapeHtml(formatCurrency(amount))}</td>
                    </tr>
                `;
            }).join('');

            const safeRemarks = bill.remarks ? `<p class="remarks"><strong>Remarks:</strong> ${escapeHtml(bill.remarks)}</p>` : '';

            return `
                <section class="bill">
                    <header class="bill__header">
                        <div>
                            <h2>${index + 1}. ${escapeHtml(bill.customer_name || 'Unnamed Customer')}</h2>
                            <p class="muted">Bill # ${escapeHtml(bill.bill_number || bill.id)}</p>
                        </div>
                        <div class="status">${escapeHtml(statusLabel)}</div>
                    </header>
                    <div class="bill__meta">
                        <div><span>Total</span><strong>${escapeHtml(formatCurrency(Number(bill.total_amount) || 0))}</strong></div>
                        <div><span>Outstanding</span><strong>${escapeHtml(formatCurrency(outstanding))}</strong></div>
                        <div><span>Due Date</span><strong>${escapeHtml(formatDate(bill.due_date))}</strong></div>
                        <div><span>Payment Terms</span><strong>${escapeHtml(bill.payment_terms || 'N/A')}</strong></div>
                        <div><span>Created</span><strong>${escapeHtml(formatDate(bill.bill_date || bill.created_at))}</strong></div>
                        ${bill.scan_reference ? `<div><span>Reference ID</span><strong>${escapeHtml(bill.scan_reference)}</strong></div>` : ''}
                        ${bill.customer_phone ? `<div><span>Contact</span><strong>${escapeHtml(bill.customer_phone)}</strong></div>` : ''}
                    </div>
                    ${safeRemarks}
                    <table class="items">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Description</th>
                                <th>Qty</th>
                                <th>Unit Price</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lineItemsHtml || '<tr><td colspan="5" class="muted">No line items captured.</td></tr>'}
                        </tbody>
                    </table>
                </section>
            `;
        }).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Outstanding Customer Bills</title>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #1f2933; }
                        h1 { margin-bottom: 6px; }
                        .subtitle { color: #6b7280; margin-bottom: 24px; }
                        .bill { padding: 16px 20px; border: 1px solid #e5e7eb; border-radius: 16px; margin-bottom: 18px; box-shadow: 0 8px 14px -10px rgba(15, 23, 42, 0.2); }
                        .bill__header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
                        .bill__header h2 { margin: 0; font-size: 18px; }
                        .muted { color: #6b7280; font-size: 12px; }
                        .status { padding: 4px 12px; border-radius: 9999px; background: #fef3c7; color: #b45309; font-weight: 600; font-size: 12px; letter-spacing: 0.4px; }
                        .bill__meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 16px 0; }
                        .bill__meta span { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; }
                        .bill__meta strong { font-size: 14px; color: #111827; }
                        .remarks { margin-bottom: 14px; font-size: 13px; color: #374151; }
                        table { width: 100%; border-collapse: collapse; font-size: 13px; }
                        th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
                        th { background: #f3f4f6; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
                        @media print {
                            body { padding: 0; }
                            .bill { box-shadow: none; page-break-inside: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <h1>Outstanding Customer Bills</h1>
                    <p class="subtitle">${branchTitle} • Printed on ${escapeHtml(new Date().toLocaleString())}</p>
                    ${billsHtml}
                </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }, [filteredBills, activeBranch]);

    const loadBills = useCallback(async () => {
        if (!activeBranchId) return;
        setLoading(true);
        try {
            const response = await cashierAPI.getUnpaidBills({ branch_id: activeBranchId });
            if (response?.success && Array.isArray(response.data)) {
                setBills(response.data as UnpaidBill[]);
            } else if (response && !response.success) {
                toast.error(response.message || 'Failed to load customer credits');
            }
        } catch (error: any) {
            toast.error(error?.message || 'Failed to load customer credits');
        } finally {
            setLoading(false);
        }
    }, [activeBranchId]);

    useEffect(() => {
        loadBills();
    }, [loadBills]);

    const resetForm = () => {
        setForm(createInitialForm());
        setExpandedRow(null);
    };

    const handleItemChange = (index: number, field: keyof CreditItem, value: string) => {
        setForm(prev => ({
            ...prev,
            items: prev.items.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
        }));
    };

    const handleAddItem = () => {
        setForm(prev => ({
            ...prev,
            items: [...prev.items, { description: '', quantity: '1', unitPrice: '0' }]
        }));
    };

    const handleRemoveItem = (index: number) => {
        setForm(prev => ({
            ...prev,
            items: prev.items.filter((_, idx) => idx !== index)
        }));
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!activeBranchId) {
            toast.error('Select a branch first.');
            return;
        }

        if (!form.customerName.trim()) {
            toast.error('Customer name is required.');
            return;
        }

        if (form.items.some(item => !item.description.trim())) {
            toast.error('Each line item needs a description.');
            return;
        }

        const parsedItems = form.items.map(item => ({
            description: item.description.trim(),
            quantity: parseFloat(item.quantity || '0'),
            unitPrice: parseFloat(item.unitPrice || '0')
        }));

        if (parsedItems.some(item => item.quantity <= 0 || item.unitPrice < 0)) {
            toast.error('Ensure quantities and unit prices are valid.');
            return;
        }

        if (totalAmount <= 0) {
            toast.error('Total amount must be greater than zero.');
            return;
        }

        setCreating(true);
        try {
            const payload = {
                branch_id: activeBranchId,
                bill_type: form.billType,
                reference_type: 'branch_customer_credit',
                customer_type: form.customerType,
                customer_name: form.customerName.trim(),
                customer_phone: form.customerPhone.trim() || undefined,
                total_amount: Number(totalAmount.toFixed(2)),
                payment_terms: form.paymentTerms.trim() || undefined,
                due_date: form.dueDate || null,
                remarks: form.remarks.trim() || undefined,
                items: parsedItems
            };

            const response = await cashierAPI.createUnpaidBill(payload);
            if (response?.success) {
                toast.success('Customer credit bill recorded.');
                resetForm();
                await loadBills();
            } else {
                toast.error(response?.message || 'Failed to record customer credit bill');
            }
        } catch (error: any) {
            toast.error(error?.message || 'Failed to record customer credit bill');
        } finally {
            setCreating(false);
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <IOSButton variant="secondary" onClick={() => router.back()} leftIcon={<ArrowLeft />}>Back</IOSButton>
                            <div>
                                <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
                                    <Users className="h-6 w-6 text-blue-600" />
                                    Customer Credit Bills
                                </h1>
                                <p className="text-stone-500">Record and monitor credit extended to corporate or walk-in customers.</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={loadBills} leftIcon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
                                disabled={loading}>
                                Refresh
                            </IOSButton>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <IOSCard className="p-4">
                            <p className="text-xs font-semibold text-stone-500 uppercase mb-1">Outstanding Balance</p>
                            <p className="text-2xl font-bold text-stone-900">{formatCurrency(totalOutstanding)}</p>
                            <p className="text-xs text-stone-400 mt-1">Across {filteredBills.length} active customer bills</p>
                        </IOSCard>
                        <IOSCard className="p-4">
                            <p className="text-xs font-semibold text-stone-500 uppercase mb-1">Active Branch</p>
                            <div className="flex items-center gap-2 text-stone-900 font-semibold">
                                <Building2 className="h-4 w-4 text-blue-600" />
                                {activeBranchId ? `Branch #${activeBranchId}` : 'Select a branch'}
                            </div>
                            <p className="text-xs text-stone-400 mt-1">Branch-scoped credit visibility</p>
                        </IOSCard>
                        <IOSCard className="p-4">
                            <p className="text-xs font-semibold text-stone-500 uppercase mb-1">Quick Tip</p>
                            <p className="text-sm text-stone-600">Use detailed line items to justify deductions during reconciliation and audits.</p>
                        </IOSCard>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                        <IOSCard className="p-6 space-y-6">
                            <div>
                                <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                                    <Plus className="h-5 w-5 text-blue-600" />
                                    New Customer Credit Bill
                                </h2>
                                <p className="text-sm text-stone-500">Capture the exact amount extended so it reflects in payroll recoveries and shift audits.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-stone-700">Customer Name<span className="text-red-500">*</span></label>
                                        <input
                                            className="w-full h-11 px-4 rounded-xl border border-stone-200 focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g. Acme Corp"
                                            value={form.customerName}
                                            onChange={e => setForm(prev => ({ ...prev, customerName: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-stone-700">Customer Type</label>
                                        <select
                                            className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-blue-500"
                                            value={form.customerType}
                                            onChange={e => setForm(prev => ({ ...prev, customerType: e.target.value }))}
                                        >
                                            {CUSTOMER_TYPES.map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-stone-700 flex items-center gap-2"><Phone className="h-4 w-4 text-blue-500" /> Contact Phone</label>
                                        <input
                                            className="w-full h-11 px-4 rounded-xl border border-stone-200 focus:ring-2 focus:ring-blue-500"
                                            placeholder="Optional"
                                            value={form.customerPhone}
                                            onChange={e => setForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-stone-700 flex items-center gap-2"><Tag className="h-4 w-4 text-blue-500" /> Bill Category</label>
                                        <select
                                            className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-blue-500"
                                            value={form.billType}
                                            onChange={e => setForm(prev => ({ ...prev, billType: e.target.value }))}
                                        >
                                            {BILL_TYPES.map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-stone-700 flex items-center gap-2"><Calendar className="h-4 w-4 text-blue-500" /> Due Date</label>
                                        <input
                                            type="date"
                                            className="w-full h-11 px-4 rounded-xl border border-stone-200 focus:ring-2 focus:ring-blue-500"
                                            value={form.dueDate}
                                            onChange={e => setForm(prev => ({ ...prev, dueDate: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-stone-700">Payment Terms</label>
                                        <input
                                            className="w-full h-11 px-4 rounded-xl border border-stone-200 focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g. Net 30"
                                            value={form.paymentTerms}
                                            onChange={e => setForm(prev => ({ ...prev, paymentTerms: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-semibold text-stone-800">Line Items</h3>
                                            <p className="text-xs text-stone-500">Detail what was offered on credit to create a paper trail.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleAddItem}
                                            className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                        >
                                            <PlusCircle className="h-4 w-4" />
                                            Add Item
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {form.items.map((item, index) => (
                                            <div key={index} className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_auto] items-start border border-stone-200 rounded-xl px-4 py-3 bg-stone-50">
                                                <input
                                                    className="h-10 px-3 rounded-lg border border-stone-200 focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Item / Service description"
                                                    value={item.description}
                                                    onChange={e => handleItemChange(index, 'description', e.target.value)}
                                                />
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="h-10 px-3 rounded-lg border border-stone-200 focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Qty"
                                                    value={item.quantity}
                                                    onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                                                />
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="h-10 px-3 rounded-lg border border-stone-200 focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Unit Price"
                                                    value={item.unitPrice}
                                                    onChange={e => handleItemChange(index, 'unitPrice', e.target.value)}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(index)}
                                                    className="text-stone-400 hover:text-red-600 transition-colors"
                                                    disabled={form.items.length === 1}
                                                >
                                                    <MinusCircle className="h-5 w-5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-stone-700">Internal Notes</label>
                                    <textarea
                                        className="w-full h-24 px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-blue-500 resize-none"
                                        placeholder="Optional remarks that help audit teams understand the charge"
                                        value={form.remarks}
                                        onChange={e => setForm(prev => ({ ...prev, remarks: e.target.value }))}
                                    />
                                </div>

                                <div className="flex items-center justify-between border-t border-stone-200 pt-4">
                                    <div>
                                        <p className="text-xs font-semibold text-stone-500 uppercase">Credit Total</p>
                                        <p className="text-2xl font-bold text-stone-900">{formatCurrency(totalAmount)}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <IOSButton type="button" variant="secondary" onClick={resetForm}>Clear</IOSButton>
                                        <IOSButton type="submit" disabled={creating} leftIcon={creating ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}>
                                            {creating ? 'Saving...' : 'Record Credit Bill'}
                                        </IOSButton>
                                    </div>
                                </div>
                            </form>
                        </IOSCard>

                        <IOSCard className="p-6 space-y-5">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-stone-900">Outstanding Customer Bills</h2>
                                    <p className="text-sm text-stone-500">Track balances awaiting settlement.</p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                    <div className="relative flex-1 sm:flex-none sm:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                        <input
                                            className="pl-9 pr-3 h-10 w-full rounded-lg border border-stone-200 focus:ring-2 focus:ring-blue-500"
                                            placeholder="Search by customer or bill #"
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                        />
                                    </div>
                                    <IOSButton
                                        variant="outline"
                                        onClick={async () => {
                                            if (!activeBranchId) {
                                                toast.error('Select a branch first.');
                                                return;
                                            }
                                            const toastId = toast.loading('Preparing branded outstanding report...');
                                            try {
                                                const response = await cashierAPI.downloadOutstandingCustomerCredits({
                                                    branch_id: activeBranchId,
                                                    ...(search ? { search } : {}),
                                                });
                                                if (response.success && response.data) {
                                                    downloadBlob(response.data, `Outstanding-Customer-Credits-${new Date().toISOString().split('T')[0]}.pdf`);
                                                    toast.success('Branded outstanding report ready.', { id: toastId });
                                                } else {
                                                    throw new Error(response.message || 'Download failed');
                                                }
                                            } catch (error: any) {
                                                console.error('Outstanding report download failed:', error);
                                                toast.error(error?.message || 'Failed to download branded outstanding report', { id: toastId });
                                            }
                                        }}
                                        leftIcon={<Printer className="h-4 w-4" />}
                                    >
                                        Print List
                                    </IOSButton>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {loading && (
                                    <div className="px-4 py-14 text-center text-sm text-stone-500 flex items-center justify-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Generating customer credits...
                                    </div>
                                )}

                                {!loading && filteredBills.length === 0 && (
                                    <div className="px-4 py-12 text-center text-sm text-stone-500 border border-dashed border-stone-200 rounded-2xl">
                                        No customer credit bills recorded for this branch yet.
                                    </div>
                                )}

                                {!loading && filteredBills.map(bill => {
                                    const outstanding = Number(bill.balance_amount ?? bill.total_amount ?? 0);
                                    const settled = outstanding <= 0 || (bill.status && ['paid', 'paid_cash', 'deducted'].includes(bill.status));
                                    const isExpanded = expandedRow === bill.id;
                                    const statusLabel = (bill.status || 'pending').replace(/_/g, ' ').toUpperCase();
                                    const statusClass = settled
                                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                        : 'bg-amber-100 text-amber-700 border border-amber-200';

                                    return (
                                        <div
                                            key={bill.id}
                                            className="rounded-2xl border border-stone-200 bg-white/95 p-5 shadow-sm transition-all hover:shadow-md"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                                <div className="min-w-0 space-y-1">
                                                    <p className="text-lg font-semibold text-stone-900 break-words">
                                                        {bill.customer_name || 'Unnamed Customer'}
                                                    </p>
                                                    <p className="text-xs text-stone-400 tracking-wide uppercase break-all">
                                                        {bill.bill_number || bill.id}
                                                    </p>
                                                    {bill.scan_reference && (
                                                        <p className="text-xs font-semibold tracking-wide uppercase text-blue-600 flex items-center gap-1 break-all">
                                                            <Tag className="h-3 w-3 shrink-0" />
                                                            <span className="font-mono tracking-normal break-all">{bill.scan_reference}</span>
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${statusClass}`}>
                                                        {statusLabel}
                                                    </span>
                                                    <IOSButton
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={async () => {
                                                            const toastId = toast.loading('Preparing branded invoice...');
                                                            try {
                                                                const response = await cashierAPI.downloadUnpaidBillInvoice(bill.id);
                                                                if (response.success && response.data) {
                                                                    const filename = `${(bill.bill_number || bill.id)}.pdf`;
                                                                    downloadBlob(response.data, filename);
                                                                    toast.success('Invoice ready for download.', { id: toastId });
                                                                } else {
                                                                    throw new Error(response.message || 'Download failed');
                                                                }
                                                            } catch (error: any) {
                                                                console.error('Invoice download failed:', error);
                                                                toast.error(error?.message || 'Failed to download invoice PDF', { id: toastId });
                                                            }
                                                        }}
                                                        leftIcon={<Printer className="h-3 w-3" />}
                                                    >
                                                        Print Invoice
                                                    </IOSButton>
                                                    <IOSButton
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setExpandedRow(isExpanded ? null : bill.id)}
                                                        rightIcon={<ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />}
                                                    >
                                                        {isExpanded ? 'Hide details' : 'View details'}
                                                    </IOSButton>
                                                </div>
                                            </div>

                                            <div className="mt-4 grid gap-3 sm:grid-cols-4">
                                                <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                                                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Total</p>
                                                    <p className="text-sm font-semibold text-stone-900 mt-1">{formatCurrency(Number(bill.total_amount) || 0)}</p>
                                                </div>
                                                <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                                                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Outstanding</p>
                                                    <p className={`text-sm font-semibold mt-1 ${settled ? 'text-emerald-700' : 'text-blue-700'}`}>{formatCurrency(outstanding)}</p>
                                                </div>
                                                <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                                                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Due Date</p>
                                                    <p className="text-sm font-semibold text-stone-900 mt-1">{formatDate(bill.due_date)}</p>
                                                </div>
                                                <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                                                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Payment Terms</p>
                                                    <p className="text-sm font-semibold text-stone-900 mt-1">{bill.payment_terms || 'N/A'}</p>
                                                </div>
                                            </div>

                                            {bill.remarks && (
                                                <div className="mt-3 border-l-2 border-blue-200 pl-3 text-xs text-stone-600 italic">
                                                    {bill.remarks}
                                                </div>
                                            )}

                                            {isExpanded && (
                                                <div className="mt-4 space-y-4">
                                                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 text-sm text-stone-600">
                                                        <div>
                                                            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Created</p>
                                                            <p>{formatDate(bill.bill_date || bill.created_at)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Contact</p>
                                                            <p>{bill.customer_phone || '—'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Reference ID</p>
                                                            <p className="font-mono break-all">{bill.scan_reference || bill.bill_number || bill.id}</p>
                                                        </div>
                                                        <div className="hidden lg:block">
                                                            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Reference Type</p>
                                                            <p className="capitalize">{bill.reference_type ? bill.reference_type.replace(/_/g, ' ') : 'Customer Credit Bill'}</p>
                                                        </div>
                                                    </div>

                                                    <div className="overflow-hidden border border-stone-200 rounded-xl">
                                                        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.5fr)_minmax(0,0.6fr)] bg-stone-100/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                                                            <span>Description</span>
                                                            <span>Qty</span>
                                                            <span>Amount</span>
                                                        </div>
                                                        <div className="divide-y divide-stone-200 bg-white">
                                                            {(bill.items || []).map((item, idx) => {
                                                                const qty = parseFloat((item as any).quantity || (item as any).qty || 0);
                                                                const unitPrice = parseFloat((item as any).unitPrice || (item as any).unit_price || 0);
                                                                return (
                                                                    <div key={idx} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.5fr)_minmax(0,0.6fr)] px-4 py-2 text-sm text-stone-600">
                                                                        <span>{(item as any).description || '—'}</span>
                                                                        <span>{qty}</span>
                                                                        <span>{formatCurrency(qty * unitPrice)}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                            {(!bill.items || bill.items.length === 0) && (
                                                                <div className="px-4 py-3 text-xs text-stone-400">No line items captured.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </IOSCard>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
