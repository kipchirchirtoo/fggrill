'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { staffCreditAPI, systemAPI } from '@/lib/api';
import { ArrowLeft, CreditCard, Filter, RefreshCw, CheckCircle, XCircle, Plus, Settings } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function StaffCreditPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'bills' | 'limits'>('bills');
    const [isLoading, setIsLoading] = useState(true);
    const [bills, setBills] = useState<any[]>([]);
    const [limits, setLimits] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [filters, setFilters] = useState({
        branch_id: '',
        status: 'pending',
        staff_id: ''
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
            if (activeTab === 'bills') {
                const response = await staffCreditAPI.getBills({
                    branch_id: filters.branch_id ? Number(filters.branch_id) : undefined, // Note: API might not support branch_id directly on bills, filtering might happen via staff join or we need to update API
                    status: filters.status === 'all' ? undefined : filters.status,
                    staff_id: filters.staff_id || undefined
                });
                if (response.success) {
                    setBills(response.data || []);
                }
            } else {
                const response = await staffCreditAPI.getLimits({
                    branch_id: filters.branch_id ? Number(filters.branch_id) : undefined,
                    staff_id: filters.staff_id || undefined
                });
                if (response.success) {
                    setLimits(response.data || []);
                }
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error loading data');
        } finally {
            setIsLoading(false);
        }
    }, [activeTab, filters]);

    useEffect(() => {
        fetchBranches();
    }, [fetchBranches]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleApproveBill = async (id: string) => {
        try {
            const response = await staffCreditAPI.approveBill(id, 'deducted');
            if (response.success) {
                toast.success('Bill approved and deducted');
                fetchData();
            } else {
                toast.error('Failed to approve bill');
            }
        } catch (error) {
            toast.error('Error approving bill');
        }
    };

    const handleSetLimit = async () => {
        const staffId = prompt('Enter Staff ID:');
        if (!staffId) return;
        const limit = prompt('Enter Monthly Limit (KES):');
        if (!limit) return;

        try {
            const response = await staffCreditAPI.setLimit({
                staff_id: staffId,
                monthly_limit: Number(limit)
            });
            if (response.success) {
                toast.success('Limit updated');
                fetchData();
            } else {
                toast.error('Failed to set limit');
            }
        } catch (error) {
            toast.error('Error setting limit');
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES'
        }).format(amount);
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Link href="/dashboard/audit" className="btn-icon-subtle">
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                            <div>
                                <h1 className="text-[22px] font-semibold text-stone-900">Staff Credit</h1>
                                <p className="text-stone-500 text-sm">Manage credit limits and bills</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={fetchData} disabled={isLoading} className="btn-secondary">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>Refresh</span>
                            </button>
                            {activeTab === 'limits' && (
                                <button onClick={handleSetLimit} className="btn-primary">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Set Limit
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="border-b border-stone-200">
                        <nav className="-mb-px flex space-x-8">
                            <button
                                onClick={() => setActiveTab('bills')}
                                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === 'bills'
                                        ? 'border-primary-500 text-primary-600'
                                        : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'}
                `}
                            >
                                Credit Bills
                            </button>
                            <button
                                onClick={() => setActiveTab('limits')}
                                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === 'limits'
                                        ? 'border-primary-500 text-primary-600'
                                        : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'}
                `}
                            >
                                Credit Limits
                            </button>
                        </nav>
                    </div>

                    {/* Filters */}
                    <div className="card-elevated p-4 flex flex-wrap gap-4 items-end">
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
                        {activeTab === 'bills' && (
                            <div className="w-full sm:w-auto min-w-[150px]">
                                <label className="text-xs font-medium text-stone-500 mb-1.5 block">Status</label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                                    className="input-field w-full"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="deducted">Deducted</option>
                                    <option value="paid">Paid</option>
                                    <option value="all">All</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        </div>
                    ) : activeTab === 'bills' ? (
                        <div className="card-elevated overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-stone-200 bg-stone-50">
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Date</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Staff</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Description</th>
                                            <th className="text-right py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Amount</th>
                                            <th className="text-center py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Status</th>
                                            <th className="text-right py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {bills.map((bill) => (
                                            <tr key={bill.id} className="hover:bg-stone-50/50">
                                                <td className="py-3 px-4 text-sm text-stone-600">{new Date(bill.date).toLocaleDateString()}</td>
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-stone-900">
                                                        {bill.staff?.user?.first_name} {bill.staff?.user?.last_name}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-stone-600">{bill.description}</td>
                                                <td className="py-3 px-4 text-right text-sm font-medium text-stone-900">{formatCurrency(bill.amount)}</td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                            ${bill.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                            bill.status === 'deducted' ? 'bg-blue-100 text-blue-800' :
                                                                'bg-green-100 text-green-800'
                                                        }
                          `}>
                                                        {bill.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    {bill.status === 'pending' && (
                                                        <button
                                                            onClick={() => handleApproveBill(bill.id)}
                                                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                                                        >
                                                            Approve
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {bills.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-stone-500">No bills found</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="card-elevated overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-stone-200 bg-stone-50">
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Staff</th>
                                            <th className="text-right py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Monthly Limit</th>
                                            <th className="text-right py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Current Balance</th>
                                            <th className="text-right py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Available</th>
                                            <th className="text-right py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Last Updated</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {limits.map((limit) => (
                                            <tr key={limit.id} className="hover:bg-stone-50/50">
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-stone-900">
                                                        {limit.staff?.user?.first_name} {limit.staff?.user?.last_name}
                                                    </div>
                                                    <div className="text-xs text-stone-500">{limit.staff?.user?.email}</div>
                                                </td>
                                                <td className="py-3 px-4 text-right text-sm font-medium text-stone-900">{formatCurrency(limit.monthly_limit)}</td>
                                                <td className="py-3 px-4 text-right text-sm text-stone-600">{formatCurrency(limit.current_balance)}</td>
                                                <td className="py-3 px-4 text-right text-sm font-medium text-green-600">
                                                    {formatCurrency(limit.monthly_limit - limit.current_balance)}
                                                </td>
                                                <td className="py-3 px-4 text-right text-sm text-stone-500">
                                                    {new Date(limit.updated_at).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                        {limits.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-stone-500">No limits set</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
