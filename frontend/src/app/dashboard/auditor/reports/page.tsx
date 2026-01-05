'use client';

import React from 'react';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { FileText, Download, ArrowLeft, Calendar, BarChart3, PieChart } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AuditorReportsPage() {
    const router = useRouter();
    const { activeBranchId } = useBranch();

    const ReportCard = ({ title, description, icon: Icon }: any) => (
        <div className="card-elevated p-5 flex flex-col h-full hover:shadow-md transition-shadow cursor-pointer group">
            <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 bg-stone-100 rounded-lg group-hover:bg-stone-200 transition-colors">
                    <Icon className="h-5 w-5 text-stone-600" />
                </div>
                <button className="text-stone-400 hover:text-stone-900 transition-colors">
                    <Download className="h-4 w-4" />
                </button>
            </div>
            <h3 className="font-semibold text-stone-900 mb-1.5">{title}</h3>
            <p className="text-xs text-stone-500 mb-6 flex-1">{description}</p>
            <button className="btn-secondary w-full text-xs">Generate Report</button>
        </div>
    );

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <BranchAwareDashboardLayout
                title="Audit Reports"
                subtitle="Analytics & Intelligence"
            >
                <div className="space-y-6">
                    <div className="flex justify-end">
                        <button className="btn-secondary">
                            <Calendar className="h-4 w-4" />
                            <span>This Month</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        <ReportCard
                            title="Financial Variance"
                            description="Revenue vs deposits analysis."
                            icon={BarChart3}
                        />
                        <ReportCard
                            title="Inventory Discrepancy"
                            description="Theoretical vs actual usage gaps."
                            icon={PieChart}
                        />
                        <ReportCard
                            title="Procurement Analysis"
                            description="Supplier trends & volume verification."
                            icon={FileText}
                        />
                        <ReportCard
                            title="Exception Logs"
                            description="History of voided orders & flags."
                            icon={FileText}
                        />
                    </div>

                    <div className="card-elevated p-6 bg-stone-900 text-white">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div>
                                <h2 className="text-lg font-bold mb-1">Custom Analysis Data</h2>
                                <p className="text-stone-400 text-sm max-w-lg">
                                    Configure parameters to generate a raw CSV export of audit data. Selected Branch ID: {activeBranchId || 'All'}
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
