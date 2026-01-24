'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    BookOpen, Search, RefreshCw, Download, Filter,
    TrendingUp, TrendingDown, ArrowLeft, Plus, Calculator, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { api } from '@/lib/api';

// Granular stock transactions
interface StockTransaction {
    id: number;
    transaction_date: string;
    item_sku: string;
    item_name: string;
    transaction_type: string;
    reference_type: string;
    reference_id: string;
    opening_balance: number;
    quantity_in: number;
    quantity_out: number;
    closing_balance: number;
    unit_of_measure: string;
    notes: string;
}

// Daily/Control ledger entries
interface KitchenLedgerEntry {
    id: number;
    entry_number: string;
    entry_date: string;
    item_id: string;
    item_name: string;
    opening_balance: number;
    received_quantity: number;
    used_quantity: number;
    wastage_quantity: number;
    closing_balance: number;
    expected_sales: number;
    system_sales: number;
    unit_of_measure: string;
    remarks: string;
    created_at: string;
}

export default function StockLedgerPage() {
    const { activeBranchId } = useBranch();
    const [activeTab, setActiveTab] = useState<'transactions' | 'ledger_book'>('ledger_book');
    const [transactions, setTransactions] = useState<StockTransaction[]>([]);
    const [ledgerEntries, setLedgerEntries] = useState<KitchenLedgerEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [transactionType, setTransactionType] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        item_name: '',
        item_id: '',
        entry_date: new Date().toISOString().split('T')[0],
        opening_balance: 0,
        received_quantity: 0,
        used_quantity: 0,
        wastage_quantity: 0,
        expected_sales: 0,
        system_sales: 0,
        unit_of_measure: 'kg',
        remarks: ''
    });

    useEffect(() => {
        if (activeTab === 'transactions') {
            fetchTransactions();
        } else {
            fetchLedgerEntries();
        }
    }, [activeBranchId, activeTab, transactionType]);

    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            const params: any = { branch_id: activeBranchId || undefined };
            if (transactionType) params.transaction_type = transactionType;
            const response = await api.kitchen.getStockLedger(params);
            if (response.success) {
                setTransactions(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
            toast.error('Failed to load transaction log');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLedgerEntries = async () => {
        setIsLoading(true);
        try {
            const response = await api.kitchen.getLedger({ branch_id: activeBranchId || undefined });
            if (response.success) {
                setLedgerEntries(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching ledger:', error);
            toast.error('Failed to load ledger book');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateLedgerEntry = async () => {
        if (!formData.item_name) {
            toast.error('Item name is required');
            return;
        }
        setIsSubmitting(true);
        try {
            const response = await api.kitchen.createLedgerEntry({
                ...formData,
                branch_id: activeBranchId
            });
            if (response.success) {
                toast.success('Ledger entry captured successfully');
                setIsModalOpen(false);
                fetchLedgerEntries();
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to capture entry');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredTransactions = transactions.filter(entry =>
        entry.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.item_sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredLedgerEntries = ledgerEntries.filter(entry =>
        entry.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.item_id && entry.item_id.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getTransactionBadge = (type: string) => {
        const badges: Record<string, { bg: string; text: string }> = {
            RECEIPT: { bg: 'bg-green-100', text: 'text-green-700' },
            USAGE: { bg: 'bg-blue-100', text: 'text-blue-700' },
            WASTAGE: { bg: 'bg-red-100', text: 'text-red-700' },
            ADJUSTMENT: { bg: 'bg-amber-100', text: 'text-amber-700' },
            OPENING: { bg: 'bg-purple-100', text: 'text-purple-700' }
        };
        const badge = badges[type] || { bg: 'bg-stone-100', text: 'text-stone-700' };
        return <IOSBadge className={`${badge.bg} ${badge.text}`}>{type}</IOSBadge>;
    };

    return (
        <ProtectedRoute allowedRoles={[
            UserRole.KITCHEN, UserRole.POS_KITCHEN, UserRole.KITCHEN_OPERATIONS, UserRole.RESTAURANT,
            UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER
        ]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard/kitchen-operations">
                                <button className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                                    <ArrowLeft className="h-5 w-5 text-stone-600" />
                                </button>
                            </Link>
                            <div>
                                <h1 className="text-[22px] sm:text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">
                                    Kitchen Ledger
                                </h1>
                                <p className="text-stone-500 text-sm mt-0.5">
                                    {activeTab === 'ledger_book' ? 'Daily control and financial summary' : 'Detailed inventory transaction log'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton
                                onClick={activeTab === 'transactions' ? fetchTransactions : fetchLedgerEntries}
                                leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}
                                variant="secondary"
                            >
                                Refresh
                            </IOSButton>
                            {activeTab === 'ledger_book' && (
                                <IOSButton
                                    onClick={() => setIsModalOpen(true)}
                                    leftIcon={<Plus />}
                                >
                                    Capture Entry
                                </IOSButton>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-stone-200">
                        <button
                            onClick={() => setActiveTab('ledger_book')}
                            className={`px-4 py-2 text-sm font-bold transition-all border-b-2 ${activeTab === 'ledger_book' ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
                        >
                            Ledger Book (Daily Summary)
                        </button>
                        <button
                            onClick={() => setActiveTab('transactions')}
                            className={`px-4 py-2 text-sm font-bold transition-all border-b-2 ${activeTab === 'transactions' ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
                        >
                            Transaction History
                        </button>
                    </div>

                    {/* Filters */}
                    <IOSCard className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <Input
                                    placeholder="Search items..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            {activeTab === 'transactions' && (
                                <select
                                    value={transactionType}
                                    onChange={(e) => setTransactionType(e.target.value)}
                                    className="h-10 px-3 rounded-ios-lg border border-stone-200 text-sm"
                                >
                                    <option value="">All Transaction Types</option>
                                    <option value="RECEIPT">Receipt</option>
                                    <option value="USAGE">Usage</option>
                                    <option value="WASTAGE">Wastage</option>
                                    <option value="ADJUSTMENT">Adjustment</option>
                                    <option value="OPENING">Opening Balance</option>
                                </select>
                            )}
                        </div>
                    </IOSCard>

                    {/* Content */}
                    {activeTab === 'ledger_book' ? (
                        <IOSCard>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-stone-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase">Date / #</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase">Item</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase">Opening</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase">In</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase">Used</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase">Waste</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase">Closing</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-green-600 uppercase">Expected Sales</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-blue-600 uppercase">System Sales</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-stone-900 uppercase">Variance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {isLoading ? (
                                            <tr><td colSpan={10} className="px-4 py-8 text-center text-stone-400">Loading ledger...</td></tr>
                                        ) : filteredLedgerEntries.length === 0 ? (
                                            <tr><td colSpan={10} className="px-4 py-8 text-center text-stone-400">No ledger entries captured yet</td></tr>
                                        ) : (
                                            filteredLedgerEntries.map((entry) => {
                                                const variance = entry.expected_sales - entry.system_sales;
                                                return (
                                                    <tr key={entry.id} className="hover:bg-stone-50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <p className="text-sm font-medium">{new Date(entry.entry_date).toLocaleDateString()}</p>
                                                            <p className="text-[10px] text-stone-400 font-mono uppercase">{entry.entry_number}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="text-sm font-bold text-stone-900">{entry.item_name}</p>
                                                            <p className="text-[10px] text-stone-400">{entry.unit_of_measure}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-sm">{entry.opening_balance.toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-right text-sm text-green-600">+{entry.received_quantity.toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-right text-sm text-blue-600">-{entry.used_quantity.toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-right text-sm text-red-600">-{entry.wastage_quantity.toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-right text-sm font-bold">{entry.closing_balance.toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-right text-sm font-semibold text-green-700">KES {entry.expected_sales.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right text-sm font-semibold text-blue-700">KES {entry.system_sales.toLocaleString()}</td>
                                                        <td className={`px-4 py-3 text-right text-sm font-black ${variance > 0 ? 'text-red-600' : variance < 0 ? 'text-green-600' : 'text-stone-400'}`}>
                                                            KES {variance.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </IOSCard>
                    ) : (
                        <IOSCard>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-stone-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase">Date</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase">Item</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase">Type</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase">Opening</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase">In</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase">Out</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase">Closing</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase">Reference</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center">
                                                    <RefreshCw className="h-8 w-8 animate-spin mx-auto text-stone-400" />
                                                </td>
                                            </tr>
                                        ) : filteredTransactions.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center text-stone-500">
                                                    No stock transactions found
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredTransactions.map((entry) => (
                                                <tr key={entry.id} className="hover:bg-stone-50">
                                                    <td className="px-4 py-3 text-sm">
                                                        {new Date(entry.transaction_date).toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-stone-900">{entry.item_name}</p>
                                                        <p className="text-xs text-stone-500">{entry.item_sku}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {getTransactionBadge(entry.transaction_type)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sm">
                                                        {entry.opening_balance.toFixed(2)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sm text-green-600">
                                                        {entry.quantity_in > 0 ? `+${entry.quantity_in.toFixed(2)}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sm text-red-600">
                                                        {entry.quantity_out > 0 ? `-${entry.quantity_out.toFixed(2)}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sm font-bold">
                                                        {entry.closing_balance.toFixed(2)} {entry.unit_of_measure}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-stone-600">
                                                        {entry.reference_type}: {entry.reference_id}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </IOSCard>
                    )}

                    {/* Meta Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <IOSCard className="p-4 bg-blue-50 border-blue-200">
                            <div className="flex gap-3">
                                <BookOpen className="h-5 w-5 text-blue-600 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-blue-800">Financial Control</p>
                                    <p className="text-xs text-blue-700 mt-0.5">
                                        Use the <strong>Ledger Book</strong> tab to perform manual daily audits. Capture the calculated usage-based sales and compare them against actual system records to identify variances.
                                    </p>
                                </div>
                            </div>
                        </IOSCard>
                        <IOSCard className="p-4 bg-stone-50 border-stone-200">
                            <div className="flex gap-3">
                                <Calculator className="h-5 w-5 text-stone-600 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-stone-800">Inventory Sync</p>
                                    <p className="text-xs text-stone-700 mt-0.5">
                                        The <strong>Transaction History</strong> is automatically populated from requisitions, usage records, and wastage logs. It serves as the granular evidence for all stock movements.
                                    </p>
                                </div>
                            </div>
                        </IOSCard>
                    </div>

                    {/* Capture Ledger Modal */}
                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <BookOpen className="h-5 w-5 text-stone-900" />
                                    Capture Daily Ledger Entry
                                </DialogTitle>
                            </DialogHeader>

                            <div className="grid grid-cols-2 gap-6 mt-4">
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase text-stone-400 tracking-widest border-b pb-1">Item Details</h3>
                                    <div>
                                        <label className="text-[11px] font-bold text-stone-500 uppercase ml-1">Item Name</label>
                                        <Input
                                            value={formData.item_name}
                                            onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                                            placeholder="e.g., Prepared Chicken"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-bold text-stone-500 uppercase ml-1">Item ID/SKU</label>
                                            <Input
                                                value={formData.item_id}
                                                onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                                                placeholder="Optional"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-stone-500 uppercase ml-1">Unit</label>
                                            <Input
                                                value={formData.unit_of_measure}
                                                onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-stone-500 uppercase ml-1">Date</label>
                                        <Input
                                            type="date"
                                            value={formData.entry_date}
                                            onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase text-stone-400 tracking-widest border-b pb-1">Usage & Balances</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-bold text-stone-500 uppercase ml-1">Opening Bal</label>
                                            <Input
                                                type="number"
                                                value={formData.opening_balance}
                                                onChange={(e) => setFormData({ ...formData, opening_balance: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-stone-500 uppercase ml-1 text-green-600">Received (+)</label>
                                            <Input
                                                type="number"
                                                value={formData.received_quantity}
                                                onChange={(e) => setFormData({ ...formData, received_quantity: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-bold text-stone-500 uppercase ml-1 text-blue-600">Used (-)</label>
                                            <Input
                                                type="number"
                                                value={formData.used_quantity}
                                                onChange={(e) => setFormData({ ...formData, used_quantity: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-stone-500 uppercase ml-1 text-red-600">Wastage (-)</label>
                                            <Input
                                                type="number"
                                                value={formData.wastage_quantity}
                                                onChange={(e) => setFormData({ ...formData, wastage_quantity: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-stone-50 p-2 rounded-lg border border-stone-200">
                                        <p className="text-[11px] font-bold text-stone-400 uppercase">Closing Balance (Auto)</p>
                                        <p className="text-xl font-black text-stone-900">
                                            {(formData.opening_balance + formData.received_quantity - formData.used_quantity - formData.wastage_quantity).toFixed(2)} {formData.unit_of_measure}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 space-y-4 bg-stone-50/50 p-4 rounded-2xl border border-stone-200">
                                <h3 className="text-xs font-black uppercase text-stone-400 tracking-widest border-b border-stone-200 pb-1">Financial Reconciliation</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-green-700 uppercase ml-1">
                                            <Calculator className="h-3 w-3" /> Expected Sales (Calculated)
                                        </label>
                                        <Input
                                            type="number"
                                            value={formData.expected_sales}
                                            onChange={(e) => setFormData({ ...formData, expected_sales: Number(e.target.value) })}
                                            className="border-green-200 focus:ring-green-500"
                                            placeholder="Usage x Rate"
                                        />
                                        <p className="text-[10px] text-stone-400 mt-1 ml-1 italic">Based on kitchen portions used</p>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 uppercase ml-1">
                                            <TrendingUp className="h-3 w-3" /> System Sales (Actual)
                                        </label>
                                        <Input
                                            type="number"
                                            value={formData.system_sales}
                                            onChange={(e) => setFormData({ ...formData, system_sales: Number(e.target.value) })}
                                            className="border-blue-200 focus:ring-blue-500"
                                            placeholder="From POS Report"
                                        />
                                        <p className="text-[10px] text-stone-400 mt-1 ml-1 italic">Actual sales recorded in POS</p>
                                    </div>
                                </div>
                                {formData.expected_sales > 0 && formData.system_sales > 0 && (
                                    <div className={`mt-2 p-2 rounded-lg flex items-center gap-2 ${formData.expected_sales - formData.system_sales > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                        <AlertCircle className="h-4 w-4 shrink-0" />
                                        <p className="text-xs font-bold">
                                            Variance: KES {(formData.expected_sales - formData.system_sales).toLocaleString()}
                                            {formData.expected_sales - formData.system_sales > 0 ? ' (Shortfall)' : ' (Surplus)'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4">
                                <label className="text-[11px] font-bold text-stone-500 uppercase ml-1">Remarks</label>
                                <textarea
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    className="w-full mt-1 p-3 text-sm bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 transition-all"
                                    rows={2}
                                    placeholder="Explanation for any variances..."
                                />
                            </div>

                            <div className="flex gap-2 mt-6">
                                <IOSButton
                                    variant="secondary"
                                    className="flex-1"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={isSubmitting}
                                >
                                    Discard
                                </IOSButton>
                                <IOSButton
                                    className="flex-1"
                                    onClick={handleCreateLedgerEntry}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Saving...' : 'Save Ledger Entry'}
                                </IOSButton>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
