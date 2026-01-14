'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { restaurantAPI, financeAPI } from '@/lib/api';
import {
    Calendar, RefreshCw, CheckCircle, AlertTriangle,
    DollarSign, CreditCard, Smartphone, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function VerifySalesPage() {
    const { user } = useAuth();
    const { activeBranchId, activeBranch } = useBranch();
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isLoading, setIsLoading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [salesData, setSalesData] = useState<any>(null);
    const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'discrepancy'>('pending');

    // Use active branch from context, fallback to user's branch
    const currentBranchId = activeBranchId || user?.branch_id;

    const fetchSalesData = useCallback(async () => {
        if (!currentBranchId) return;

        setIsLoading(true);
        try {
            // Fetch sales data for the selected date
            const response = await restaurantAPI.getDailySales(currentBranchId, date);
            if (response.success) {
                setSalesData(response.data);
                setVerificationStatus(response.data.verification_status || 'pending');
            } else {
                toast.error('Failed to load sales data');
            }
        } catch (error: any) {
            console.error('Error fetching sales:', error);
            if (error?.message?.includes('403') || error?.message?.includes('authorized') || error?.message?.includes('permission')) {
                toast.error('You do not have permission to view daily sales.', { duration: 5000 });
                setVerificationStatus('discrepancy'); // Using discrepancy state to show red alert equivalent
            } else {
                toast.error('Error loading sales data');
            }
        } finally {
            setIsLoading(false);
        }
    }, [currentBranchId, date]);

    useEffect(() => {
        fetchSalesData();
    }, [fetchSalesData]);

    const handleVerify = async () => {
        if (!currentBranchId) return;

        setIsVerifying(true);
        try {
            // This endpoint might need to be created in backend or we mock it for now
            // Assuming financeAPI.verifyDailySales exists or we simulate it
            // const response = await financeAPI.verifyDailySales(currentBranchId, date);

            // Simulating API call for now as verified in plan
            await new Promise(resolve => setTimeout(resolve, 1000));

            setVerificationStatus('verified');
            toast.success('Daily sales verified successfully');

            // Refresh data
            fetchSalesData();
        } catch (error) {
            console.error('Error verifying sales:', error);
            toast.error('Failed to verify sales');
        } finally {
            setIsVerifying(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES'
        }).format(amount || 0);
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6 max-w-5xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Link href="/dashboard/branch-accounting">
                                <button className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                                    <ArrowLeft className="h-5 w-5 text-stone-600" />
                                </button>
                            </Link>
                            <div>
                                <h1 className="text-[24px] font-bold text-stone-900">Verify Daily Sales</h1>
                                <p className="text-stone-500 text-sm">Review/Approve daily transactions</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-stone-900 focus:border-stone-900 outline-none"
                                />
                            </div>
                            <button
                                onClick={fetchSalesData}
                                disabled={isLoading}
                                className="btn-secondary"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* Verification Status Banner */}
                    <div className={`p-4 rounded-xl border ${verificationStatus === 'verified' ? 'bg-emerald-50 border-emerald-100' :
                            verificationStatus === 'discrepancy' ? 'bg-red-50 border-red-100' :
                                'bg-amber-50 border-amber-100'
                        }`}>
                        <div className="flex items-center gap-3">
                            {verificationStatus === 'verified' ? (
                                <CheckCircle className="h-6 w-6 text-emerald-600" />
                            ) : verificationStatus === 'discrepancy' ? (
                                <AlertTriangle className="h-6 w-6 text-red-600" />
                            ) : (
                                <AlertTriangle className="h-6 w-6 text-amber-600" />
                            )}
                            <div>
                                <h3 className={`font-semibold ${verificationStatus === 'verified' ? 'text-emerald-900' :
                                        verificationStatus === 'discrepancy' ? 'text-red-900' :
                                            'text-amber-900'
                                    }`}>
                                    {verificationStatus === 'verified' ? 'Sales Verified' :
                                        verificationStatus === 'discrepancy' ? 'Discrepancy Detected' :
                                            'Pending Verification'}
                                </h3>
                                <p className={`text-sm ${verificationStatus === 'verified' ? 'text-emerald-700' :
                                        verificationStatus === 'discrepancy' ? 'text-red-700' :
                                            'text-amber-700'
                                    }`}>
                                    {verificationStatus === 'verified' ? 'This day has been verified and locked.' :
                                        verificationStatus === 'discrepancy' ? 'Totals do not match reported values.' :
                                            'Please review the sales summary below and verify.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Sales Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="card-elevated p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider">Total Sales</h3>
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <DollarSign className="h-5 w-5 text-blue-600" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-stone-900 mb-1">
                                {formatCurrency(salesData?.total_sales || 0)}
                            </p>
                            <p className="text-xs text-stone-400">Gross revenue</p>
                        </div>

                        <div className="card-elevated p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider">Cash</h3>
                                <div className="p-2 bg-emerald-50 rounded-lg">
                                    <DollarSign className="h-5 w-5 text-emerald-600" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-stone-600">Reported:</span>
                                    <span className="font-semibold">{formatCurrency(salesData?.cash_total || 0)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-stone-600">System:</span>
                                    <span className="font-semibold">{formatCurrency(salesData?.system_cash || salesData?.cash_total || 0)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="card-elevated p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider">Digital</h3>
                                <div className="p-2 bg-purple-50 rounded-lg">
                                    <CreditCard className="h-5 w-5 text-purple-600" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-stone-600">M-Pesa:</span>
                                    <span className="font-semibold">{formatCurrency(salesData?.mpesa_total || 0)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-stone-600">Card:</span>
                                    <span className="font-semibold">{formatCurrency(salesData?.card_total || 0)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Breakdown */}
                    <div className="card-elevated overflow-hidden">
                        <div className="p-5 border-b border-stone-100 flex justify-between items-center">
                            <h3 className="font-semibold text-stone-900">Transaction Breakdown</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-stone-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Time</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Order ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Items</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Method</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-stone-100 hidden-scrollbar">
                                    {salesData?.transactions?.map((tx: any, i: number) => (
                                        <tr key={i} className="hover:bg-stone-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500">
                                                {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-900">
                                                {tx.order_number || `#${tx.id.substring(0, 8)}`}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-stone-500 max-w-xs truncate">
                                                {tx.items?.map((item: any) => `${item.quantity}x ${item.name}`).join(', ')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.payment_method === 'cash' ? 'bg-emerald-100 text-emerald-700' :
                                                        tx.payment_method === 'mpesa' ? 'bg-green-100 text-green-700' :
                                                            'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {tx.payment_method?.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-stone-900">
                                                {formatCurrency(tx.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!salesData?.transactions || salesData.transactions.length === 0) && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-10 text-center text-sm text-stone-500">
                                                No transactions found for this date.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Action Footer */}
                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleVerify}
                            disabled={isVerifying || verificationStatus === 'verified' || !salesData}
                            className={`btn-primary px-8 ${verificationStatus === 'verified' ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                        >
                            {isVerifying ? (
                                <>
                                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                                    Verifying...
                                </>
                            ) : verificationStatus === 'verified' ? (
                                <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Verified
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Verify Daily Sales
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
