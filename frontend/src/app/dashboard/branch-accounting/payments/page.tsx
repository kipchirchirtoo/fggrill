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
    TrendingUp, Eye, Banknote, Filter, X, FileText, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { paymentsVerificationAPI } from '@/lib/api';
import { PaymentVerification, PaymentStats } from '@/lib/api/types';
import { PaymentDetailModal } from '@/components/modals/PaymentDetailModal';
import { PYTHON_SERVICE_URL } from '@/lib/config';

type TabId = 'all' | 'pending' | 'accountant_verified' | 'auditor_verified' | 'flagged';

export default function BranchPaymentsPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();

    const [activeTab, setActiveTab] = useState<TabId>('all');
    const [payments, setPayments] = useState<PaymentVerification[]>([]);
    const [stats, setStats] = useState<PaymentStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<PaymentVerification | null>(null);
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

    const handleViewDetails = async (payment: PaymentVerification) => {
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

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'pending': return 'Pending';
            case 'accountant_verified': return 'Awaiting Auditor';
            case 'auditor_verified': return 'Approved';
            case 'flagged': return 'Flagged';
            default: return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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

    const tabs: { id: TabId; label: string; icon: any; countKey?: keyof PaymentStats }[] = [
        { id: 'all', label: 'All Payments', icon: CreditCard },
        { id: 'pending', label: 'Pending', icon: Clock, countKey: 'pending' as keyof PaymentStats },
        { id: 'accountant_verified', label: 'Awaiting Auditor', icon: CheckCircle, countKey: 'accountant_verified' as keyof PaymentStats },
        { id: 'auditor_verified', label: 'Approved', icon: CheckCircle, countKey: 'auditor_verified' as keyof PaymentStats },
        { id: 'flagged', label: 'Flagged', icon: AlertTriangle, countKey: 'flagged' as keyof PaymentStats },
    ];

    const handleExportPdf = async () => {
        try {
            toast.loading('Generating payments PDF report...');
            const payload = {
                title: 'BRANCH PAYMENTS DASHBOARD REPORT',
                period: `Period: ${startDate || 'All'} to ${endDate || 'Current'}`,
                branch: 'Kyogong',
                company_name: 'FAMOUSGATE HOTELS',
                columns: [
                    { header: 'Date', align: 'center', weight: 1.5 },
                    { header: 'Source', align: 'left', weight: 1.5 },
                    { header: 'Description', align: 'left', weight: 3.5 },
                    { header: 'Method', align: 'center', weight: 1.8 },
                    { header: 'Reference', align: 'left', weight: 2.2 },
                    { header: 'Amount (KES)', align: 'right', weight: 2.0 },
                    { header: 'Recorded By', align: 'left', weight: 2.5 },
                    { header: 'Status', align: 'center', weight: 1.5 },
                ],
                rows: payments.map((p) => [
                    p.recorded_at ? new Date(p.recorded_at).toLocaleDateString() : 'N/A',
                    p.payment_source || 'Cashier',
                    p.description || 'Branch Payment',
                    p.payment_method || 'N/A',
                    p.reference_number || 'N/A',
                    Number(p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    p.recorded_by_name || 'Staff',
                    (p.status || 'PENDING').toUpperCase(),
                ]),
                summary: [
                    { label: 'Total Payments', value: `${stats?.total_payments || payments.length}` },
                    { label: 'Total Amount', value: `KES ${(stats?.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
                    { label: 'Pending Payments', value: `${stats?.pending || 0}` },
                    { label: 'Approved Payments', value: `${stats?.auditor_verified || 0}` },
                    { label: 'Banking Total', value: `KES ${(stats?.banking_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
                    { label: 'POS / Cashier Total', value: `KES ${((stats?.pos_total || 0) + (stats?.payments_total || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
                ],
                totals: [
                    'TOTALS', '', '', '', '',
                    (stats?.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
                    '', ''
                ],
            };

            const response = await fetch(`${PYTHON_SERVICE_URL}/api/payroll/generate-statement-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const text = await response.text();
                let errMsg = 'PDF generation failed';
                try {
                    const json = JSON.parse(text);
                    errMsg = json.error || json.message || errMsg;
                } catch (_) {}
                throw new Error(errMsg);
            }

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const json = await response.json();
                throw new Error(json.error || json.message || 'Server returned invalid PDF response');
            }

            const blob = await response.blob();
            if (blob.size < 100) {
                throw new Error('Generated PDF is empty or corrupted');
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `FG_Payments_Dashboard_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            toast.dismiss();
            toast.success('Payments PDF exported successfully!');
        } catch (e: any) {
            toast.dismiss();
            toast.error(e.message || 'Failed to export PDF');
        }
    };

    const handleExportCsv = () => {
        try {
            const headers = ['Date', 'Source', 'Description', 'Method', 'Reference', 'Amount', 'Recorded By', 'Status'];
            const rows = payments.map((p) => [
                p.recorded_at ? new Date(p.recorded_at).toLocaleDateString() : 'N/A',
                p.payment_source || 'Cashier',
                p.description || 'Branch Payment',
                p.payment_method || 'N/A',
                p.reference_number || 'N/A',
                Number(p.amount || 0).toFixed(2),
                p.recorded_by_name || 'Staff',
                (p.status || 'PENDING').toUpperCase(),
            ]);

            const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `FG_Payments_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Payments CSV downloaded!');
        } catch (e: any) {
            toast.error('Failed to download CSV');
        }
    };

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
                            <p className="text-gray-500">All Branch Payments Including Banking Transactions</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <IOSButton
                                variant="secondary"
                                onClick={handleExportPdf}
                                leftIcon={<FileText className="h-4 w-4 text-red-600" />}
                                disabled={loading || payments.length === 0}
                            >
                                Export PDF
                            </IOSButton>
                            <IOSButton
                                variant="secondary"
                                onClick={handleExportCsv}
                                leftIcon={<Download className="h-4 w-4 text-emerald-600" />}
                                disabled={loading || payments.length === 0}
                            >
                                Export CSV
                            </IOSButton>
                            <IOSButton
                                variant="secondary"
                                onClick={() => { fetchPayments(); fetchStats(); }}
                                leftIcon={<RefreshCw className={loading ? 'animate-spin' : ''} />}
                                disabled={loading}
                            >
                                Refresh
                            </IOSButton>
                        </div>
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
                            const count = tab.countKey ? (stats ? (stats[tab.countKey] as number) : 0) : payments.length;
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
                                Loading Payments...
                            </div>
                        ) : payments.length === 0 ? (
                            <div className="text-center py-16 text-gray-500">
                                <CreditCard className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                                <p className="font-medium">No Payments Found</p>
                                <p className="text-sm mt-1">
                                    {filtersApplied
                                        ? `No Payments Between ${startDate} and ${endDate}`
                                        : activeTab !== 'all'
                                        ? `No ${getStatusLabel(activeTab)} Payments`
                                        : 'No Payment Records Exist Yet'}
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
                                                    KES {(payment.amount || 0).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 text-xs">
                                                    {payment.recorded_by_user?.full_name || '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                                                        {getStatusIcon(payment.status)}
                                                        {getStatusLabel(payment.status)}
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
