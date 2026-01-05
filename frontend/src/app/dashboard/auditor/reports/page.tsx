'use client';

import React from 'react';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { FileText, Download, ArrowLeft, Calendar, BarChart3, PieChart } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { reportsService } from '@/lib/api';

export default function AuditorReportsPage() {
    const router = useRouter();
    const { activeBranchId } = useBranch();
    const [generatingReport, setGeneratingReport] = React.useState<string | null>(null);

    const handleGenerate = async (reportType: string, format: 'pdf' | 'excel' = 'pdf') => {
        setGeneratingReport(reportType);
        try {
            const filters = {
                branch_id: activeBranchId === 0 ? undefined : activeBranchId,
                // Add more filters as needed
            };

            await reportsService.downloadReport(reportType, filters, format);
        } catch (error) {
            console.error('Failed to generate report:', error);
        } finally {
            setGeneratingReport(null);
        }
    };

    const ReportCard = ({ title, description, icon: Icon, reportType }: any) => (
        <div className="card-elevated p-5 flex flex-col h-full hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 bg-stone-100 rounded-lg group-hover:bg-stone-200 transition-colors">
                    <Icon className="h-5 w-5 text-stone-600" />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleGenerate(reportType, 'excel')}
                        disabled={generatingReport !== null}
                        className="text-stone-400 hover:text-stone-900 transition-colors"
                        title="Download Excel"
                    >
                        <Download className="h-4 w-4" />
                    </button>
                </div>
            </div>
            <h3 className="font-semibold text-stone-900 mb-1.5">{title}</h3>
            <p className="text-xs text-stone-500 mb-6 flex-1">{description}</p>
            <button
                onClick={() => handleGenerate(reportType, 'pdf')}
                disabled={generatingReport !== null}
                className="btn-secondary w-full text-xs"
            >
                {generatingReport === reportType ? 'Generating...' : 'Generate PDF'}
            </button>
        </div>
    );

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <BranchAwareDashboardLayout
                title="Audit Intelligence Reports"
                subtitle="Data-driven compliance analytics"
            >
                <div className="space-y-6">
                    <div className="flex justify-end gap-3">
                        <div className="bg-stone-100 p-1 rounded-lg flex gap-1">
                            <button className="px-3 py-1 text-xs font-medium rounded-md bg-white shadow-sm">Daily</button>
                            <button className="px-3 py-1 text-xs font-medium rounded-md hover:bg-stone-50">Weekly</button>
                            <button className="px-3 py-1 text-xs font-medium rounded-md hover:bg-stone-50">Monthly</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        <ReportCard
                            title="Financial Variance"
                            description="Deep dive into revenue leakage and deposit variances."
                            icon={BarChart3}
                            reportType="financial_variance"
                        />
                        <ReportCard
                            title="Inventory Gaps"
                            description="Theoretical vs actual usage analysis by branch."
                            icon={PieChart}
                            reportType="inventory_discrepancy"
                        />
                        <ReportCard
                            title="Procurement Audit"
                            description="Supplier pricing trends and volume verification."
                            icon={FileText}
                            reportType="procurement_analysis"
                        />
                        <ReportCard
                            title="Exception Activity"
                            description="Full history of voided orders and risky transactions."
                            icon={FileText}
                            reportType="exception_logs"
                        />
                    </div>

                    <div className="card-elevated p-6 bg-stone-900 text-white">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div>
                                <h2 className="text-lg font-bold mb-1">Custom Analysis Data</h2>
                                <p className="text-stone-400 text-sm max-w-lg">
                                    Configure parameters to generate a raw CSV export of audit data. Selected Branch ID: {activeBranchId === 0 ? 'All' : (activeBranchId || 'None')}
                                </p>
                            </div>
                            <button className="px-4 py-2 bg-white text-stone-900 rounded-lg text-sm font-medium hover:bg-stone-100 transition-colors">
                                Configure Export
                            </button>
                        </div>
                    </div>
                </div>
            </BranchAwareDashboardLayout>
        </ProtectedRoute>
    );
}
