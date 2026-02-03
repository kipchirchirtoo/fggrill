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
    Search, Calendar, Clock, CheckCircle2, XCircle, Truck, FileDown
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
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Package className="h-4 w-4 text-stone-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Order Monitoring</span>
                            </div>
                            <h1 className="text-2xl font-black text-stone-900 tracking-tight leading-none">
                                {activeBranchId !== 0 ? `Branch Requisition History` : `System Requisitions`}
                            </h1>
                            <p className="text-stone-500 text-sm mt-2 font-medium italic">Audit and verify stock movement requests from all operational nodes</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2 shadow-sm h-10">
                                <Calendar className="h-3.5 w-3.5 text-stone-400" />
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="text-[12px] font-black text-stone-700 outline-none w-28"
                                />
                                <span className="text-stone-200 mx-1">→</span>
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="text-[12px] font-black text-stone-700 outline-none w-28"
                                />
                            </div>
                            <BranchSelector />
                            <button onClick={fetchData} className="p-2.5 bg-stone-900 rounded-xl hover:bg-stone-800 transition-colors shadow-sm">
                                <RefreshCw className={`h-4 w-4 text-white ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="card-elevated p-6 border border-stone-100 bg-white shadow-xl shadow-stone-200/20">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                                    <Clock className="h-4 w-4" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Pending Approval</p>
                            </div>
                            <h3 className="text-3xl font-black text-stone-900 tracking-tighter">{auditData?.summary?.overview?.pending || 0}</h3>
                        </div>
                        <div className="card-elevated p-6 border border-stone-100 bg-white shadow-xl shadow-stone-200/20">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                                    <CheckCircle2 className="h-4 w-4" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Approved</p>
                            </div>
                            <h3 className="text-3xl font-black text-stone-900 tracking-tighter">{auditData?.summary?.overview?.approved || 0}</h3>
                        </div>
                        <div className="card-elevated p-6 border border-stone-100 bg-white shadow-xl shadow-stone-200/20">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                                    <Truck className="h-4 w-4" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Dispatched</p>
                            </div>
                            <h3 className="text-3xl font-black text-stone-900 tracking-tighter">{auditData?.summary?.overview?.dispatched || 0}</h3>
                        </div>
                        <div className="card-elevated p-6 border border-stone-100 bg-white shadow-xl shadow-stone-200/20">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
                                    <XCircle className="h-4 w-4" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Rejected</p>
                            </div>
                            <h3 className="text-3xl font-black text-stone-900 tracking-tighter">{auditData?.summary?.overview?.rejected || 0}</h3>
                        </div>
                    </div>

                    {activeBranchId === 0 ? (
                        /* BRANCH SUMMARIES VIEW */
                        <div className="card-elevated border border-stone-100 bg-white overflow-hidden shadow-2xl shadow-stone-200/30">
                            <div className="px-6 py-5 border-b border-stone-100 bg-stone-50/30 flex items-center justify-between">
                                <h3 className="text-[14px] font-black text-stone-900 uppercase tracking-tight flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-stone-400" />
                                    Requisitions by Branch
                                </h3>
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Global Aggregate</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-stone-50/30 border-b border-stone-100 text-[10px] font-black text-stone-400 uppercase tracking-widest">
                                            <th className="px-6 py-4">Branch</th>
                                            <th className="px-6 py-4 text-center">Pending</th>
                                            <th className="px-6 py-4 text-center">Approved</th>
                                            <th className="px-6 py-4 text-center">Dispatched</th>
                                            <th className="px-6 py-4 text-center">Rejected</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50">
                                        {(auditData?.summary?.branch_summaries || []).map((branch: any) => (
                                            <tr
                                                key={branch.branch_id}
                                                onClick={() => setActiveBranch(branch.branch_id)}
                                                className="hover:bg-stone-50 transition-colors group cursor-pointer"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-xl bg-stone-100 text-stone-600 group-hover:bg-stone-900 group-hover:text-white transition-all">
                                                            <Building2 className="h-4 w-4" />
                                                        </div>
                                                        <span className="text-[14px] font-black text-stone-900">{branch.branch_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`text-[13px] font-bold ${branch.pending > 0 ? 'text-amber-600' : 'text-stone-400'}`}>{branch.pending}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-[13px] font-bold text-blue-600">{branch.approved}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-[13px] font-bold text-emerald-600">{branch.dispatched}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-[13px] font-bold text-rose-400">{branch.rejected}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-900 transition-all group-hover:translate-x-1" />
                                                </td>
                                            </tr>
                                        ))}
                                        {(!auditData?.summary?.branch_summaries || auditData.summary.branch_summaries.length === 0) && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-20 text-center">
                                                    {isLoading ? (
                                                        <div className="flex flex-col items-center gap-2 opacity-50">
                                                            <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
                                                            <span className="text-[11px] font-black uppercase tracking-widest text-stone-400">Syncing branch data...</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px] font-black uppercase tracking-widest text-stone-300">No requisitions recorded</span>
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
                                <div className="relative w-full md:w-96">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-300" />
                                    <input
                                        type="text"
                                        placeholder="Search by request number..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200/60 rounded-2xl text-[13px] font-bold text-stone-700 outline-none focus:border-stone-400 focus:bg-white transition-all shadow-sm"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-stone-800 shadow-xl shadow-stone-900/10 transition-all">
                                        <FileDown className="h-4 w-4" /> Export Report
                                    </button>
                                </div>
                            </div>

                            <div className="card-elevated border border-stone-100 bg-white overflow-hidden shadow-2xl shadow-stone-200/30">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-stone-50/30 border-b border-stone-100 text-[10px] font-black text-stone-400 uppercase tracking-widest">
                                                <th className="px-6 py-4">Request #</th>
                                                <th className="px-6 py-4">Department</th>
                                                <th className="px-6 py-4">Date Requested</th>
                                                <th className="px-6 py-4 text-center">Items</th>
                                                <th className="px-6 py-4 text-center">Status</th>
                                                <th className="px-6 py-4"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {filteredRequests.map((req: any) => (
                                                <tr key={req.id} className="hover:bg-stone-50/50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <span className="text-[13px] font-black text-stone-900 font-mono tracking-tighter">
                                                            {req.request_number || `#${req.id?.substr(0, 8)}`}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-[11px] font-extrabold text-stone-400 uppercase tracking-widest px-2 py-0.5 bg-stone-100 rounded">{req.department || 'General'}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-[13px] font-bold text-stone-700">{new Date(req.created_at).toLocaleDateString()}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-[13px] font-black text-stone-900">{req.items?.length || 0}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${req.status === 'pending' || req.status === 'PENDING_AUDIT' ? 'bg-amber-100 text-amber-700' :
                                                            req.status === 'approved' || req.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                                                                req.status === 'dispatched' || req.status === 'SHIPPED' ? 'bg-emerald-100 text-emerald-700' :
                                                                    'bg-rose-100 text-rose-700'
                                                            }`}>
                                                            {req.status?.replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button className="p-2 hover:bg-stone-900 hover:text-white rounded-xl transition-all text-stone-300 opacity-0 group-hover:opacity-100">
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredRequests.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-20 text-center text-stone-300 font-bold uppercase tracking-widest text-[11px]">
                                                        {isLoading ? "Fetching data..." : "No matching requisitions found"}
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
