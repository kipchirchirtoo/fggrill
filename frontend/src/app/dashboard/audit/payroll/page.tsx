'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { auditorAPI } from '@/lib/api';
import { ArrowLeft, Users, Filter, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function PayrollAuditPage() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [filters, setFilters] = useState({
        month: new Date().toISOString().slice(0, 7), // YYYY-MM
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [year, month] = filters.month.split('-');
            const response = await auditorAPI.getPayrollAudit({
                month,
                year
            });

            if (response.success) {
                setData(response.data || []);
            } else {
                toast.error('Failed to fetch payroll audit data');
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error loading payroll data');
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

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
                                <h1 className="text-[22px] font-semibold text-stone-900">Payroll Audit</h1>
                                <p className="text-stone-500 text-sm">Review payroll anomalies and overtime flags</p>
                            </div>
                        </div>
                        <button onClick={fetchData} disabled={isLoading} className="btn-secondary self-start sm:self-auto">
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="card-elevated p-4">
                        <div className="w-full sm:w-auto">
                            <label className="text-xs font-medium text-stone-500 mb-1.5 block">Month</label>
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <input
                                    type="month"
                                    value={filters.month}
                                    onChange={(e) => setFilters(prev => ({ ...prev, month: e.target.value }))}
                                    className="input-field pl-9 w-full sm:w-48"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        </div>
                    ) : data.length > 0 ? (
                        <div className="space-y-4">
                            <div className="p-4 bg-orange-50 border border-orange-100 rounded-lg flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-semibold text-orange-900">Anomalies Detected</h3>
                                    <p className="text-sm text-orange-700 mt-1">
                                        The following employees have overtime exceeding 20% of their basic salary or other flagged irregularities.
                                    </p>
                                </div>
                            </div>

                            <div className="card-elevated overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-stone-200 bg-stone-50">
                                                <th className="text-left py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Employee</th>
                                                <th className="text-right py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Basic Salary</th>
                                                <th className="text-right py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Overtime</th>
                                                <th className="text-right py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Total Pay</th>
                                                <th className="text-center py-3 px-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Flag Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100">
                                            {data.map((record) => (
                                                <tr key={record.id} className="hover:bg-stone-50/50">
                                                    <td className="py-3 px-4">
                                                        <div className="font-medium text-stone-900">
                                                            {record.employee?.user?.first_name} {record.employee?.user?.last_name}
                                                        </div>
                                                        <div className="text-xs text-stone-500">{record.employee?.position}</div>
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-sm text-stone-600">{formatCurrency(record.basic_salary)}</td>
                                                    <td className="py-3 px-4 text-right text-sm font-medium text-orange-600">{formatCurrency(record.overtime)}</td>
                                                    <td className="py-3 px-4 text-right text-sm font-medium text-stone-900">{formatCurrency(record.net_pay)}</td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                                            High Overtime
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-stone-50 rounded-lg border border-dashed border-stone-200">
                            <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
                            <p className="text-stone-500 font-medium">No anomalies found</p>
                            <p className="text-stone-400 text-sm">Payroll looks clean for this period.</p>
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
