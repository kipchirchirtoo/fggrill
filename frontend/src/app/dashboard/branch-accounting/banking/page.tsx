'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { 
    Banknote, 
    Plus, 
    RefreshCw, 
    TrendingUp, 
    TrendingDown, 
    Clock,
    CheckCircle,
    AlertCircle,
    DollarSign
} from 'lucide-react';
import { bankingAPI } from '@/lib/api';
import { toast } from 'sonner';
import { RecordTransactionModal } from '@/components/banking';

export default function BranchBankingPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showRecordModal, setShowRecordModal] = useState(false);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');

    useEffect(() => {
        loadData();
    }, [activeBranchId, filter]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [transRes, summaryRes] = await Promise.all([
                bankingAPI.getBankingTransactions({
                    branch_id: activeBranchId || undefined,
                    status: filter === 'all' ? undefined : filter.toUpperCase()
                }),
                bankingAPI.getBankingSummary({ branch_id: activeBranchId || undefined })
            ]);

            if (transRes.success) {
                setTransactions(transRes.data || []);
            }

            if (summaryRes.success) {
                setSummary(summaryRes.data);
            }
        } catch (error) {
            console.error('Error loading banking data:', error);
            toast.error('Failed to load banking data');
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const statusLower = status?.toLowerCase();
        
        if (statusLower === 'approved') {
            return (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1 w-fit">
                    <CheckCircle className="h-3 w-3" />
                    Approved
                </span>
            );
        } else if (statusLower === 'pending') {
            return (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center gap-1 w-fit">
                    <Clock className="h-3 w-3" />
                    Pending
                </span>
            );
        } else if (statusLower === 'rejected') {
            return (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1 w-fit">
                    <AlertCircle className="h-3 w-3" />
                    Rejected
                </span>
            );
        }
        
        return <span className="text-gray-500 text-xs">{status}</span>;
    };

    const getTransactionTypeIcon = (type: string) => {
        const typeLower = type?.toLowerCase();
        
        if (typeLower === 'deposit') {
            return <TrendingUp className="h-4 w-4 text-green-600" />;
        } else if (typeLower === 'withdrawal') {
            return <TrendingDown className="h-4 w-4 text-red-600" />;
        }
        
        return <DollarSign className="h-4 w-4 text-blue-600" />;
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <Banknote className="h-6 w-6 text-blue-600" />
                                Banking Transactions
                            </h1>
                            <p className="text-gray-500">Record and manage banking transactions</p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={loadData} leftIcon={<RefreshCw />}>
                                Refresh
                            </IOSButton>
                            <IOSButton onClick={() => setShowRecordModal(true)} leftIcon={<Plus />}>
                                Record Transaction
                            </IOSButton>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    {summary && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <IOSCard className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Total Balance</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            KES {summary.summary?.total_balance?.toLocaleString() || '0'}
                                        </p>
                                    </div>
                                    <Banknote className="h-8 w-8 text-blue-600" />
                                </div>
                            </IOSCard>

                            <IOSCard className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Deposits</p>
                                        <p className="text-2xl font-bold text-green-600">
                                            KES {summary.summary?.deposits?.toLocaleString() || '0'}
                                        </p>
                                    </div>
                                    <TrendingUp className="h-8 w-8 text-green-600" />
                                </div>
                            </IOSCard>

                            <IOSCard className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Withdrawals</p>
                                        <p className="text-2xl font-bold text-red-600">
                                            KES {summary.summary?.withdrawals?.toLocaleString() || '0'}
                                        </p>
                                    </div>
                                    <TrendingDown className="h-8 w-8 text-red-600" />
                                </div>
                            </IOSCard>

                            <IOSCard className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Pending</p>
                                        <p className="text-2xl font-bold text-yellow-600">
                                            {summary.summary?.pending_transactions || 0}
                                        </p>
                                    </div>
                                    <Clock className="h-8 w-8 text-yellow-600" />
                                </div>
                            </IOSCard>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                filter === 'all'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilter('pending')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                filter === 'pending'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Pending
                        </button>
                        <button
                            onClick={() => setFilter('approved')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                filter === 'approved'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Approved
                        </button>
                    </div>

                    {/* Transactions Table */}
                    <IOSCard className="p-0 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3">Type</th>
                                        <th className="px-6 py-3">Bank</th>
                                        <th className="px-6 py-3">Reference</th>
                                        <th className="px-6 py-3">Purpose</th>
                                        <th className="px-6 py-3 text-right">Amount</th>
                                        <th className="px-6 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                                Loading transactions...
                                            </td>
                                        </tr>
                                    ) : transactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                                No transactions found
                                            </td>
                                        </tr>
                                    ) : (
                                        transactions.map((txn) => (
                                            <tr key={txn.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium">
                                                    {new Date(txn.transaction_date).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {getTransactionTypeIcon(txn.transaction_type)}
                                                        <span className="capitalize">
                                                            {txn.transaction_type?.toLowerCase()}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <div className="font-medium">{txn.bank_name}</div>
                                                        <div className="text-xs text-gray-500">{txn.account_number}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs">{txn.reference_number}</td>
                                                <td className="px-6 py-4">
                                                    <div className="max-w-xs truncate" title={txn.purpose_description}>
                                                        {txn.purpose_description}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right font-medium">
                                                    <span className={
                                                        txn.transaction_type?.toLowerCase() === 'deposit'
                                                            ? 'text-green-600'
                                                            : 'text-red-600'
                                                    }>
                                                        {txn.transaction_type?.toLowerCase() === 'deposit' ? '+' : '-'}
                                                        KES {parseFloat(txn.amount).toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">{getStatusBadge(txn.status)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </IOSCard>
                </div>

                {/* Record Transaction Modal */}
                {showRecordModal && (
                    <RecordTransactionModal
                        onClose={() => setShowRecordModal(false)}
                        onSuccess={() => {
                            setShowRecordModal(false);
                            loadData();
                        }}
                    />
                )}
            </DashboardLayout>
        </ProtectedRoute>
    );
}
