'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import {
    CreditCard, RefreshCw, CheckCircle, AlertTriangle, Clock,
    TrendingUp, Eye, Banknote, Filter, X
} from 'lucide-react';
import { toast } from 'sonner';
import { paymentsVerificationAPI } from '@/lib/api';
import { PaymentDetailModal } from '@/components/modals/PaymentDetailModal';

type TabId = 'all' | 'pending' | 'accountant_verified' | 'auditor_verified' | 'flagged';

export default function BranchPaymentsPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();

    const [activeTab, setActiveTab] = useState<TabId>('all');
    const [payments, setPayments] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<any>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // Date filters
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(firstOfMonth);
    const [endDate, setEndDate] = useState(today);
    const [filtersApplied, setFiltersApplied] = useState(false);

    const fetchPayments = useCallback(async () => {
        if (!activeBranchId) return;
        setLoading(true);
        try {
            const params: any = {
                branch_id: activeBranchId,
            };
            if (activeTab !== 'all') params.status = activeTab;
            if (filtersApplied) {
                if (startDate) params.start_date = startDate;
                if (endDate) params.end_date = endDate;
            }
            const response = await paymentsVerificationAPI.getPayments(params);
            if (response.success) {
                setPayments(response.data || []);
            } else {
                toast.error(response.message || 'Failed to fetch payments');
                setPayments([]);
            }
        } catch (error: any) {
            console.error('Error fetching payments:', error);
            toast.error(error.message || 'Failed to fetch payments');
            setPayments([]);
        } finally {
            setLoading(false);
        }
    }, [activeBranchId, activeTab, filtersApplied, startDate, endDate]);

    const fetchStats = useCallback(async () => {
        if (!activeBranchId) return;
        try {
            const params: any = { branch_id: activeBranchId };
            if (filtersApplied) {
                if (startDate) params.start_date = startDate;
                if (endDate) params.end_date = endDate;
            }
            const response = await paymentsVerificationAPI.getPaymentStats(params);
            if (response.success) setStats(response.data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    }, [activeBranchId, filtersApplied, startDate, endDate]);

    useEffect(() => {
        fetchPayments();
        fetchStats();
    }, [fetchPayments, fetchStats]);

    const handleApplyFilters = () => {
        setFiltersApplied(true);
    };

    const handleClearFilters = () => {
        setStartDate(firstOfMonth);
        setEndDate(today);
        setFiltersApplied(false);
    };

    const handleViewDetails = async (payment: any) => {
        // All non-payment_verification records are already fully loaded
        if (payment._source === 'banking' || payment._source === 'payment' || payment._source === 'pos') {
            setSelectedPayment(payment);
            setShowDetailModal(true);
            return;
        }
        // payment_verifications — fetch full detail from API
        try {
            const response = await paymentsVerificationAPI.getPaymentById(payment.id);
            if (response.success) {
                setSelectedPayment(response.data);
                setShowDetailModal(true);
            } else {
                toast.error('Failed to load payment details');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to load payment details');
        }
    };

    const handlePaymentVerified = () => {
        fetchPayments();
        fetchStats();
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <Clock className="h-3 w-3" />;
            case 'accountant_verified': return <CheckCircle className="h-3 w-3" />;
            case 'auditor_verified': return <CheckCircle className="h-3 w-3" />;
            case 'flagged': return <AlertTriangle className="h-3 w-3" />;
            default: return <Clock className="h-3 w-3" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'text-amber-600 bg-amber-100';
            case 'accountant_verified': return 'text-blue-600 bg-blue-100';
            case 'auditor_verified': return 'text-green-600 bg-green-100';
            case 'flagged': return 'text-red-600 bg-red-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const tabs: { id: TabId; label: string; icon: any; countKey?: string }[] = [
        { id: 'all', label: 'All Payments', icon: CreditCard },
        { id: 'pending', label: 'Pending', icon: Clock, countKey: 'pending' },
        { id: 'accountant_verified', label: 'Awaiting Auditor', icon: CheckCircle, countKey: 'accountant_verified' },
        { id: 'auditor_verified', label: 'Approved', icon: CheckCircle, countKey: 'auditor_verified' },
        { id: 'flagged', label: 'Flagged', icon: AlertTriangle, countKey: 'flagged' },
    ];

    return (
        <ProtectedRoute allowedRoles={[
            UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER,
            UserRole.SUPER_ADMIN, UserRole.AUDITOR
        ]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <CreditCard className="h-6 w-6 text-blue-600" />
                                Payments Dashboard
                            </h1>
                            <p className="text-gray-500">All branch payments including banking transactions</p>
                        </div>
                        <IOSButton
                            variant="secondary"
                            onClick={() => { fetchPayments(); fetchStats(); }}
                            leftIcon={<RefreshCw className={loading ? 'animate-spin' : ''} />}
                            disabled={loading}
                        >
                            Refresh
                        </IOSButton>
                    </div>

                    {/* Date Filter */}
                    <IOSCard className="p-4">
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <Filter className="h-4 w-4" />
                                Date Range
                            </div>
                            <div className="flex flex-wrap gap-3 flex-1">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-500">From</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="h-9 px-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-500">To</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="h-9 px-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div className="flex items-end gap-2">
                                    <IOSButton size="sm" onClick={handleApplyFilters} leftIcon={<Filter />}>
                                        Apply
                                    </IOSButton>
                                    {filtersApplied && (
                                        <IOSButton size="sm" variant="outline" onClick={handleClearFilters} leftIcon={<X />}>
                                            Clear
                                        </IOSButton>
                                    )}
                                </div>
                            </div>
                            {filtersApplied && (
                                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                                    Filtered: {startDate} → {endDate}
                                </span>
                            )}
                        </div>
                    </IOSCard>

                    {/* Stats */}
                    {stats && (
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                            <IOSCard className="p-4">
                                <div className="text-sm text-gray-500">Total</div>
                                <div className="text-2xl font-bold text-gray-900">{stats.total_payments}</div>
                                <TrendingUp className="h-5 w-5 text-blue-400 mt-1" />
                            </IOSCard>
                            <IOSCard className="p-4">
                                <div className="text-sm text-gray-500">Pending</div>
                                <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
                                <Clock className="h-5 w-5 text-amber-400 mt-1" />
                            </IOSCard>
                            <IOSCard className="p-4">
                                <div className="text-sm text-gray-500">Approved</div>
                                <div className="text-2xl font-bold text-green-600">{stats.auditor_verified}</div>
                                <CheckCircle className="h-5 w-5 text-green-400 mt-1" />
                            </IOSCard>
                            <IOSCard className="p-4">
                                <div className="text-sm text-gray-500">Banking</div>
                                <div className="text-xl font-bold text-gray-900">
                                    KES {(stats.banking_total || 0).toLocaleString()}
                                </div>
                                <Banknote className="h-5 w-5 text-gray-400 mt-1" />
                            </IOSCard>
                            <IOSCard className="p-4">
                                <div className="text-sm text-gray-500">POS / Cashier</div>
                                <div className="text-xl font-bold text-gray-900">
                                    KES {((stats.pos_total || 0) + (stats.payments_total || 0)).toLocaleString()}
                                </div>
                                <CreditCard className="h-5 w-5 text-purple-400 mt-1" />
                            </IOSCard>
                            <IOSCard className="p-4">
                                <div className="text-sm text-gray-500">Total Amount</div>
                                <div className="text-xl font-bold text-gray-900">
                                    KES {(stats.total_amount || 0).toLocaleString()}
                                </div>
                                <TrendingUp className="h-5 w-5 text-blue-400 mt-1" />
                            </IOSCard>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 overflow-x-auto">
                        {tabs.map(tab => {
                            const count = tab.countKey ? (stats?.[tab.countKey] || 0) : payments.length;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                        activeTab === tab.id
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <tab.icon className="h-4 w-4" />
                                    {tab.label}
                                    {count > 0 && (
                                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Table */}
                    <IOSCard className="p-0 overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
                                <RefreshCw className="h-5 w-5 animate-spin" />
                                Loading payments...
                            </div>
                        ) : payments.length === 0 ? (
                            <div className="text-center py-16 text-gray-500">
                                <CreditCard className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                                <p className="font-medium">No payments found</p>
                                <p className="text-sm mt-1">
                                    {filtersApplied
                                        ? `No payments between ${startDate} and ${endDate}`
                                        : activeTab !== 'all'
                                        ? `No ${activeTab.replace(/_/g, ' ')} payments`
                                        : 'No payment records exist yet'}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-4 py-3">Date</th>
                                            <th className="px-4 py-3">Source</th>
                                            <th className="px-4 py-3">Description</th>
                                            <th className="px-4 py-3">Method</th>
                                            <th className="px-4 py-3">Reference</th>
                                            <th className="px-4 py-3 text-right">Amount</th>
                                            <th className="px-4 py-3">Recorded By</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {payments.map((payment) => (
                                            <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                                    {(() => {
                                                        const raw = payment._transaction_date || payment.recorded_at || payment.created_at;
                                                        if (!raw) return '—';
                                                        const d = new Date(raw);
                                                        return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {payment._source === 'banking' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                                            <Banknote className="h-3 w-3" />
                                                            Banking
                                                        </span>
                                                    ) : payment._source === 'pos' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                                            <CreditCard className="h-3 w-3" />
                                                            POS
                                                        </span>
                                                    ) : payment._source === 'payment' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                                            <CreditCard className="h-3 w-3" />
                                                            Cashier
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                                            <CreditCard className="h-3 w-3" />
                                                            Verified
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate">
                                                    {payment._source === 'banking'
                                                        ? `${payment._banking_type} — ${payment._bank_name}`
                                                        : payment.customer_name || payment.notes || 'N/A'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                                                        {payment.payment_method || '—'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 text-xs">
                                                    {payment.reference_number || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                                                    KES {parseFloat(payment.amount || 0).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 text-xs">
                                                    {payment.recorded_by_user?.full_name || '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                                                        {getStatusIcon(payment.status)}
                                                        {payment.status?.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <IOSButton
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => handleViewDetails(payment)}
                                                        leftIcon={<Eye className="h-3 w-3" />}
                                                    >
                                                        View
                                                    </IOSButton>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </IOSCard>
                </div>

                {showDetailModal && selectedPayment && (
                    <PaymentDetailModal
                        payment={selectedPayment}
                        onClose={() => { setShowDetailModal(false); setSelectedPayment(null); }}
                        onVerified={handlePaymentVerified}
                        userRole={user?.role || ''}
                    />
                )}
            </DashboardLayout>
        </ProtectedRoute>
    );
}
