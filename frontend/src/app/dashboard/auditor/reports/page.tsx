'use client';

import React from 'react';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { FileText, Download, ArrowLeft, Calendar, BarChart3, PieChart, RefreshCw, CreditCard } from 'lucide-react';
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

    const handleNavigate = (path: string) => {
        router.push(path);
    };

    const ReportCard = ({ title, description, icon: Icon, path, isDownloadable, reportType }: any) => (
        <div className="card-elevated p-6 flex flex-col h-full hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
            <div className="flex items-start justify-between mb-5">
                <div className="p-3 bg-stone-100 rounded-xl group-hover:bg-stone-900 group-hover:text-white transition-all duration-300 shadow-sm border border-stone-200/50">
                    <Icon className="h-5 w-5" />
                </div>
                {isDownloadable && (
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button
                            onClick={() => handleGenerate(reportType, 'excel')}
                            disabled={generatingReport !== null}
                            className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-900 transition-colors"
                            title="Download Excel"
                        >
                            <Download className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
            <h3 className="text-[15px] font-bold text-stone-900 mb-2 leading-tight">{title}</h3>
            <p className="text-[12px] text-stone-500 mb-8 flex-1 leading-relaxed">{description}</p>

            {path ? (
                <button
                    onClick={() => handleNavigate(path)}
                    className="py-2 px-4 rounded-xl text-[12px] font-bold transition-all duration-300 flex items-center justify-center gap-2 bg-stone-900 text-white hover:bg-black shadow-md hover:shadow-lg"
                >
                    <FileText className="h-3.5 w-3.5" />
                    View Report
                </button>
            ) : (
                <button
                    onClick={() => handleGenerate(reportType, 'pdf')}
                    disabled={generatingReport !== null}
                    className={`py-2 px-4 rounded-xl text-[12px] font-bold transition-all duration-300 flex items-center justify-center gap-2 ${generatingReport === reportType
                        ? 'bg-stone-100 text-stone-400'
                        : 'bg-stone-900 text-white hover:bg-black shadow-md hover:shadow-lg'
                        }`}
                >
                    {generatingReport === reportType ? (
                        <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <FileText className="h-3.5 w-3.5" />
                            Generate PDF
                        </>
                    )}
                </button>
            )}
        </div>
    );

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <BranchAwareDashboardLayout
                title="Audit Intelligence Reports"
                subtitle="Data-driven compliance analytics"
            >
                <div className="space-y-6">
                    <div className="hidden flex justify-between items-center bg-white p-2 rounded-xl border border-stone-100 shadow-sm w-fit gap-6">
                        {/* Period selector removed for now or can be wired to context */}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        <ReportCard
                            title="Branch Performance"
                            description="Revenue, orders, and payment tracking."
                            icon={BarChart3}
                            path="/dashboard/auditor/reports/performance"
                        />
                        <ReportCard
                            title="Stock Usage & Gaps"
                            description="Theoretical vs actual usage analysis."
                            icon={PieChart}
                            path="/dashboard/auditor/stock"
                        />
                        <ReportCard
                            title="Procurement Audit"
                            description="Supplier pricing trends and volume verification."
                            icon={FileText}
                            reportType="procurement_analysis"
                            isDownloadable={true}
                        />
                        <ReportCard
                            title="Employee Credit"
                            description="Staff credit limits and outstanding balances."
                            icon={CreditCard}
                            path="/dashboard/auditor/reports/employee-credit"
                        />
                        <ReportCard
                            title="Conference & Events"
                            description="Revenue, PAX, and venue utilization metrics."
                            icon={Calendar}
                            path="/dashboard/auditor/reports/conference"
                            reportType="conference_summary"
                            isDownloadable={true}
                        />
                    </div>

                    <div className="card-elevated p-8 bg-stone-900 text-white relative overflow-hidden group">

                        <div className="absolute top-0 right-0 w-64 h-64 bg-stone-800 rounded-full blur-3xl -mr-32 -mt-32 opacity-20 group-hover:opacity-40 transition-opacity duration-700" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-stone-800 rounded-full blur-2xl -ml-16 -mb-16 opacity-10" />

                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="text-center md:text-left">
                                <h2 className="text-xl font-bold mb-2 tracking-tight">Custom Data Analytics</h2>
                                <p className="text-stone-400 text-sm max-w-lg leading-relaxed">
                                    Need something specific? Generate a raw transactional export with custom field mapping.
                                    <span className="block mt-2 text-[11px] font-bold text-stone-500 uppercase tracking-widest">
                                        Current Scope: {activeBranchId === 0 ? 'Global Estate' : `Branch ID ${activeBranchId}`}
                                    </span>
                                </p>
                            </div>
                            <button className="px-8 py-3 bg-white text-stone-900 rounded-xl text-sm font-bold hover:bg-stone-50 transition-all shadow-xl hover:shadow-2xl active:scale-95">
                                Configure Custom Export
                            </button>
                        </div>
                    </div>
                </div>
            </BranchAwareDashboardLayout>
        </ProtectedRoute>
    );
}
