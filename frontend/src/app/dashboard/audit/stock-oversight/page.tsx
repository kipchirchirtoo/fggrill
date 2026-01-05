'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { auditorAPI, systemAPI } from '@/lib/api';
import { ArrowLeft, Package, Filter, RefreshCw, AlertTriangle, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function StockOversightPage() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [filters, setFilters] = useState({
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
            const response = await auditorAPI.getStockOversight(
                filters.branch_id ? Number(filters.branch_id) : undefined
            );

            if (response.success) {
                setData(response.data || []);
            } else {
                toast.error('Failed to fetch stock data');
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error loading stock data');
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
                                <h1 className="text-[22px] font-semibold text-stone-900">Stock Oversight</h1>
                                <p className="text-stone-500 text-sm">Monitor stock levels and variances</p>
                            </div>
                        </div>
                        <button onClick={fetchData} disabled={isLoading} className="btn-secondary self-start sm:self-auto">
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="card-elevated p-4">
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
                    ) : data.length > 0 ? (
                        <div className="card-elevated overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-stone-200 bg-stone-50">
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Item</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">SKU</th>
                                            <th className="text-right py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Quantity</th>
                                            <th className="text-right py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Unit Cost</th>
                                            <th className="text-right py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Total Value</th>
                                            <th className="text-center py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {data.map((item) => (
                                            <tr key={item.id} className="hover:bg-stone-50/50">
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-stone-900">{item.name}</div>
                                                    <div className="text-xs text-stone-500">{item.category}</div>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-stone-600">{item.sku}</td>
                                                <td className="py-3 px-4 text-right text-sm font-medium text-stone-900">{item.quantity} {item.unit}</td>
                                                <td className="py-3 px-4 text-right text-sm text-stone-600">{item.unit_cost}</td>
                                                <td className="py-3 px-4 text-right text-sm font-medium text-stone-900">
                                                    {(item.quantity * item.unit_cost).toLocaleString()}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {item.quantity <= (item.min_quantity || 0) ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                            <TrendingDown className="h-3 w-3" />
                                                            Low Stock
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            OK
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-stone-50 rounded-lg border border-dashed border-stone-200">
                            <Package className="h-10 w-10 text-stone-300 mx-auto mb-3" />
                            <p className="text-stone-500 font-medium">No stock items found</p>
                            <p className="text-stone-400 text-sm">Try adjusting the filters.</p>
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
