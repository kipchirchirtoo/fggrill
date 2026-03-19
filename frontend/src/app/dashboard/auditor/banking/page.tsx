'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { API_URL } from '@/lib/config';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import {
    Building2, RefreshCw, Eye, Check, X, Search, Calendar,
    TrendingUp, TrendingDown, DollarSign, FileText, AlertCircle,
    Download, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';


interface BankingTransaction {
    id: string;
    branch_id: number;
    branch?: { name: string };
    transaction_date: string;
    transaction_type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'BANK_CHARGE';
    bank_name: string;
    account_number: string;
    account_name?: string;
    amount: number;
    currency: string;
    reference_number: string;
    source?: string;
    destination?: string;
    payment_method?: string;
    receipt_number?: string;
    purpose_category: string;
    purpose_description: string;
    notes?: string;
    recorded_by: string;
    recorded_by_user?: { firstName: string; lastName: string };
    approved_by?: string;
    approved_by_user?: { firstName: string; lastName: string };
    approved_at?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RECONCILED';
    is_reconciled: boolean;
    created_at: string;
}

export default function AuditorBankingPage() {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<BankingTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedTransaction, setSelectedTransaction] = useState<BankingTransaction | null>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');

    useEffect(() => {
        fetchTransactions();
    }, [statusFilter, typeFilter, branchFilter, dateFrom, dateTo]);

    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            if (statusFilter) params.append('status', statusFilter);
            if (typeFilter) params.append('transaction_type', typeFilter);
            if (branchFilter) params.append('branch_id', branchFilter);
            if (dateFrom) params.append('from_date', dateFrom);
            if (dateTo) params.append('to_date', dateTo);

            const response = await fetch(`${API_URL}/api/banking/transactions?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setTransactions(data.data || []);
            } else {
                toast.error('Failed to fetch banking transactions');
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error('Failed to fetch banking transactions');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApproveReject = async () => {
        if (!selectedTransaction) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/banking/transactions/${selectedTransaction.id}/approve`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: actionType })
            });

            if (response.ok) {
                toast.success(`Transaction ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`);
                setIsApproveModalOpen(false);
                setSelectedTransaction(null);
                fetchTransactions();
            } else {
                const err = await response.json();
                toast.error(err.error || `Failed to ${actionType} transaction`);
            }
        } catch (error) {
            toast.error(`Failed to ${actionType} transaction`);
        }
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            'PENDING': 'bg-amber-100 text-amber-700',
            'APPROVED': 'bg-emerald-100 text-emerald-700',
            'REJECTED': 'bg-rose-100 text-rose-700',
            'RECONCILED': 'bg-blue-100 text-blue-700'
        };
        return colors[status] || 'bg-gray-100 text-gray-700';
    };

    const getTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            'DEPOSIT': 'bg-emerald-100 text-emerald-700',
            'WITHDRAWAL': 'bg-rose-100 text-rose-700',
            'TRANSFER': 'bg-blue-100 text-blue-700',
            'BANK_CHARGE': 'bg-amber-100 text-amber-700'
        };
        return colors[type] || 'bg-gray-100 text-gray-700';
    };

    const filteredTransactions = transactions.filter(t =>
        t.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.bank_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.purpose_description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const pendingCount = transactions.filter(t => t.status === 'PENDING').length;
    const approvedCount = transactions.filter(t => t.status === 'APPROVED').length;
    const totalDeposits = transactions
        .filter(t => t.transaction_type === 'DEPOSIT' && t.status === 'APPROVED')
        .reduce((sum, t) => sum + Number(t.amount), 0);
    const totalWithdrawals = transactions
        .filter(t => t.transaction_type === 'WITHDRAWAL' && t.status === 'APPROVED')
        .reduce((sum, t) => sum + Number(t.amount), 0);

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.AUDITOR, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Building2 className="h-6 w-6 text-gray-900" />
                                Banking Transactions Review
                            </h1>
                            <p className="text-gray-600">Review and approve branch banking transactions</p>
                        </div>
                        <div className="flex gap-3">
                            <IOSButton variant="outline" onClick={fetchTransactions} disabled={isLoading}>
                                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                Refresh
                            </IOSButton>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <IOSCard className="p-4">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-8 w-8 text-amber-500" />
                                <div>
                                    <p className="text-sm text-gray-500">Pending Review</p>
                                    <p className="text-2xl font-bold">{pendingCount}</p>
                                </div>
                            </div>
                        </IOSCard>
                        <IOSCard className="p-4">
                            <div className="flex items-center gap-3">
                                <Check className="h-8 w-8 text-emerald-500" />
                                <div>
                                    <p className="text-sm text-gray-500">Approved</p>
                                    <p className="text-2xl font-bold">{approvedCount}</p>
                                </div>
                            </div>
                        </IOSCard>
                        <IOSCard className="p-4">
                            <div className="flex items-center gap-3">
                                <TrendingUp className="h-8 w-8 text-emerald-500" />
                                <div>
                                    <p className="text-sm text-gray-500">Total Deposits</p>
                                    <p className="text-xl font-bold">KES {totalDeposits.toLocaleString()}</p>
                                </div>
                            </div>
                        </IOSCard>
                        <IOSCard className="p-4">
                            <div className="flex items-center gap-3">
                                <TrendingDown className="h-8 w-8 text-rose-500" />
                                <div>
                                    <p className="text-sm text-gray-500">Total Withdrawals</p>
                                    <p className="text-xl font-bold">KES {totalWithdrawals.toLocaleString()}</p>
                                </div>
                            </div>
                        </IOSCard>
                    </div>

                    {/* Filters */}
                    <IOSCard className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                            <div className="md:col-span-2 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                                <Input
                                    placeholder="Search by reference, bank, or description..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="border rounded-ios-lg px-3 py-2 text-sm"
                            >
                                <option value="">All Status</option>
                                <option value="PENDING">Pending</option>
                                <option value="APPROVED">Approved</option>
                                <option value="REJECTED">Rejected</option>
                                <option value="RECONCILED">Reconciled</option>
                            </select>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="border rounded-ios-lg px-3 py-2 text-sm"
                            >
                                <option value="">All Types</option>
                                <option value="DEPOSIT">Deposit</option>
                                <option value="WITHDRAWAL">Withdrawal</option>
                                <option value="TRANSFER">Transfer</option>
                                <option value="BANK_CHARGE">Bank Charge</option>
                            </select>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                placeholder="From Date"
                            />
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                placeholder="To Date"
                            />
                        </div>
                    </IOSCard>

                    {/* Transactions Table */}
                    <IOSCard>
                        {isLoading ? (
                            <div className="p-12 text-center text-gray-500">Loading transactions...</div>
                        ) : filteredTransactions.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p>No banking transactions found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bank</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purpose</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {filteredTransactions.map((transaction) => (
                                            <tr key={transaction.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-4 text-sm">{formatDate(transaction.transaction_date)}</td>
                                                <td className="px-4 py-4 font-mono text-sm">{transaction.reference_number}</td>
                                                <td className="px-4 py-4">
                                                    <IOSBadge className={getTypeColor(transaction.transaction_type)}>
                                                        {transaction.transaction_type}
                                                    </IOSBadge>
                                                </td>
                                                <td className="px-4 py-4 text-sm">{transaction.bank_name}</td>
                                                <td className="px-4 py-4 text-right font-medium">
                                                    KES {Number(transaction.amount).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-4 text-sm max-w-xs truncate">{transaction.purpose_description}</td>
                                                <td className="px-4 py-4">
                                                    <IOSBadge className={getStatusColor(transaction.status)}>
                                                        {transaction.status}
                                                    </IOSBadge>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedTransaction(transaction);
                                                                setIsViewModalOpen(true);
                                                            }}
                                                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                            title="View Details"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                        {transaction.status === 'PENDING' && (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedTransaction(transaction);
                                                                        setActionType('approve');
                                                                        setIsApproveModalOpen(true);
                                                                    }}
                                                                    className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                                                    title="Approve"
                                                                >
                                                                    <Check className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedTransaction(transaction);
                                                                        setActionType('reject');
                                                                        setIsApproveModalOpen(true);
                                                                    }}
                                                                    className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                                                    title="Reject"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </IOSCard>
                </div>

                {/* View Modal */}
                <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Transaction Details
                            </DialogTitle>
                        </DialogHeader>
                        <DialogBody>
                            {selectedTransaction && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6 bg-gray-50/50 p-4 rounded-ios-lg border">
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Reference Number</p>
                                            <p className="font-mono font-semibold text-gray-900">{selectedTransaction.reference_number}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Status</p>
                                            <IOSBadge className={getStatusColor(selectedTransaction.status)}>
                                                {selectedTransaction.status}
                                            </IOSBadge>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Transaction Date</p>
                                            <p className="font-medium text-gray-900">{formatDate(selectedTransaction.transaction_date)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Type</p>
                                            <IOSBadge className={getTypeColor(selectedTransaction.transaction_type)}>
                                                {selectedTransaction.transaction_type}
                                            </IOSBadge>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Bank Name</p>
                                            <p className="font-medium text-gray-900">{selectedTransaction.bank_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Account Number</p>
                                            <p className="font-mono font-medium text-gray-900">{selectedTransaction.account_number}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Amount</p>
                                            <p className="text-xl font-bold text-blue-600">
                                                KES {Number(selectedTransaction.amount).toLocaleString()}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Payment Method</p>
                                            <p className="font-medium text-gray-900">{selectedTransaction.payment_method || 'N/A'}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Purpose</p>
                                            <p className="text-sm text-gray-900">{selectedTransaction.purpose_description}</p>
                                        </div>
                                        {selectedTransaction.notes && (
                                            <div>
                                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Notes</p>
                                                <p className="text-sm text-gray-700 italic">{selectedTransaction.notes}</p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Recorded By</p>
                                            <p className="text-sm text-gray-900">
                                                {selectedTransaction.recorded_by_user 
                                                    ? `${selectedTransaction.recorded_by_user.firstName} ${selectedTransaction.recorded_by_user.lastName}`
                                                    : 'Unknown'}
                                            </p>
                                        </div>
                                        {selectedTransaction.approved_by && (
                                            <div>
                                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Approved By</p>
                                                <p className="text-sm text-gray-900">
                                                    {selectedTransaction.approved_by_user 
                                                        ? `${selectedTransaction.approved_by_user.firstName} ${selectedTransaction.approved_by_user.lastName}`
                                                        : 'Unknown'}
                                                    {selectedTransaction.approved_at && ` on ${formatDate(selectedTransaction.approved_at)}`}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </DialogBody>
                        <DialogFooter>
                            <IOSButton variant="outline" onClick={() => setIsViewModalOpen(false)}>Close</IOSButton>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Approve/Reject Modal */}
                <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                {actionType === 'approve' ? (
                                    <Check className="h-5 w-5 text-emerald-600" />
                                ) : (
                                    <X className="h-5 w-5 text-rose-600" />
                                )}
                                {actionType === 'approve' ? 'Approve' : 'Reject'} Transaction
                            </DialogTitle>
                        </DialogHeader>
                        <DialogBody>
                            <p className="text-gray-700">
                                Are you sure you want to {actionType} this banking transaction?
                            </p>
                            {selectedTransaction && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                    <p className="text-sm"><span className="font-medium">Reference:</span> {selectedTransaction.reference_number}</p>
                                    <p className="text-sm"><span className="font-medium">Amount:</span> KES {Number(selectedTransaction.amount).toLocaleString()}</p>
                                    <p className="text-sm"><span className="font-medium">Bank:</span> {selectedTransaction.bank_name}</p>
                                </div>
                            )}
                        </DialogBody>
                        <DialogFooter>
                            <IOSButton variant="outline" onClick={() => setIsApproveModalOpen(false)}>Cancel</IOSButton>
                            <IOSButton
                                variant={actionType === 'approve' ? 'primary' : 'outline'}
                                onClick={handleApproveReject}
                                className={actionType === 'reject' ? 'bg-rose-600 text-white hover:bg-rose-700' : ''}
                            >
                                {actionType === 'approve' ? 'Approve' : 'Reject'}
                            </IOSButton>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
