'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import {
    BookOpen, Search, RefreshCw, Download, Filter,
    TrendingUp, TrendingDown, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { api } from '@/lib/api';

interface LedgerEntry {
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

export default function StockLedgerPage() {
    const { activeBranchId } = useBranch();
    const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [transactionType, setTransactionType] = useState('');

    useEffect(() => {
        fetchLedger();
    }, [activeBranchId, transactionType]);

    const fetchLedger = async () => {
        setIsLoading(true);
        try {
            const params: { branch_id?: number; transaction_type?: string } = {
                branch_id: activeBranchId || undefined
            };
            if (transactionType) params.transaction_type = transactionType;

            const response = await api.kitchen.getLedger(params);
            if (response.data?.success || response.success) {
                setLedgerEntries(response.data?.data || response.data || []);
            }
        } catch (error) {
            console.error('Error fetching ledger:', error);
            toast.error('Failed to load stock ledger');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredEntries = ledgerEntries.filter(entry =>
        entry.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.item_sku.toLowerCase().includes(searchTerm.toLowerCase())
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
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard/kitchen-operations">
                                <button className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                                    <ArrowLeft className="h-5 w-5 text-stone-600" />
                                </button>
                            </Link>
                            <div>
                                <h1 className="text-[22px] sm:text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">
                                    Stock Ledger
                                </h1>
                                <p className="text-stone-500 text-sm mt-0.5">
                                    Immutable transaction log
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton
                                onClick={fetchLedger}
                                leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}
                                variant="secondary"
                            >
                                Refresh
                            </IOSButton>
                            <IOSButton
                                leftIcon={<Download />}
                                variant="secondary"
                            >
                                Export
                            </IOSButton>
                        </div>
                    </div>

                    {/* Filters */}
                    <IOSCard className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <Input
                                    placeholder="Search by item name or SKU..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <select
                                value={transactionType}
                                onChange={(e) => setTransactionType(e.target.value)}
                                className="h-10 px-3 rounded-ios-lg border border-stone-200"
                            >
                                <option value="">All Transaction Types</option>
                                <option value="RECEIPT">Receipt</option>
                                <option value="USAGE">Usage</option>
                                <option value="WASTAGE">Wastage</option>
                                <option value="ADJUSTMENT">Adjustment</option>
                                <option value="OPENING">Opening Balance</option>
                            </select>
                        </div>
                    </IOSCard>

                    {/* Ledger Table */}
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
                                    ) : filteredEntries.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-8 text-center text-stone-500">
                                                No ledger entries found
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEntries.map((entry) => (
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
                                                <td className="px-4 py-3 text-right font-mono text-sm">
                                                    {entry.quantity_in > 0 && (
                                                        <span className="text-green-600 flex items-center justify-end gap-1">
                                                            <TrendingUp className="h-3 w-3" />
                                                            {entry.quantity_in.toFixed(2)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-sm">
                                                    {entry.quantity_out > 0 && (
                                                        <span className="text-red-600 flex items-center justify-end gap-1">
                                                            <TrendingDown className="h-3 w-3" />
                                                            {entry.quantity_out.toFixed(2)}
                                                        </span>
                                                    )}
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

                    {/* Info */}
                    <IOSCard className="p-4 bg-blue-50 border-blue-200">
                        <p className="text-sm text-stone-700">
                            <strong>Note:</strong> This ledger is immutable. All stock balances are computed from these transactions. No manual edits are allowed.
                        </p>
                    </IOSCard>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
