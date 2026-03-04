'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { CreditCard, Plus, Filter, CheckCircle, XCircle, Clock, AlertTriangle, Eye, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { paymentsVerificationAPI } from '@/lib/api';
import { PaymentDetailModal } from '@/components/modals/PaymentDetailModal';

export default function BranchPaymentsEnhancedPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [activeTab, setActiveTab] = useState<'pending' | 'accountant_verified' | 'auditor_verified' | 'flagged'>('pending');
    const [payments, setPayments] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<any>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    useEffect(() => {
        if (activeBranchId) {
            fetchPayments();
            fetchStats();
        }
    }, [activeBranchId, activeTab]);

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const response = await paymentsVerificationAPI.getPayments({
                branch_id: activeBranchId,
                status: activeTab
            });
            if (response.success) {
                setPayments(response.data || []);
            } else {
                toast.error('Failed to fetch payments');
            }
        } catch (error: any) {
            console.error('Error fetching payments:', error);
            toast.error(error.message || 'Failed to fetch payments');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await paymentsVerificationAPI.getPaymentStats({
                branch_id: activeBranchId
            });
            if (response.success) {
                setStats(response.data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const handleViewDetails = async (paymentId: string) => {
        try {
            const response = await paymentsVerificationAPI.getPaymentById(paymentId);
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
            case 'pending': return <Clock className="h-4 w-4" />;
            case 'accountant_verified': return <CheckCircle className="h-4 w-4" />;
            case 'auditor_verified': return <CheckCircle className="h-4 w-4" />;
            case 'flagged': return <AlertTriangle className="h-4 w-4" />;
            default: return <Clock className="h-4 w-4" />;
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

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <CreditCard className="h-6 w-6 text-blue-600" />
                                Payment Verification
                            </h1>
                            <p className="text-gray-500">Verify and track all branch payments</p>
                        </div>
                    </div>

                    {/* Statistics Cards */}
                    {stats && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <IOSCard className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm text-gray-500">Total Payments</div>
                                        <div className="text-2xl font-bold text-gray-900">{stats.total_payments}</div>
                                    </div>
                                    <TrendingUp className="h-8 w-8 text-blue-600" />
                                </div>
                            </IOSCard>
                            <IOSCard className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm text-gray-500">Pending</div>
                                        <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
                                    </div>
                                    <Clock className="h-8 w-8 text-amber-600" />
                                </div>
                            </IOSCard>
                            <IOSCard className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm text-gray-500">Verified</div>
                                        <div className="text-2xl font-bold text-green-600">{stats.auditor_verified}</div>
                                    </div>
                                    <CheckCircle className="h-8 w-8 text-green-600" />
                                </div>
                            </IOSCard>
                            <IOSCard className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm text-gray-500">Total Amount</div>
                                        <div className="text-xl font-bold text-gray-900">KES {stats.total_amount.toLocaleString()}</div>
                                    </div>
                                    <CreditCard className="h-8 w-8 text-blue-600" />
                                </div>
                            </IOSCard>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 overflow-x-auto">
                        {[
                            { id: 'pending', label: 'Pending Verification', icon: Clock, count: stats?.pending || 0 },
                            { id: 'accountant_verified', label: 'Awaiting Auditor', icon: CheckCircle, count: stats?.accountant_verified || 0 },
                            { id: 'auditor_verified', label: 'Approved', icon: CheckCircle, count: stats?.auditor_verified || 0 },
                            { id: 'flagged', label: 'Flagged', icon: AlertTriangle, count: stats?.flagged || 0 },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-semibold">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Payments Table */}
                    <IOSCard className="p-0">
                        {loading ? (
                            <div className="text-center py-12 text-gray-500">Loading payments...</div>
                        ) : payments.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <Clock className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                                <p>No {activeTab.replace('_', ' ')} payments found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3">Date</th>
                                            <th className="px-6 py-3">Customer</th>
                                            <th className="px-6 py-3">Payment Method</th>
                                            <th className="px-6 py-3">Reference</th>
                                            <th className="px-6 py-3 text-right">Amount</th>
                                            <th className="px-6 py-3">Recorded By</th>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {payments.map((payment) => (
                                            <tr key={payment.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 text-gray-500">
                                                    {new Date(payment.recorded_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 font-medium text-gray-900">
                                                    {payment.customer_name || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                                        {payment.payment_method}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">
                                                    {payment.reference_number || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-gray-900">
                                                    KES {parseFloat(payment.amount).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">
                                                    {payment.recorded_by_user?.full_name || 'Unknown'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${getStatusColor(payment.status)}`}>
                                                        {getStatusIcon(payment.status)}
                                                        {payment.status.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <IOSButton
                                                        size="sm"
                                                        onClick={() => handleViewDetails(payment.id)}
                                                        leftIcon={<Eye />}
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

                {/* Payment Detail Modal */}
                {showDetailModal && selectedPayment && (
                    <PaymentDetailModal
                        payment={selectedPayment}
                        onClose={() => {
                            setShowDetailModal(false);
                            setSelectedPayment(null);
                        }}
                        onVerified={handlePaymentVerified}
                        userRole={user?.role || ''}
                    />
                )}
            </DashboardLayout>
        </ProtectedRoute>
    );
}
