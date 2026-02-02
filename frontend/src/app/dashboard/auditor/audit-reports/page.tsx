'use client';

import React, { useState } from 'react';
import {
    FileCheck, FileText, Download, Printer,
    Share2, Calendar, Filter, RefreshCw,
    BarChart3, PieChart, Activity, ShieldAlert,
    ChevronRight, ArrowRight, UserCheck, Star
} from 'lucide-react';
import { auditorReportsAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BranchSelector, useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { toast } from 'sonner';

export default function AuditReporting() {
    const { activeBranchId, activeBranch } = useBranch();
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const handleExport = async (type: string) => {
        setIsExporting(type);
        try {
            await auditorReportsAPI.exportBrandedPdf(type, {
                branch_id: activeBranchId,
                start_date: dateRange.startDate,
                end_date: dateRange.endDate
            });
            toast.success(`${type.split('_').join(' ').toUpperCase()} exported successfully`);
        } catch (e) {
            console.error("Export failed:", e);
            toast.error(`Failed to export ${type} report`);
        } finally {
            setIsExporting(null);
        }
    };

    const reportCategories = [
        {
            title: 'Compliance & Risk',
            icon: ShieldAlert,
            reports: [
                { id: 'exception_summary', name: 'Audit Exception Summary', desc: 'Detailed log of all high-risk findings and overrides.' },
                { id: 'compliance_audit', name: 'Standard Operating Procedures Audit', desc: 'Operational compliance scores across departments.' },
                { id: 'void_analytics', name: 'Voided Transaction Analysis', desc: 'Detect suspicious patterns in order cancellations.' },
            ]
        },
        {
            title: 'Financial Integrity',
            icon: BarChart3,
            reports: [
                { id: 'revenue_reconciliation', name: 'Daily Revenue Reconciliation', desc: 'Cross-reference sales vs physical collection.' },
                { id: 'leakage_report', name: 'Calculated Leakage Analysis', desc: 'Gap analysis between stock usage and registered sales.' },
                { id: 'expenditure_audit', name: 'Expenditure & Payment Audit', desc: 'Complete log of verified vs unverified payments.' },
            ]
        },
        {
            title: 'Inventory & Stock',
            icon: FileCheck,
            reports: [
                { id: 'variance_report', name: 'Stock Variance Report', desc: 'Physical counts vs system inventory movements.' },
                { id: 'consumption_audit', name: 'Consumption Analytics', desc: 'Yield and wastage monitoring for F&B.' },
                { id: 'grn_audit', name: 'Goods Received Note Audit', desc: 'Verification of supplier deliveries vs orders.' },
            ]
        }
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-10 pb-20 max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-stone-100 pb-10">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <FileText className="h-6 w-6 text-stone-900" />
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-stone-400">Statement Generation</span>
                            </div>
                            <h1 className="text-[40px] font-black text-stone-900 tracking-tight leading-none">Audit Comprehensive Reporting</h1>
                            <p className="text-stone-500 text-lg mt-4 font-medium max-w-2xl">Generate high-fidelity branded PDF reports for corporate compliance, stakeholder review, and operational improvement.</p>
                        </div>
                        <div className="flex flex-col gap-4">
                            <BranchSelector />
                            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-4 py-2.5 shadow-sm">
                                <Calendar className="h-4 w-4 text-stone-400" />
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="text-sm font-bold text-stone-900 outline-none bg-transparent"
                                />
                                <span className="text-stone-300">→</span>
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="text-sm font-bold text-stone-900 outline-none bg-transparent"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Report Selection Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                        {reportCategories.map((cat, i) => (
                            <div key={i} className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100">
                                        <cat.icon className="h-5 w-5 text-stone-900" />
                                    </div>
                                    <h3 className="text-[15px] font-black uppercase tracking-widest text-stone-900">{cat.title}</h3>
                                </div>
                                <div className="space-y-4">
                                    {cat.reports.map((report, ri) => (
                                        <div
                                            key={ri}
                                            className="group bg-white border border-stone-200 rounded-2xl p-5 hover:border-stone-900 hover:shadow-2xl hover:shadow-stone-200 transition-all cursor-pointer relative overflow-hidden"
                                            onClick={() => handleExport(report.id)}
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="w-10 h-10 rounded-full bg-stone-50 flex items-center justify-center group-hover:bg-stone-900 group-hover:text-white transition-colors">
                                                    <FileText className="h-4 w-4" />
                                                </div>
                                                <button
                                                    className={`p-2 rounded-lg border border-stone-100 group-hover:border-stone-900 transition-colors ${isExporting === report.id ? 'bg-stone-900 text-white' : ''}`}
                                                >
                                                    {isExporting === report.id ? (
                                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Download className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </div>
                                            <h4 className="text-[15px] font-black text-stone-900 leading-tight mb-2">{report.name}</h4>
                                            <p className="text-[12px] text-stone-400 font-medium leading-relaxed">{report.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
