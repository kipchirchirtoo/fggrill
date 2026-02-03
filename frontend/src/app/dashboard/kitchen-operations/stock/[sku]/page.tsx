'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useBranch } from '@/lib/branch-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import {
    ArrowLeft, FileText, Download,
    Calendar, Filter, RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

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

export default function ItemLedgerDetailsPage() {
    const params = useParams();
    const sku = params?.sku as string;
    const { activeBranchId } = useBranch();
    const [transactions, setTransactions] = useState<StockTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [itemName, setItemName] = useState('');

    useEffect(() => {
        if (sku && activeBranchId) {
            fetchHistory();
        }
    }, [sku, activeBranchId]);

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const response = await api.kitchen.getStockLedger({
                branch_id: activeBranchId as any,
                item_sku: sku
            });
            if (response.success) {
                setTransactions(response.data || []);
                if (response.data?.length > 0) {
                    setItemName(response.data[0].item_name);
                }
            }
        } catch (error) {
            console.error('Error fetching history:', error);
            toast.error('Failed to load item ledger');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = async (format: 'pdf' | 'excel') => {
        try {
            toast.success(`Generating ${format.toUpperCase()} report...`);
            await api.auditorReports.exportBrandedPdf('kitchen_item_ledger', {
                branch_id: activeBranchId,
                item_sku: sku,
                format: format,
                start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 30 days
                end_date: new Date().toISOString().split('T')[0]
            });
            toast.success('Report downloaded');
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to download report');
        }
    };

    return (
        <ProtectedRoute allowedRoles={[
            UserRole.KITCHEN, UserRole.KITCHEN_OPERATIONS, UserRole.RESTAURANT,
            UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER
        ]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard/kitchen-operations/stock">
                                <button className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-500 hover:text-stone-900">
                                    <ArrowLeft className="h-5 w-5" />
                                </button>
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold text-stone-900">Item Ledger: {itemName || sku}</h1>
                                <p className="text-sm text-stone-500 font-mono uppercase tracking-tight">SKU: {sku}</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleExport('pdf')}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors text-sm font-semibold text-stone-700 shadow-sm"
                            >
                                <FileText className="h-4 w-4" />
                                <span>PDF Report</span>
                            </button>
                            <button
                                onClick={() => handleExport('excel')}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors text-sm font-semibold text-stone-700 shadow-sm"
                            >
                                <Download className="h-4 w-4" />
                                <span>Excel</span>
                            </button>
                            <button
                                onClick={fetchHistory}
                                className="p-2 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors text-stone-500 shadow-sm"
                                disabled={isLoading}
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    {transactions.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-2">Current Balance</p>
                                <p className="text-3xl font-black text-stone-900">
                                    {Number(transactions[0].closing_balance).toFixed(2)}
                                    <span className="text-sm font-medium text-stone-500 ml-2 uppercase tracking-wide">{transactions[0].unit_of_measure}</span>
                                </p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-2">Last Movement</p>
                                <p className="text-lg font-bold text-stone-800">
                                    {new Date(transactions[0].transaction_date).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-stone-500 mt-1">
                                    {transactions[0].transaction_type} ({Number(transactions[0].quantity_in || transactions[0].quantity_out).toFixed(2)})
                                </p>
                            </div>
                        </div>
                    )}

                    {/* History Table */}
                    <div className="bg-white rounded-2xl border border-stone-200 shadow-xl shadow-stone-200/20 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-stone-50 border-b border-stone-100">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-500 uppercase tracking-widest">Date & Time</th>
                                        <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-500 uppercase tracking-widest">Type</th>
                                        <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-500 uppercase tracking-widest">Reference</th>
                                        <th className="px-6 py-4 text-right text-[11px] font-bold text-stone-500 uppercase tracking-widest">Opening</th>
                                        <th className="px-6 py-4 text-right text-[11px] font-bold text-green-600 uppercase tracking-widest">In</th>
                                        <th className="px-6 py-4 text-right text-[11px] font-bold text-red-600 uppercase tracking-widest">Out</th>
                                        <th className="px-6 py-4 text-right text-[11px] font-bold text-stone-900 uppercase tracking-widest">Closing</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {isLoading ? (
                                        <tr><td colSpan={7} className="px-6 py-20 text-center text-stone-400 text-sm font-medium">Fetching transaction history...</td></tr>
                                    ) : transactions.length === 0 ? (
                                        <tr><td colSpan={7} className="px-6 py-20 text-center text-stone-400 text-sm font-medium">No movement recorded for this item</td></tr>
                                    ) : (
                                        transactions.map((t) => (
                                            <tr key={t.id} className="hover:bg-stone-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-stone-900">{new Date(t.transaction_date).toLocaleDateString()}</span>
                                                        <span className="text-[10px] text-stone-400 font-medium">{new Date(t.transaction_date).toLocaleTimeString()}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${t.transaction_type === 'RECEIPT' ? 'bg-green-50 text-green-700 border border-green-100' :
                                                            t.transaction_type === 'USAGE' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                                                t.transaction_type === 'WASTAGE' ? 'bg-red-50 text-red-700 border border-red-100' :
                                                                    'bg-stone-50 text-stone-600 border border-stone-100'
                                                        }`}>
                                                        {t.transaction_type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-stone-700">{t.reference_type}</span>
                                                        <span className="text-[11px] text-stone-400 font-mono tracking-tighter">ID: {t.reference_id}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm text-stone-500 font-medium">
                                                    {Number(t.opening_balance).toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-bold text-green-600">
                                                    {Number(t.quantity_in) > 0 ? `+${Number(t.quantity_in).toFixed(2)}` : '—'}
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-bold text-red-600">
                                                    {Number(t.quantity_out) > 0 ? `—${Number(t.quantity_out).toFixed(2)}` : '—'}
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-black text-stone-900">
                                                    {Number(t.closing_balance).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
