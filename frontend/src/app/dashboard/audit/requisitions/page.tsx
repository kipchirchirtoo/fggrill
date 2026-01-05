'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { auditorAPI, stockRequestAPI, systemAPI } from '@/lib/api';
import { ArrowLeft, ClipboardList, Filter, RefreshCw, CheckCircle, XCircle, BarChart3, Clock } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function RequisitionsPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'approvals' | 'analysis'>('approvals');
    const [isLoading, setIsLoading] = useState(true);
    const [requests, setRequests] = useState<any[]>([]);
    const [analysisData, setAnalysisData] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [filters, setFilters] = useState({
        branch_id: '',
        status: 'pending',
        start_date: '',
        end_date: ''
    });

    const fetchBranches = useCallback(async () => {
        try {
            const response = await systemAPI.getBranches();
            if (response.success) {
                setBranches(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'approvals') {
                const response = await stockRequestAPI.getRequests({
                    branch_id: filters.branch_id ? Number(filters.branch_id) : undefined,
                    status: filters.status === 'all' ? undefined : filters.status,
                    start_date: filters.start_date || undefined,
                    end_date: filters.end_date || undefined
                });
                if (response.success) {
                    setRequests(response.data || []);
                }
            } else {
                const response = await auditorAPI.getRequisitionAnalysis({
                    branch_id: filters.branch_id ? Number(filters.branch_id) : undefined,
                    start_date: filters.start_date || undefined,
                    end_date: filters.end_date || undefined
                });
                if (response.success) {
                    setAnalysisData(response.data || []);
                }
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error loading data');
        } finally {
            setIsLoading(false);
        }
    }, [activeTab, filters]);

    useEffect(() => {
        fetchBranches();
    }, [fetchBranches]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleApprove = async (id: string, items: any[]) => {
        try {
            // For MVP, auto-approve all requested quantities. In real app, show modal to edit quantities.
            const approvalData = {
                items: items.map(item => ({
                    id: item.id,
                    quantity_approved: item.quantity_requested
                })),
                notes: 'Approved by Auditor'
            };

            const response = await stockRequestAPI.approveRequest(id, approvalData);
            if (response.success) {
                toast.success('Request approved');
                fetchData();
            } else {
                toast.error('Failed to approve request');
            }
        } catch (error) {
            toast.error('Error approving request');
        }
    };

    const handleReject = async (id: string) => {
        const reason = prompt('Enter rejection reason:');
        if (!reason) return;

        try {
            const response = await stockRequestAPI.rejectRequest(id, reason);
            if (response.success) {
                toast.success('Request rejected');
                fetchData();
            } else {
                toast.error('Failed to reject request');
            }
        } catch (error) {
            toast.error('Error rejecting request');
        }
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
                                <h1 className="text-[22px] font-semibold text-stone-900">Requisitions</h1>
                                <p className="text-stone-500 text-sm">Manage approvals and analyze consumption</p>
                            </div>
                        </div>
                        <button onClick={fetchData} disabled={isLoading} className="btn-secondary self-start sm:self-auto">
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="border-b border-stone-200">
                        <nav className="-mb-px flex space-x-8">
                            <button
                                onClick={() => setActiveTab('approvals')}
                                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === 'approvals'
                                        ? 'border-primary-500 text-primary-600'
                                        : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'}
                `}
                            >
                                Pending Approvals
                            </button>
                            <button
                                onClick={() => setActiveTab('analysis')}
                                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === 'analysis'
                                        ? 'border-primary-500 text-primary-600'
                                        : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'}
                `}
                            >
                                Consumption Analysis
                            </button>
                        </nav>
                    </div>

                    {/* Filters */}
                    <div className="card-elevated p-4 flex flex-wrap gap-4 items-end">
                        <div className="w-full sm:w-auto min-w-[200px]">
                            <label className="text-xs font-medium text-stone-500 mb-1.5 block">Branch</label>
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <select
                                    value={filters.branch_id}
                                    onChange={(e) => setFilters(prev => ({ ...prev, branch_id: e.target.value }))}
                                    className="input-field pl-9 w-full"
                                >
                                    <option value="">All Branches</option>
                                    {branches.map(branch => (
                                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {activeTab === 'approvals' && (
                            <div className="w-full sm:w-auto min-w-[150px]">
                                <label className="text-xs font-medium text-stone-500 mb-1.5 block">Status</label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                                    className="input-field w-full"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="all">All</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        </div>
                    ) : activeTab === 'approvals' ? (
                        <div className="space-y-4">
                            {requests.length > 0 ? (
                                requests.map((request) => (
                                    <div key={request.id} className="card-elevated p-6">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-lg font-semibold text-stone-900">Request #{request.id.slice(0, 8)}</h3>
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                            ${request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                            request.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                                'bg-red-100 text-red-800'
                                                        }
                          `}>
                                                        {request.status}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-stone-500">
                                                    Requested by {request.requester?.first_name} {request.requester?.last_name} • {new Date(request.created_at).toLocaleDateString()}
                                                </p>
                                                <p className="text-sm font-medium text-stone-700 mt-1">Branch: {request.branch?.name}</p>
                                            </div>
                                            {request.status === 'pending' && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleReject(request.id)}
                                                        className="btn-white text-red-600 hover:bg-red-50 border-red-200"
                                                    >
                                                        <XCircle className="h-4 w-4 mr-2" />
                                                        Reject
                                                    </button>
                                                    <button
                                                        onClick={() => handleApprove(request.id, request.items)}
                                                        className="btn-primary bg-green-600 hover:bg-green-700 border-green-600"
                                                    >
                                                        <CheckCircle className="h-4 w-4 mr-2" />
                                                        Approve
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-stone-50 rounded-lg p-4">
                                            <h4 className="text-sm font-medium text-stone-700 mb-3">Requested Items</h4>
                                            <div className="grid gap-2">
                                                {request.items?.map((item: any) => (
                                                    <div key={item.id} className="flex justify-between items-center text-sm border-b border-stone-200 last:border-0 pb-2 last:pb-0">
                                                        <span className="text-stone-600">{item.item?.name} ({item.item?.sku})</span>
                                                        <span className="font-medium text-stone-900">{item.quantity_requested} {item.item?.unit}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {request.notes && (
                                            <div className="mt-4 text-sm text-stone-500 italic">
                                                Note: "{request.notes}"
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 bg-stone-50 rounded-lg border border-dashed border-stone-200">
                                    <ClipboardList className="h-10 w-10 text-stone-300 mx-auto mb-3" />
                                    <p className="text-stone-500 font-medium">No requests found</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="card-elevated overflow-hidden">
                            <div className="p-6 border-b border-stone-100">
                                <h3 className="text-lg font-semibold text-stone-900">Consumption Analysis</h3>
                                <p className="text-sm text-stone-500">Comparing approved requisitions against sales is coming soon.</p>
                            </div>
                            {/* Placeholder for chart/table */}
                            <div className="p-12 text-center text-stone-400">
                                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>Detailed consumption analytics visualization will be implemented here.</p>
                            </div>
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
