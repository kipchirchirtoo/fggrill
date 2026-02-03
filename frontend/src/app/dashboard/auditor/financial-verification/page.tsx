'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    DollarSign, RefreshCw, Building2, ChevronRight,
    TrendingUp, AlertCircle, ShieldCheck
} from 'lucide-react';
import { auditAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { toast } from 'sonner';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';

export default function FinancialVerificationPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.verifyFinances({
                date: selectedDate
            });

            if (res.success) {
                setData(res.data);
            } else {
                toast.error(res.message || 'Failed to fetch financial data');
            }
        } catch (e) {
            console.error("Financial fetch failed:", e);
            toast.error('An error occurred while fetching finances');
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const branchSummaries = data?.branch_summaries || [];
    const totalPayments = data?.total_payments || 0;
    const totalVariance = data?.variance || 0;

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Financial Verification</h1>
                            <p className="text-gray-500">Daily reconciliation of payment gateways vs sales data</p>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-white border border-stone-200 rounded-lg px-4 h-10 text-sm font-medium text-stone-900"
                            />
                            <IOSButton variant="secondary" onClick={fetchData} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>
                                Refresh
                            </IOSButton>
                        </div>
                    </div>

                    {/* System-wide Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <IOSCard className="p-6 bg-stone-900 text-white">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                                    <DollarSign className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-stone-400 uppercase tracking-wider">Total Revenue</p>
                                    <p className="text-2xl font-bold">KES {totalPayments.toLocaleString()}</p>
                                </div>
                            </div>
                            <p className="text-xs text-stone-400 mt-3">Verified for {selectedDate}</p>
                        </IOSCard>

                        <IOSCard className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${totalVariance < 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                                    <AlertCircle className={`h-5 w-5 ${totalVariance < 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider">Variance</p>
                                    <p className={`text-2xl font-bold ${totalVariance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        KES {totalVariance.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-3">Gap vs Registered Sales</p>
                        </IOSCard>

                        <IOSCard className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                    <Building2 className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider">Branches</p>
                                    <p className="text-2xl font-bold text-gray-900">{branchSummaries.length}</p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-3">Active operational nodes</p>
                        </IOSCard>
                    </div>

                    {/* Branch Cards */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : branchSummaries.length === 0 ? (
                        <IOSCard className="p-12 text-center">
                            <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500">No branch data found for this date</p>
                        </IOSCard>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {branchSummaries.map((branch: any) => (
                                <IOSCard
                                    key={branch.branch_id}
                                    className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                                    onClick={() => router.push(`/dashboard/auditor/financial-verification/${branch.branch_id}`)}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center">
                                                <Building2 className="h-5 w-5 text-stone-600" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{branch.branch_name}</p>
                                                <p className="text-xs text-gray-400">Branch #{branch.branch_id}</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-gray-300" />
                                    </div>

                                    <div className="space-y-2 pt-3 border-t border-stone-50">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-500">Total Collected</span>
                                            <span className="text-sm font-bold text-gray-900">
                                                KES {(branch.total_payments || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-500">Transactions</span>
                                            <span className="text-sm font-semibold text-gray-700">
                                                {branch.payment_count || 0}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-500">Variance</span>
                                            <IOSBadge
                                                variant="light"
                                                color={(branch.variance || 0) < 0 ? 'danger' : 'success'}
                                                className="text-xs"
                                            >
                                                KES {(branch.variance || 0).toLocaleString()}
                                            </IOSBadge>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-stone-50">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-gray-400">Status</span>
                                            <div className="flex items-center gap-1">
                                                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                                                <span className="text-emerald-600 font-medium">Verified</span>
                                            </div>
                                        </div>
                                    </div>
                                </IOSCard>
                            ))}
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
