'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { auditAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { BranchSelector, useBranch } from '@/lib/branch-context';
import {
    Package, Filter, Download,
    ArrowLeft, Check, X, RefreshCw, Eye,
    Building2, ChevronRight,
    Search, Calendar, Clock, CheckCircle2, XCircle, Truck, FileDown,
    Loader2, Info
} from 'lucide-react';
import { toast } from 'sonner';

export default function OrdersAuditPage() {
    const { activeBranchId, setActiveBranch } = useBranch();
    const [auditData, setAuditData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.verifyBranchOrders({
                branch_id: (activeBranchId === 0 || activeBranchId === null) ? undefined : activeBranchId,
                start_date: dateRange.startDate,
                end_date: dateRange.endDate
            });

            if (res.success) {
                setAuditData(res.data);
            } else {
                toast.error(res.message || 'Failed to fetch branch orders audit');
            }
        } catch (e) {
            console.error(e);
            toast.error("Network error while syncing orders");
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId, dateRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredRequests = (auditData?.requests || []).filter((req: any) =>
        req.request_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-8 pb-12">
                    {/* Header */}
                    <div className="page-header flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center text-white shadow-lg">
                                <Package className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="page-title text-stone-900">
                                    {activeBranchId !== 0 ? `Branch Requisition History` : `System Requisitions`}
                                </h1>
                                <p className="page-subtitle">Verify and audit stock movement requests across operational nodes</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-stone-100/50 border border-stone-200 rounded-xl px-3 h-[42px] shadow-sm">
                                <Calendar className="h-3.5 w-3.5 text-stone-400" />
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="text-[12px] font-bold text-stone-700 bg-transparent outline-none w-28"
                                />
                                <span className="text-stone-300 mx-1">→</span>
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="text-[12px] font-bold text-stone-700 bg-transparent outline-none w-28"
                                />
                            </div>
                            <BranchSelector />
                            <button onClick={fetchData} className="btn-primary h-[42px] shadow-lg shadow-stone-900/10">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="ml-2">Sync</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="stat-card">
                            <div className="stat-icon text-amber-500 bg-amber-50">
                                <Clock className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{auditData?.summary?.overview?.pending || 0}</p>
                            <p className="stat-label">Pending Approval</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon text-blue-500 bg-blue-50">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{auditData?.summary?.overview?.approved || 0}</p>
                            <p className="stat-label">Verified Orders</p>
                        </div>
                        <div className="stat-card bg-stone-900 border-none shadow-xl shadow-stone-900/10">
                            <div className="stat-icon text-white bg-white/10 border-none">
                                <Truck className="h-5 w-5" />
                            </div>
                            <p className="stat-value text-white">{auditData?.summary?.overview?.dispatched || 0}</p>
                            <p className="stat-label text-stone-400">Total Dispatched</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon text-rose-500 bg-rose-50">
                                <XCircle className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{auditData?.summary?.overview?.rejected || 0}</p>
                            <p className="stat-label">Stock Rejections</p>
                        </div>
                    </div>

                    {activeBranchId === 0 ? (
                        <div className="table-container shadow-sm border border-stone-100">
                            <div className="section-header p-5 border-b border-stone-100 bg-stone-50/30">
                                <div className="flex items-center justify-between w-full">
                                    <div>
                                        <h2 className="section-title">Requisitions by Branch</h2>
                                        <p className="section-subtitle">Aggregate stock movement and fulfillment distribution</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Audit Mode</p>
                                        <span className="badge-info">System Consolidated</span>
                                    </div>
                                </div>
                            </div>
                            <div className="table-responsive">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="table-header">
                                            <th className="table-header-cell">Branch Node</th>
                                            <th className="table-header-cell text-center">Pending</th>
                                            <th className="table-header-cell text-center">Approved</th>
                                            <th className="table-header-cell text-center">Dispatched</th>
                                            <th className="table-header-cell text-center">Rejected</th>
                                            <th className="table-header-cell"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50">
                                        {(auditData?.summary?.branch_summaries || []).map((branch: any) => (
                                            <tr
                                                key={branch.branch_id}
                                                onClick={() => setActiveBranch(branch.branch_id)}
                                                className="table-row group cursor-pointer"
                                            >
                                                <td className="table-cell">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-center text-stone-400 group-hover:bg-stone-900 group-hover:text-white group-hover:border-stone-900 transition-all">
                                                            <Building2 className="h-5 w-5" />
                                                        </div>
                                                        <span className="font-black text-stone-900 tracking-tight">{branch.branch_name}</span>
                                                    </div>
                                                </td>
                                                <td className="table-cell text-center">
                                                    <span className={`font-black ${branch.pending > 0 ? 'text-amber-500' : 'text-stone-300'}`}>{branch.pending}</span>
                                                </td>
                                                <td className="table-cell text-center font-black text-blue-600">
                                                    {branch.approved}
                                                </td>
                                                <td className="table-cell text-center font-black text-stone-900">
                                                    {branch.dispatched}
                                                </td>
                                                <td className="table-cell text-center font-black text-rose-400">
                                                    {branch.rejected}
                                                </td>
                                                <td className="table-cell text-right">
                                                    <div className="flex justify-end">
                                                        <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                                            <ChevronRight className="h-4 w-4 text-stone-900" />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {(!auditData?.summary?.branch_summaries || auditData.summary.branch_summaries.length === 0) && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-20 text-center">
                                                    {isLoading ? (
                                                        <div className="flex flex-col items-center gap-4">
                                                            <Loader2 className="h-10 w-10 animate-spin text-stone-200" />
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Streaming ledger data...</p>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Info className="h-10 w-10 text-stone-100" />
                                                            <p className="text-[11px] font-black uppercase tracking-widest text-stone-300">Zero requisitions found</p>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        /* DETAILED REQUISITIONS LIST */
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="flex items-center gap-3 bg-white border border-stone-100 rounded-xl px-4 h-12 w-full md:w-96 shadow-sm group focus-within:ring-2 focus-within:ring-stone-900/5 transition-all">
                                    <Search className="h-4 w-4 text-stone-300 group-focus-within:text-stone-900 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Search requisition #..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="text-sm font-bold text-stone-900 outline-none w-full placeholder:text-stone-300 placeholder:font-semibold"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="btn-secondary h-12 px-6">
                                        <FileDown className="h-4 w-4 mr-2" /> PDF Archive
                                    </button>
                                </div>
                            </div>

                            <div className="table-container shadow-sm border border-stone-100">
                                <div className="table-responsive">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="table-header">
                                                <th className="table-header-cell">Protocol Identifier</th>
                                                <th className="table-header-cell">Department Node</th>
                                                <th className="table-header-cell">Execution Date</th>
                                                <th className="table-header-cell text-center">Unit Count</th>
                                                <th className="table-header-cell text-center">Node Status</th>
                                                <th className="table-header-cell"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {filteredRequests.map((req: any) => (
                                                <tr key={req.id} className="table-row group">
                                                    <td className="table-cell">
                                                        <span className="font-mono font-black text-stone-900 tracking-tighter">
                                                            {req.request_number || `#${req.id?.substr(0, 8)}`}
                                                        </span>
                                                    </td>
                                                    <td className="table-cell">
                                                        <span className="badge-neutral bg-stone-100 text-stone-600 border-none uppercase text-[10px] py-1">
                                                            {req.department || 'General'}
                                                        </span>
                                                    </td>
                                                    <td className="table-cell">
                                                        <div className="flex items-center gap-2 text-stone-600 font-bold">
                                                            <Calendar className="w-3.5 h-3.5 text-stone-300" />
                                                            {new Date(req.created_at).toLocaleDateString()}
                                                        </div>
                                                    </td>
                                                    <td className="table-cell text-center">
                                                        <span className="font-black text-stone-900">{req.items?.length || 0}</span>
                                                    </td>
                                                    <td className="table-cell text-center">
                                                        <span className={
                                                            req.status === 'pending' || req.status === 'PENDING_AUDIT' ? 'badge-warning' :
                                                                req.status === 'approved' || req.status === 'APPROVED' ? 'badge-info' :
                                                                    req.status === 'dispatched' || req.status === 'SHIPPED' ? 'badge-success' :
                                                                        'badge-danger'
                                                        }>
                                                            {req.status?.replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="table-cell text-right">
                                                        <button className="w-8 h-8 rounded-lg hover:bg-stone-900 hover:text-white transition-all flex items-center justify-center text-stone-300">
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredRequests.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-20 text-center">
                                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                                            <Package className="h-10 w-10 mb-2" />
                                                            <p className="text-[11px] font-black uppercase tracking-widest">
                                                                {isLoading ? "Synchronizing..." : "Zero matching records"}
                                                            </p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
