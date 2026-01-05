'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { auditorAPI, systemAPI } from '@/lib/api';
import { ArrowLeft, Calendar, DollarSign, Filter, RefreshCw, CreditCard, Banknote, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function SalesVerificationPage() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [branches, setBranches] = useState<any[]>([]);
    const [filters, setFilters] = useState({
        date: new Date().toISOString().split('T')[0],
        branch_id: ''
    });

    const fetchBranches = useCallback(async () => {
        try {
            const response = await systemAPI.getBranches();
            if (response.success) {
                setBranches(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await auditorAPI.getSalesVerification({
                date: filters.date,
                branch_id: filters.branch_id ? Number(filters.branch_id) : undefined
            });

            if (response.success) {
                setData(response.data);
            } else {
                toast.error('Failed to fetch sales data');
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error loading sales data');
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchBranches();
    }, [fetchBranches]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES'
        }).format(amount);
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Link href="/dashboard/audit" className="btn-icon-subtle">
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                            <div>
                                <h1 className="text-[22px] font-semibold text-stone-900">Sales Verification</h1>
                                <p className="text-stone-500 text-sm">Verify daily sales and payment reconciliations</p>
                            </div>
                        </div>
                        <button onClick={fetchData} disabled={isLoading} className="btn-secondary self-start sm:self-auto">
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="card-elevated p-4 flex flex-wrap gap-4 items-end">
                        <div className="w-full sm:w-auto">
                            <label className="text-xs font-medium text-stone-500 mb-1.5 block">Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <input
                                    type="date"
                                    value={filters.date}
                                    onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
                                    className="input-field pl-9 w-full sm:w-40"
                                />
                            </div>
                        </div>
                        <div className="w-full sm:w-auto min-w-[200px]">
                            <label className="text-xs font-medium text-stone-500 mb-1.5 block">Branch</label>
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <select
                                    value={filters.branch_id}
                                    onChange={(e) => setFilters(prev => ({ ...prev, branch_id: e.target.value }))}
                                    className="input-field pl-9 w-full"
                                >
                                    <option value="">All Branches</option>
                                    {branches.map(branch => (
                                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        </div>
                    ) : data ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Total Sales Card */}
                            <div className="card-elevated p-6 lg:col-span-1 bg-gradient-to-br from-green-50 to-white border-green-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-green-100 rounded-lg text-green-600">
                                        <DollarSign className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-stone-900">Total Sales</h3>
                                </div>
                                <p className="text-3xl font-bold text-stone-900">{formatCurrency(data.total_sales || 0)}</p>
                                <p className="text-sm text-stone-500 mt-1">Recorded for {new Date(filters.date).toLocaleDateString()}</p>
                            </div>

                            {/* Breakdown */}
                            <div className="card-elevated p-6 lg:col-span-2">
                                <h3 className="text-lg font-semibold text-stone-900 mb-4">Payment Breakdown</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {Object.entries(data.breakdown || {}).map(([method, amount]: [string, any]) => (
                                        <div key={method} className="flex items-center justify-between p-4 bg-stone-50 rounded-lg border border-stone-100">
                                            <div className="flex items-center gap-3">
                                                {method.toLowerCase().includes('cash') ? (
                                                    <Banknote className="h-5 w-5 text-stone-500" />
                                                ) : (
                                                    <CreditCard className="h-5 w-5 text-stone-500" />
                                                )}
                                                <span className="font-medium text-stone-700 capitalize">{method.replace('_', ' ')}</span>
                                            </div>
                                            <span className="font-semibold text-stone-900">{formatCurrency(amount)}</span>
                                        </div>
                                    ))}
                                    {Object.keys(data.breakdown || {}).length === 0 && (
                                        <p className="text-stone-500 italic">No sales data found for this date.</p>
                                    )}
                                </div>
                            </div>

                            {/* Discrepancies (Placeholder for now) */}
                            <div className="card-elevated p-6 lg:col-span-3">
                                <div className="flex items-center gap-2 mb-4">
                                    <AlertCircle className="h-5 w-5 text-orange-500" />
                                    <h3 className="text-lg font-semibold text-stone-900">Discrepancies & Flags</h3>
                                </div>
                                {data.discrepancies && data.discrepancies.length > 0 ? (
                                    <div className="space-y-3">
                                        {data.discrepancies.map((disc: any, i: number) => (
                                            <div key={i} className="p-3 bg-orange-50 border border-orange-100 rounded-lg text-sm text-orange-800">
                                                {disc.message}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center bg-stone-50 rounded-lg border border-dashed border-stone-200">
                                        <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                                        <p className="text-stone-600 font-medium">No discrepancies detected</p>
                                        <p className="text-stone-400 text-sm">Sales data matches recorded payments.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-stone-500">
                            No data available.
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
