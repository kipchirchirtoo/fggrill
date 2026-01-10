'use client';

import React, { useState, useEffect } from 'react';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { auditorReportsAPI, reportsService } from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw, CreditCard, AlertTriangle, Clock, Calendar, FileDown } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function EmployeeCreditReportPage() {
    const router = useRouter();
    const [reportData, setReportData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            await reportsService.downloadReport('employee_credit', {});
            toast.success("Report downloaded successfully");
        } catch (e) {
            console.error(e);
            toast.error("Failed to export report");
        } finally {
            setIsExporting(false);
        }
    };

    // This report is likely relevant for ALL branches (Auditor view), or we can filter if the API supports it.
    // The current API implementation doesn't strictly require branch_id query param for the report itself unless we add it.
    // We'll call it without params for now, as it fetches all unpaid bills.

    const fetchReport = async () => {
        setIsLoading(true);
        try {
            const res = await auditorReportsAPI.getEmployeeCredit();

            if (res.success) {
                setReportData(res.data);
            } else {
                toast.error(res.message || "Failed to fetch report");
            }
        } catch (e) {
            console.error(e);
            toast.error("Error loading credit report");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, []);

    const getOverdueSeverity = (days: number) => {
        if (days > 90) return 'bg-red-100 text-red-700 border-red-200';
        if (days > 60) return 'bg-orange-100 text-orange-700 border-orange-200';
        if (days > 30) return 'bg-amber-100 text-amber-700 border-amber-200';
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <BranchAwareDashboardLayout
                title="Employee Credit Report"
                subtitle="Staff credit balances and aging analysis"
            >
                <div className="space-y-6">
                    {/* Header Controls */}
                    <div className="flex flex-col sm:flex-row justify-between gap-4 bg-white p-4 rounded-xl border border-stone-100 shadow-sm">
                        <div className="flex items-center gap-2">
                            <button onClick={() => router.back()} className="p-2 hover:bg-stone-100 rounded-lg text-stone-500">
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <h2 className="text-sm font-bold text-stone-700">Credit Aging Details</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleExport}
                                disabled={isExporting || isLoading}
                                className="btn-primary"
                            >
                                <FileDown className={`h-4 w-4 mr-2 ${isExporting ? 'animate-bounce' : ''}`} />
                                {isExporting ? 'Generating...' : 'Export Branded PDF'}
                            </button>
                            <button onClick={fetchReport} disabled={isLoading} className="btn-secondary">
                                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                Refresh Data
                            </button>
                        </div>
                    </div>

                    {reportData ? (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                                <div className="stat-card border-l-4 border-stone-800">
                                    <p className="stat-label">Total Outstanding</p>
                                    <p className="stat-value text-stone-900">KES {reportData.summary?.total_outstanding?.toLocaleString() ?? 0}</p>
                                </div>
                                <div className="stat-card border-l-4 border-amber-400">
                                    <p className="stat-label">Overdue (30-60 Days)</p>
                                    <p className="stat-value text-stone-900">KES {reportData.summary?.overdue_30?.toLocaleString() ?? 0}</p>
                                </div>
                                <div className="stat-card border-l-4 border-orange-400">
                                    <p className="stat-label">Overdue (60-90 Days)</p>
                                    <p className="stat-value text-stone-900">KES {reportData.summary?.overdue_60?.toLocaleString() ?? 0}</p>
                                </div>
                                <div className="stat-card border-l-4 border-red-500">
                                    <p className="stat-label">Critical ({'>'}90 Days)</p>
                                    <p className="stat-value text-stone-900">KES {reportData.summary?.overdue_90?.toLocaleString() ?? 0}</p>
                                </div>
                            </div>

                            {/* Bills Table */}
                            <div className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-stone-50 text-stone-500 text-[11px] font-bold uppercase tracking-wider">
                                                <th className="p-4">Employee</th>
                                                <th className="p-4">Branch</th>
                                                <th className="p-4">Bill Date</th>
                                                <th className="p-4">Reference</th>
                                                <th className="p-4 text-right">Balance</th>
                                                <th className="p-4 text-center">Aging</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100">
                                            {reportData.bills?.map((bill: any) => (
                                                <tr key={bill.id} className="hover:bg-stone-50 transition-colors text-[13px] text-stone-700">
                                                    <td className="p-4 font-medium">
                                                        {bill.employee.first_name} {bill.employee.last_name}
                                                        <span className="block text-[10px] text-stone-400 font-normal">{bill.employee.employee_id}</span>
                                                    </td>
                                                    <td className="p-4">{bill.branch?.name || '-'}</td>
                                                    <td className="p-4">{new Date(bill.bill_date).toLocaleDateString()}</td>
                                                    <td className="p-4 font-mono text-stone-500">{bill.bill_number || '-'}</td>
                                                    <td className="p-4 text-right font-bold">KES {Number(bill.balance).toLocaleString()}</td>
                                                    <td className="p-4 text-center">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${getOverdueSeverity(bill.daysOverdue)}`}>
                                                            <Clock className="h-3 w-3" />
                                                            {bill.daysOverdue} Days
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!reportData.bills || reportData.bills.length === 0) && (
                                                <tr>
                                                    <td colSpan={6} className="p-8 text-center text-stone-400">
                                                        No outstanding employee bills found.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="p-12 text-center text-stone-400">
                            {isLoading ? "Loading credit report..." : "No data available."}
                        </div>
                    )}
                </div>
            </BranchAwareDashboardLayout>
        </ProtectedRoute>
    );
}
