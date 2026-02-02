'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    BookOpen, Search, RefreshCw, Filter,
    ArrowLeft, Plus, Calculator, AlertCircle
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
                toast.success('Ledger entry captured');
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
        const styles: Record<string, string> = {
            RECEIPT: 'bg-green-100 text-green-700',
            USAGE: 'bg-blue-100 text-blue-700',
            WASTAGE: 'bg-red-100 text-red-700',
            ADJUSTMENT: 'bg-amber-100 text-amber-700',
            OPENING: 'bg-purple-100 text-purple-700'
        };
        const style = styles[type] || 'bg-stone-100 text-stone-700';
        return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${style}`}>{type}</span>;
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
                                <button className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-500 hover:text-stone-900">
                                    <ArrowLeft className="h-5 w-5" />
                                </button>
                            </Link>
                            <div>
                                <h1 className="page-title">Kitchen Ledger</h1>
                                <p className="page-subtitle">Track usage and reconcile sales</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={activeTab === 'transactions' ? fetchTransactions : fetchLedgerEntries}
                                className="btn-secondary"
                                disabled={isLoading}
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>Refresh</span>
                            </button>
                            {activeTab === 'ledger_book' && (
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="btn-primary"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Capture Entry</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-stone-200 gap-6">
                        <button
                            onClick={() => setActiveTab('ledger_book')}
                            className={`pb-3 text-[13px] font-semibold transition-all border-b-2 ${activeTab === 'ledger_book' ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
                        >
                            Ledger Book
                        </button>
                        <button
                            onClick={() => setActiveTab('transactions')}
                            className={`pb-3 text-[13px] font-semibold transition-all border-b-2 ${activeTab === 'transactions' ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
                        >
                            Transactions
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="card-elevated p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <input
                                    type="text"
                                    placeholder="Search items..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="input-field pl-10"
                                />
                            </div>
                            {activeTab === 'transactions' && (
                                <select
                                    value={transactionType}
                                    onChange={(e) => setTransactionType(e.target.value)}
                                    className="input-field"
                                >
                                    <option value="">All Types</option>
                                    <option value="RECEIPT">Receipt</option>
                                    <option value="USAGE">Usage</option>
                                    <option value="WASTAGE">Wastage</option>
                                    <option value="ADJUSTMENT">Adjustment</option>
                                    <option value="OPENING">Opening</option>
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="card-elevated overflow-hidden">
                        {activeTab === 'ledger_book' ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-stone-50 border-b border-stone-100">
                                        <tr>
                                            <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Date / Entry</th>
                                            <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Item</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Opening</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">In</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Used</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Waste</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Closing</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-bold text-green-600 uppercase">Exp. Sales</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-bold text-blue-600 uppercase">Sys. Sales</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-900 uppercase">Variance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {isLoading ? (
                                            <tr><td colSpan={10} className="px-5 py-8 text-center text-sm text-stone-500">Loading ledger...</td></tr>
                                        ) : filteredLedgerEntries.length === 0 ? (
                                            <tr><td colSpan={10} className="px-5 py-8 text-center text-sm text-stone-500">No ledger entries found</td></tr>
                                        ) : (
                                            filteredLedgerEntries.map((entry) => {
                                                const variance = entry.expected_sales - entry.system_sales;
                                                return (
                                                    <tr key={entry.id} className="hover:bg-stone-50/50 transition-colors">
                                                        <td className="px-5 py-3">
                                                            <p className="text-[13px] font-medium text-stone-900">{new Date(entry.entry_date).toLocaleDateString()}</p>
                                                            <p className="text-[10px] text-stone-400 font-mono uppercase mt-0.5">{entry.entry_number}</p>
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <p className="text-[13px] font-semibold text-stone-900">{entry.item_name}</p>
                                                            <p className="text-[10px] text-stone-500">{entry.unit_of_measure}</p>
                                                        </td>
                                                        <td className="px-5 py-3 text-right text-[13px] font-variant-numeric">{entry.opening_balance.toFixed(2)}</td>
                                                        <td className="px-5 py-3 text-right text-[13px] font-variant-numeric text-green-600">+{entry.received_quantity.toFixed(2)}</td>
                                                        <td className="px-5 py-3 text-right text-[13px] font-variant-numeric text-blue-600">-{entry.used_quantity.toFixed(2)}</td>
                                                        <td className="px-5 py-3 text-right text-[13px] font-variant-numeric text-red-600">-{entry.wastage_quantity.toFixed(2)}</td>
                                                        <td className="px-5 py-3 text-right text-[13px] font-bold text-stone-900 font-variant-numeric">{entry.closing_balance.toFixed(2)}</td>
                                                        <td className="px-5 py-3 text-right text-[13px] font-medium text-green-700 font-variant-numeric">KES {entry.expected_sales.toLocaleString()}</td>
                                                        <td className="px-5 py-3 text-right text-[13px] font-medium text-blue-700 font-variant-numeric">KES {entry.system_sales.toLocaleString()}</td>
                                                        <td className={`px-5 py-3 text-right text-[13px] font-black font-variant-numeric ${variance > 0 ? 'text-red-600' : variance < 0 ? 'text-green-600' : 'text-stone-400'}`}>
                                                            KES {Math.abs(variance).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-stone-50 border-b border-stone-100">
                                        <tr>
                                            <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Date</th>
                                            <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Item</th>
                                            <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Type</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Opening</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">In</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Out</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Closing</th>
                                            <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Reference</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {isLoading ? (
                                            <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-stone-500">Loading transactions...</td></tr>
                                        ) : filteredTransactions.length === 0 ? (
                                            <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-stone-500">No transactions found</td></tr>
                                        ) : (
                                            filteredTransactions.map((entry) => (
                                                <tr key={entry.id} className="hover:bg-stone-50/50 transition-colors">
                                                    <td className="px-5 py-3 text-[13px] text-stone-600">
                                                        {new Date(entry.transaction_date).toLocaleString()}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <p className="text-[13px] font-semibold text-stone-900">{entry.item_name}</p>
                                                        <p className="text-[10px] text-stone-400 mt-0.5">{entry.item_sku}</p>
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        {getTransactionBadge(entry.transaction_type)}
                                                    </td>
                                                    <td className="px-5 py-3 text-right text-[13px] font-variant-numeric text-stone-500">{entry.opening_balance.toFixed(2)}</td>
                                                    <td className="px-5 py-3 text-right text-[13px] font-variant-numeric text-green-600 font-medium">
                                                        {entry.quantity_in > 0 ? `+${entry.quantity_in.toFixed(2)}` : '-'}
                                                    </td>
                                                    <td className="px-5 py-3 text-right text-[13px] font-variant-numeric text-red-600 font-medium">
                                                        {entry.quantity_out > 0 ? `-${entry.quantity_out.toFixed(2)}` : '-'}
                                                    </td>
                                                    <td className="px-5 py-3 text-right text-[13px] font-variant-numeric font-bold text-stone-900">
                                                        {entry.closing_balance.toFixed(2)} {entry.unit_of_measure}
                                                    </td>
                                                    <td className="px-5 py-3 text-[13px] text-stone-500">
                                                        {entry.reference_type} #{entry.reference_id}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Capture Ledger Modal */}
                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
                            <DialogHeader className="px-5 py-3 border-b border-stone-100 bg-stone-50/50">
                                <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold text-stone-900">
                                    <BookOpen className="h-5 w-5 text-stone-500" />
                                    Capture Daily Entry
                                </DialogTitle>
                            </DialogHeader>

                            <div className="overflow-y-auto px-5 py-4 flex-1 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-100 pb-1">Item Details</h3>
                                        <div>
                                            <label className="input-label mb-1">Item Name</label>
                                            <input
                                                value={formData.item_name}
                                                onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                                                placeholder="e.g., Prepared Chicken"
                                                className="input-field py-1.5 text-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="input-label mb-1">Item ID</label>
                                                <input
                                                    value={formData.item_id}
                                                    onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                                                    placeholder="Opt."
                                                    className="input-field py-1.5 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="input-label mb-1">Unit</label>
                                                <input
                                                    value={formData.unit_of_measure}
                                                    onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                                                    className="input-field py-1.5 text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="input-label mb-1">Date</label>
                                            <input
                                                type="date"
                                                value={formData.entry_date}
                                                onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                                                className="input-field py-1.5 text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-100 pb-1">Usage & Balances</h3>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="input-label mb-1">Opening</label>
                                                <input
                                                    type="number"
                                                    value={formData.opening_balance}
                                                    onChange={(e) => setFormData({ ...formData, opening_balance: Number(e.target.value) })}
                                                    className="input-field py-1.5 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="input-label mb-1 text-green-600">Received</label>
                                                <input
                                                    type="number"
                                                    value={formData.received_quantity}
                                                    onChange={(e) => setFormData({ ...formData, received_quantity: Number(e.target.value) })}
                                                    className="input-field py-1.5 text-sm border-green-200 focus:border-green-400 focus:ring-green-400/20"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="input-label mb-1 text-blue-600">Used</label>
                                                <input
                                                    type="number"
                                                    value={formData.used_quantity}
                                                    onChange={(e) => setFormData({ ...formData, used_quantity: Number(e.target.value) })}
                                                    className="input-field py-1.5 text-sm border-blue-200 focus:border-blue-400 focus:ring-blue-400/20"
                                                />
                                            </div>
                                            <div>
                                                <label className="input-label mb-1 text-red-600">Wastage</label>
                                                <input
                                                    type="number"
                                                    value={formData.wastage_quantity}
                                                    onChange={(e) => setFormData({ ...formData, wastage_quantity: Number(e.target.value) })}
                                                    className="input-field py-1.5 text-sm border-red-200 focus:border-red-400 focus:ring-red-400/20"
                                                />
                                            </div>
                                        </div>
                                        <div className="bg-stone-50 p-2 rounded-lg border border-stone-100 mt-1">
                                            <div className="flex justify-between items-center">
                                                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Closing Balance</p>
                                                <p className="text-[14px] font-bold text-stone-900">
                                                    {(formData.opening_balance + formData.received_quantity - formData.used_quantity - formData.wastage_quantity).toFixed(2)} {formData.unit_of_measure}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 bg-stone-50/50 p-3 rounded-xl border border-stone-100">
                                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-200 pb-1">Financial Reconciliation</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="input-label mb-1 flex items-center gap-1.5 text-green-700">
                                                Expected Sales
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-stone-400">KES</span>
                                                <input
                                                    type="number"
                                                    value={formData.expected_sales}
                                                    onChange={(e) => setFormData({ ...formData, expected_sales: Number(e.target.value) })}
                                                    className="input-field py-1.5 pl-9 text-sm"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <p className="text-[9px] text-stone-400 mt-0.5 italic">Portions × Price</p>
                                        </div>
                                        <div>
                                            <label className="input-label mb-1 flex items-center gap-1.5 text-blue-700">
                                                System Sales
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-stone-400">KES</span>
                                                <input
                                                    type="number"
                                                    value={formData.system_sales}
                                                    onChange={(e) => setFormData({ ...formData, system_sales: Number(e.target.value) })}
                                                    className="input-field py-1.5 pl-9 text-sm"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <p className="text-[9px] text-stone-400 mt-0.5 italic">From POS Report</p>
                                        </div>
                                    </div>
                                    {formData.expected_sales > 0 && formData.system_sales > 0 && (
                                        <div className={`p-2 rounded-lg flex items-start gap-2 ${formData.expected_sales - formData.system_sales > 0 ? 'bg-red-50 text-red-800 border border-red-100' : 'bg-green-50 text-green-800 border border-green-100'}`}>
                                            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-xs font-bold">
                                                    Variance: KES {(formData.expected_sales - formData.system_sales).toLocaleString()}
                                                    {formData.expected_sales - formData.system_sales > 0 ? ' (Shortfall)' : ' (Surplus)'}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="input-label mb-1">Remarks</label>
                                    <textarea
                                        value={formData.remarks}
                                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                        className="input-field min-h-[50px] text-sm py-1.5"
                                        placeholder="Explain any variances..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 px-5 py-3 border-t border-stone-100 bg-stone-50/50">
                                <button
                                    className="btn-secondary flex-1"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn-primary flex-1"
                                    onClick={handleCreateLedgerEntry}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Saving...' : 'Save Entry'}
                                </button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
