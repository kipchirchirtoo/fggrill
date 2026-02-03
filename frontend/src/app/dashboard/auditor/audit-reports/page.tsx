'use client';

import React, { useState } from 'react';
import {
    FileCheck, FileText, Download, Printer,
    Share2, Calendar, Filter, RefreshCw,
    BarChart3, PieChart, Activity, ShieldAlert,
    ChevronRight, ArrowRight, UserCheck, Star,
    Building2, Search
} from 'lucide-react';
import { auditorReportsAPI, storeAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useBranch } from '@/lib/branch-context';
import { MultiBranchSelector } from '@/components/dashboard/MultiBranchSelector';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

export default function AuditReporting() {
    const { userBranches } = useBranch();
    const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const handleExport = async (type: string) => {
        setIsExporting(type);
        try {
            // If no branches selected, pass empty or 'all' logic
            const branchIds = selectedBranchIds.length > 0 ? selectedBranchIds.join(',') : undefined;

            // Build branch name string for the report title
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

            toast.success(`${type.split('_').join(' ').toUpperCase()} report started. Download will begin shortly.`);
        } catch (e) {
            console.error("Export failed:", e);
            toast.error(`Failed to generate ${type} report. Please try again.`);
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

    const filteredCategories = reportCategories.map(cat => ({
        ...cat,
        reports: cat.reports.filter(r =>
            r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.desc.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(cat => cat.reports.length > 0);

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-10 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
                    {/* Minimalist Header */}
                    <div className="page-header flex flex-col xl:flex-row xl:items-end justify-between gap-8">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-stone-100 text-[10px] font-black uppercase tracking-widest text-stone-500 mb-4 border border-stone-200/50">
                                <ShieldAlert className="h-3.5 w-3.5" />
                                Auditor Intel Engine
                            </div>
                            <h1 className="text-5xl font-black text-stone-900 tracking-tighter leading-[0.9]">
                                Analytical <br />
                                <span className="text-stone-300">Reports.</span>
                            </h1>
                            <p className="page-subtitle text-lg max-w-xl mt-6">
                                Strategic oversight generated directly from immutable ledger data.
                                Select your scope and date range to begin execution.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-2xl border border-stone-100 shadow-sm">
                            <div className="flex flex-col gap-1.5 p-3">
                                <span className="caption uppercase tracking-widest text-[9px] px-1">Scope</span>
                                <MultiBranchSelector
                                    selectedIds={selectedBranchIds}
                                    onChange={setSelectedBranchIds}
                                    className="min-w-[240px]"
                                />
                            </div>

                            <div className="h-12 w-[1px] bg-stone-100 hidden xl:block" />

                            <div className="flex flex-col gap-1.5 p-3">
                                <span className="caption uppercase tracking-widest text-[9px] px-1">Period</span>
                                <div className="flex items-center gap-2 bg-stone-50 border border-stone-200/50 rounded-xl px-4 h-10 transition-all focus-within:ring-2 focus-within:ring-stone-900/5">
                                    <Calendar className="h-4 w-4 text-stone-400" />
                                    <input
                                        type="date"
                                        value={dateRange.startDate}
                                        onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                        className="text-[11px] font-black text-stone-900 uppercase tracking-tighter outline-none bg-transparent w-28"
                                    />
                                    <span className="text-stone-300 font-bold">→</span>
                                    <input
                                        type="date"
                                        value={dateRange.endDate}
                                        onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                        className="text-[11px] font-black text-stone-900 uppercase tracking-tighter outline-none bg-transparent w-28"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Search & Statistics Bar */}
                    <div className="flex flex-col sm:flex-row items-center gap-6 justify-between border-y border-stone-100 py-10">
                        <div className="relative w-full max-w-md group">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 group-focus-within:text-stone-900 transition-colors" />
                            <input
                                type="text"
                                placeholder="Filter report catalog..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-stone-50 border border-stone-100 rounded-2xl py-3.5 pl-14 pr-6 text-sm font-bold placeholder:font-semibold placeholder:text-stone-300 focus:outline-none focus:ring-4 focus:ring-stone-900/5 focus:bg-white transition-all tracking-tight"
                            />
                        </div>
                        <div className="flex items-center gap-10">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Standard</span>
                                <span className="text-2xl font-black text-stone-900 tracking-tighter">09 <span className="text-[10px] font-black text-stone-300 uppercase ml-1">Reports</span></span>
                            </div>
                            <div className="h-10 w-[1px] bg-stone-100" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Formats</span>
                                <span className="text-2xl font-black text-stone-900 tracking-tighter">PDF <span className="text-[10px] font-black text-stone-300 uppercase ml-1">EXCEL</span></span>
                            </div>
                        </div>
                    </div>

                    {/* Report Selection Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                        {filteredCategories.map((cat, i) => (
                            <div key={i} className="space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-stone-900 text-white flex items-center justify-center shadow-lg shadow-stone-900/10">
                                        <cat.icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-stone-900 tracking-tight">{cat.title}</h3>
                                        <div className="h-1.5 w-8 bg-stone-200 rounded-full mt-1.5" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {cat.reports.map((report, ri) => (
                                        <button
                                            key={ri}
                                            disabled={!!isExporting}
                                            className="group w-full text-left bg-white border border-stone-100 rounded-[2rem] p-6 hover:border-stone-900 hover:shadow-2xl hover:shadow-stone-200/50 transition-all relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed border-b-4 border-b-stone-100 active:border-b-0 active:translate-y-1"
                                            onClick={() => handleExport(report.id)}
                                        >
                                            <div className="flex items-start justify-between mb-6">
                                                <div className="w-10 h-10 rounded-xl bg-stone-50 group-hover:bg-stone-900 group-hover:text-white transition-all flex items-center justify-center border border-stone-200/50 group-hover:border-stone-900">
                                                    <FileText className="h-4 w-4" />
                                                </div>
                                                <div className={cn(
                                                    "h-10 w-10 rounded-full flex items-center justify-center border border-stone-100 group-hover:bg-stone-900 group-hover:text-white transition-all group-hover:scale-110",
                                                    isExporting === report.id && "bg-stone-900 text-white border-stone-900"
                                                )}>
                                                    {isExporting === report.id ? (
                                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                                    )}
                                                </div>
                                            </div>
                                            <h4 className="text-[17px] font-black text-stone-900 leading-tight mb-2 tracking-tight group-hover:translate-x-1 transition-transform">{report.name}</h4>
                                            <p className="text-[12px] text-stone-400 font-bold leading-relaxed group-hover:translate-x-1 transition-transform delay-75">{report.desc}</p>
                                        </button>
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
