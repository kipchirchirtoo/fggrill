'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSInput } from '@/components/ui/ios-input';
import { Banknote, DollarSign, Save, ArrowLeft, TrendingUp, TrendingDown, History, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { bankingAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface BankingTransaction {
    id: string;
    transaction_date: string;
    transaction_type: string;
    bank_name: string;
    account_number: string;
    amount: number;
    reference_number: string;
    purpose_description: string;
    status: string;
    notes?: string;
    recorded_by_user?: { full_name: string };
    approved_by_user?: { full_name: string };
    approved_at?: string;
    created_at: string;
}

export default function RecordBankingPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [activeTab, setActiveTab] = useState<'record' | 'history'>('record');
    const [formData, setFormData] = useState({
        transaction_type: 'DEPOSIT',
        amount: '',
        bank_name: '',
        account_number: '',
        reference_number: '',
        purpose_description: '',
        transaction_date: new Date().toISOString().split('T')[0]
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [transactions, setTransactions] = useState<BankingTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<BankingTransaction | null>(null);

    useEffect(() => {
        if (activeTab === 'history' && activeBranchId) {
            fetchTransactions();
        }
    }, [activeTab, activeBranchId]);

    const fetchTransactions = async () => {
        if (!activeBranchId) return;
        
        setIsLoading(true);
        try {
            const response = await bankingAPI.getBankingTransactions({ branch_id: activeBranchId });
            if (response.success) {
                setTransactions(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
            toast.error('Failed to load transactions');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        if (!activeBranchId) {
            toast.error('No branch selected');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await bankingAPI.recordBankingTransaction({
                branch_id: activeBranchId,
                transaction_type: formData.transaction_type,
                amount: parseFloat(formData.amount),
                bank_name: formData.bank_name,
                account_number: formData.account_number || undefined,
                reference_number: formData.reference_number || undefined,
                purpose_description: formData.purpose_description || undefined,
                transaction_date: formData.transaction_date,
                recorded_by: user?.id
            });

            if (response.success) {
                toast.success('Banking transaction recorded successfully');
                // Reset form
                setFormData({
                    transaction_type: 'DEPOSIT',
                    amount: '',
                    bank_name: '',
                    account_number: '',
                    reference_number: '',
                    purpose_description: '',
                    transaction_date: new Date().toISOString().split('T')[0]
                });
                // Switch to history tab
                setActiveTab('history');
            } else {
                toast.error(response.message || 'Failed to record transaction');
            }
        } catch (error: any) {
            console.error('Error recording banking transaction:', error);
            toast.error(error.message || 'Failed to record transaction');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            PENDING: 'bg-yellow-100 text-yellow-800',
            APPROVED: 'bg-green-100 text-green-800',
            REJECTED: 'bg-red-100 text-red-800',
            RECONCILED: 'bg-blue-100 text-blue-800'
        };
        const icons = {
            PENDING: Clock,
            APPROVED: CheckCircle,
            REJECTED: XCircle,
            RECONCILED: CheckCircle
        };
        const Icon = icons[status as keyof typeof icons] || Clock;
        
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
                <Icon className="h-3 w-3" />
                {status}
            </span>
        );
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="max-w-6xl mx-auto space-y-6">
                    <div className="flex items-center gap-4">
                        <IOSButton
                            variant="secondary"
                            onClick={() => router.back()}
                            leftIcon={<ArrowLeft />}
                        >
                            Back
                        </IOSButton>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <Banknote className="h-6 w-6 text-green-600" />
                                Banking Transactions
                            </h1>
                            <p className="text-gray-500">Record and track banking transactions</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('record')}
                            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                                activeTab === 'record'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <Banknote className="h-4 w-4" />
                                Record Transaction
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                                activeTab === 'history'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <History className="h-4 w-4" />
                                Transaction History
                            </div>
                        </button>
                    </div>

                    {/* Record Transaction Tab */}
                    {activeTab === 'record' && (
                        <IOSCard className="p-6">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Transaction Type <span className="text-red-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, transaction_type: 'DEPOSIT' })}
                                                className={`p-4 rounded-lg border-2 transition-all ${
                                                    formData.transaction_type === 'DEPOSIT'
                                                        ? 'border-green-500 bg-green-50'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                <TrendingUp className={`h-8 w-8 mx-auto mb-2 ${
                                                    formData.transaction_type === 'DEPOSIT' ? 'text-green-600' : 'text-gray-400'
                                                }`} />
                                                <div className="font-medium">Deposit</div>
                                                <div className="text-xs text-gray-500">Money into bank</div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, transaction_type: 'WITHDRAWAL' })}
                                                className={`p-4 rounded-lg border-2 transition-all ${
                                                    formData.transaction_type === 'WITHDRAWAL'
                                                        ? 'border-red-500 bg-red-50'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                <TrendingDown className={`h-8 w-8 mx-auto mb-2 ${
                                                    formData.transaction_type === 'WITHDRAWAL' ? 'text-red-600' : 'text-gray-400'
                                                }`} />
                                                <div className="font-medium">Withdrawal</div>
                                                <div className="text-xs text-gray-500">Money from bank</div>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Amount (KES) <span className="text-red-500">*</span>
                                        </label>
                                        <IOSInput
                                            type="number"
                                            step="0.01"
                                            value={formData.amount}
                                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                            placeholder="0.00"
                                            required
                                            leftIcon={<DollarSign />}
                                            className="text-lg"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Bank Name <span className="text-red-500">*</span>
                                        </label>
                                        <IOSInput
                                            type="text"
                                            value={formData.bank_name}
                                            onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                            placeholder="e.g., KCB Bank"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Account Number
                                        </label>
                                        <IOSInput
                                            type="text"
                                            value={formData.account_number}
                                            onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                                            placeholder="Account number"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Reference Number
                                        </label>
                                        <IOSInput
                                            type="text"
                                            value={formData.reference_number}
                                            onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                                            placeholder="Transaction reference"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Transaction Date <span className="text-red-500">*</span>
                                        </label>
                                        <IOSInput
                                            type="date"
                                            value={formData.transaction_date}
                                            onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Purpose Description <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            value={formData.purpose_description}
                                            onChange={(e) => setFormData({ ...formData, purpose_description: e.target.value })}
                                            placeholder="Purpose of the transaction..."
                                            rows={4}
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4 border-t">
                                    <IOSButton
                                        type="button"
                                        variant="secondary"
                                        onClick={() => router.back()}
                                        disabled={isSubmitting}
                                        className="flex-1"
                                    >
                                        Cancel
                                    </IOSButton>
                                    <IOSButton
                                        type="submit"
                                        disabled={isSubmitting}
                                        leftIcon={<Save />}
                                        className="flex-1"
                                    >
                                        {isSubmitting ? 'Recording...' : 'Record Transaction'}
                                    </IOSButton>
                                </div>
                            </form>
                        </IOSCard>
                    )}

                    {/* Transaction History Tab */}
                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            {isLoading ? (
                                <IOSCard className="p-8 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                    <p className="mt-4 text-gray-500">Loading transactions...</p>
                                </IOSCard>
                            ) : transactions.length === 0 ? (
                                <IOSCard className="p-8 text-center">
                                    <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-500">No transactions recorded yet</p>
                                </IOSCard>
                            ) : (
                                <div className="space-y-3">
                                    {transactions.map((txn) => (
                                        <IOSCard key={txn.id} className="p-4 hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className={`p-2 rounded-lg ${
                                                            txn.transaction_type === 'DEPOSIT' ? 'bg-green-100' : 'bg-red-100'
                                                        }`}>
                                                            {txn.transaction_type === 'DEPOSIT' ? (
                                                                <TrendingUp className="h-5 w-5 text-green-600" />
                                                            ) : (
                                                                <TrendingDown className="h-5 w-5 text-red-600" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-semibold text-gray-900">
                                                                {txn.transaction_type} - KES {txn.amount.toLocaleString()}
                                                            </h3>
                                                            <p className="text-sm text-gray-500">
                                                                {txn.bank_name} • {new Date(txn.transaction_date).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="ml-14 space-y-1">
                                                        <p className="text-sm text-gray-600">{txn.purpose_description}</p>
                                                        {txn.reference_number && (
                                                            <p className="text-xs text-gray-500">Ref: {txn.reference_number}</p>
                                                        )}
                                                        <div className="flex items-center gap-2 mt-2">
                                                            {getStatusBadge(txn.status)}
                                                            {txn.status === 'REJECTED' && txn.notes && (
                                                                <span className="text-xs text-red-600">• {txn.notes}</span>
                                                            )}
                                                        </div>
                                                        {txn.approved_by_user && (
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {txn.status === 'APPROVED' ? 'Approved' : 'Reviewed'} by {txn.approved_by_user.full_name}
                                                                {txn.approved_at && ` on ${new Date(txn.approved_at).toLocaleDateString()}`}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <IOSButton
                                                    variant="secondary"
                                                    size="sm"
                                                    leftIcon={<Eye />}
                                                    onClick={() => setSelectedTransaction(txn)}
                                                >
                                                    Details
                                                </IOSButton>
                                            </div>
                                        </IOSCard>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Transaction Detail Modal */}
                    {selectedTransaction && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <IOSCard className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                                <div className="p-6 space-y-4">
                                    <div className="flex items-center justify-between border-b pb-4">
                                        <h2 className="text-xl font-bold">Transaction Details</h2>
                                        <button
                                            onClick={() => setSelectedTransaction(null)}
                                            className="text-gray-400 hover:text-gray-600"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm text-gray-500">Transaction Type</label>
                                                <p className="font-medium">{selectedTransaction.transaction_type}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm text-gray-500">Amount</label>
                                                <p className="font-medium text-lg">KES {selectedTransaction.amount.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm text-gray-500">Bank Name</label>
                                                <p className="font-medium">{selectedTransaction.bank_name}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm text-gray-500">Account Number</label>
                                                <p className="font-medium">{selectedTransaction.account_number || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm text-gray-500">Reference Number</label>
                                                <p className="font-medium">{selectedTransaction.reference_number || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm text-gray-500">Transaction Date</label>
                                                <p className="font-medium">{new Date(selectedTransaction.transaction_date).toLocaleDateString()}</p>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm text-gray-500">Purpose Description</label>
                                            <p className="font-medium mt-1">{selectedTransaction.purpose_description}</p>
                                        </div>

                                        <div>
                                            <label className="text-sm text-gray-500">Status</label>
                                            <div className="mt-1">{getStatusBadge(selectedTransaction.status)}</div>
                                        </div>

                                        {selectedTransaction.status === 'REJECTED' && selectedTransaction.notes && (
                                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                                <label className="text-sm font-medium text-red-800">Rejection Reason</label>
                                                <p className="text-red-700 mt-1">{selectedTransaction.notes}</p>
                                            </div>
                                        )}

                                        {selectedTransaction.recorded_by_user && (
                                            <div>
                                                <label className="text-sm text-gray-500">Recorded By</label>
                                                <p className="font-medium">{selectedTransaction.recorded_by_user.full_name}</p>
                                                <p className="text-xs text-gray-500">{new Date(selectedTransaction.created_at).toLocaleString()}</p>
                                            </div>
                                        )}

                                        {selectedTransaction.approved_by_user && (
                                            <div>
                                                <label className="text-sm text-gray-500">
                                                    {selectedTransaction.status === 'APPROVED' ? 'Approved By' : 'Reviewed By'}
                                                </label>
                                                <p className="font-medium">{selectedTransaction.approved_by_user.full_name}</p>
                                                {selectedTransaction.approved_at && (
                                                    <p className="text-xs text-gray-500">{new Date(selectedTransaction.approved_at).toLocaleString()}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t pt-4">
                                        <IOSButton
                                            variant="secondary"
                                            onClick={() => setSelectedTransaction(null)}
                                            className="w-full"
                                        >
                                            Close
                                        </IOSButton>
                                    </div>
                                </div>
                            </IOSCard>
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
