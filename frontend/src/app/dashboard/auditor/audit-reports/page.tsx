'use client';

import React, { useState } from 'react';
import { FileText, Download, Calendar, RefreshCw } from 'lucide-react';
import { auditorReportsAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useBranch } from '@/lib/branch-context';
import { MultiBranchSelector } from '@/components/dashboard/MultiBranchSelector';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { toast } from 'sonner';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';

export default function AuditReporting() {
    const { userBranches } = useBranch();
    const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const handleExport = async (type: string) => {
        setIsExporting(type);
        try {
            const branchIds = selectedBranchIds.length > 0 ? selectedBranchIds.join(',') : undefined;

            let branchName = "All Branches";
            if (selectedBranchIds.length === 1) {
                branchName = userBranches.find(b => b.id === selectedBranchIds[0])?.name || "Selected Branch";
            } else if (selectedBranchIds.length > 1) {
                branchName = `${selectedBranchIds.length} Selected Branches`;
            }

            await auditorReportsAPI.exportBrandedPdf(type, {
                branch_ids: branchIds,
                start_date: dateRange.startDate,
                end_date: dateRange.endDate,
                branch_name: branchName
            });

            toast.success('Report generated successfully');
        } catch (e) {
            console.error("Export failed:", e);
            toast.error('Failed to generate report');
        } finally {
            setIsExporting(null);
        }
    };

    const reports = [
        { id: 'exception_summary', name: 'Audit Exception Summary', category: 'Compliance' },
        { id: 'compliance_audit', name: 'SOP Compliance Audit', category: 'Compliance' },
        { id: 'void_analytics', name: 'Voided Transaction Analysis', category: 'Compliance' },
        { id: 'revenue_reconciliation', name: 'Revenue Reconciliation', category: 'Financial' },
        { id: 'leakage_report', name: 'Leakage Analysis', category: 'Financial' },
        { id: 'expenditure_audit', name: 'Expenditure Audit', category: 'Financial' },
        { id: 'variance_report', name: 'Stock Variance Report', category: 'Inventory' },
        { id: 'consumption_audit', name: 'Consumption Analytics', category: 'Inventory' },
        { id: 'grn_audit', name: 'GRN Audit', category: 'Inventory' },
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Audit Reports</h1>
                            <p className="text-gray-500">Generate comprehensive audit reports</p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" leftIcon={<RefreshCw />}>
                                Refresh
                            </IOSButton>
                        </div>
                    </div>

                    {/* Filters */}
                    <IOSCard className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Branch Selection</label>
                                <MultiBranchSelector
                                    selectedIds={selectedBranchIds}
                                    onChange={setSelectedBranchIds}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Date Range</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        value={dateRange.startDate}
                                        onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                        className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm"
                                    />
                                    <span className="text-gray-400">→</span>
                                    <input
                                        type="date"
                                        value={dateRange.endDate}
                                        onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                        className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </IOSCard>

                    {/* Reports Grid */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {reports.map((report) => (
                            <IOSCard key={report.id} className="p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center">
                                            <FileText className="h-5 w-5 text-stone-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">{report.name}</p>
                                            <p className="text-xs text-gray-400">{report.category}</p>
                                        </div>
                                    </div>
                                </div>
                                <IOSButton
                                    onClick={() => handleExport(report.id)}
                                    disabled={!!isExporting}
                                    className="w-full mt-3"
                                    leftIcon={isExporting === report.id ? <RefreshCw className="animate-spin" /> : <Download />}
                                >
                                    {isExporting === report.id ? 'Generating...' : 'Generate PDF'}
                                </IOSButton>
                            </IOSCard>
                        ))}
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
