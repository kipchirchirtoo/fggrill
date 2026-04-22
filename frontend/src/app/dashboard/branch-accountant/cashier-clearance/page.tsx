'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { fetchAPI } from '@/lib/api/core';
import {
  DollarSign, CheckCircle, AlertTriangle, XCircle, RefreshCw, Calendar,
  User, TrendingUp, TrendingDown, Eye, Check, Flag, Clock, ArrowLeft, Filter
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

interface Cashier {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Clearance {
  id: string;
  cashier_id: string;
  cashier_name: string;
  shift_start: string;
  shift_end: string | null;
  expected_cash: number;
  actual_cash: number;
  variance: number;
  variance_percentage: number;
  has_discrepancy: boolean;
  status: string;
  notes: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  cashier: Cashier;
}

interface Summary {
  total_shifts: number;
  pending: number;
  approved: number;
  with_discrepancies: number;
  total_expected: number;
  total_actual: number;
  total_variance: number;
}

export default function CashierClearancePage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [clearances, setClearances] = useState<Clearance[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedClearance, setSelectedClearance] = useState<Clearance | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [flagReason, setFlagReason] = useState('');
  const [flagNotes, setFlagNotes] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchClearances = useCallback(async () => {
    if (!currentBranchId) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        branch_id: currentBranchId.toString(),
        date: selectedDate,
        ...(statusFilter !== 'all' && { status: statusFilter })
      });

      const response = await fetchAPI<any>(`/cashier/clearances?${params}`);

      if (response.success && response.data) {
        setClearances(response.data.clearances || []);
        setSummary(response.data.summary || null);
      }
    } catch (error: any) {
      console.error('Error fetching clearances:', error);
      toast.error(error.message || 'Failed to load clearances');
    } finally {
      setIsLoading(false);
    }
  }, [currentBranchId, selectedDate, statusFilter]);

  useEffect(() => {
    fetchClearances();
  }, [fetchClearances]);

  const handleApprove = async () => {
    if (!selectedClearance) return;

    setIsActionLoading(true);
    try {
      const response = await fetchAPI<any>(`/cashier/clearances/${selectedClearance.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes: approvalNotes })
      });

      if (response.success) {
        toast.success('Clearance approved successfully');
        setShowApproveModal(false);
        setApprovalNotes('');
        fetchClearances();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve clearance');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleFlag = async () => {
    if (!selectedClearance || !flagReason) {
      toast.error('Please provide a reason for flagging');
      return;
    }

    setIsActionLoading(true);
    try {
      const response = await fetchAPI<any>(`/cashier/clearances/${selectedClearance.id}/flag`, {
        method: 'POST',
        body: JSON.stringify({ reason: flagReason, notes: flagNotes })
      });

      if (response.success) {
        toast.success('Clearance flagged successfully');
        setShowFlagModal(false);
        setFlagReason('');
        setFlagNotes('');
        fetchClearances();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to flag clearance');
    } finally {
      setIsActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      open: { label: 'Open', className: 'bg-blue-100 text-blue-700' },
      pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
      closed: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' },
      approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' },
      flagged: { label: 'Flagged', className: 'bg-rose-100 text-rose-700' }
    };

    const statusInfo = statusMap[status] || { label: status, className: 'bg-stone-100 text-stone-700' };

    return (
      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard/branch-accounting" className="text-stone-400 hover:text-stone-900 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-[12px] font-bold text-stone-400 uppercase tracking-widest">
              Branch Accountant / Cashier Clearance
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Cashier Clearance</h1>
              <p className="text-stone-500 mt-0.5">{activeBranch?.name || user?.branch_name || 'Your Branch'}</p>
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="closed">Approved</option>
                <option value="flagged">Flagged</option>
              </select>
              <button
                onClick={fetchClearances}
                disabled={isLoading}
                className="btn-secondary"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="stat-card">
                <div className="stat-icon bg-blue-50 text-blue-600">
                  <User className="h-5 w-5" />
                </div>
                <p className="stat-value text-[22px]">{summary.total_shifts}</p>
                <p className="stat-label text-[12px] mt-1">Total Shifts</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon bg-amber-50 text-amber-600">
                  <Clock className="h-5 w-5" />
                </div>
                <p className="stat-value text-[22px]">{summary.pending}</p>
                <p className="stat-label text-[12px] mt-1">Pending</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon bg-emerald-50 text-emerald-600">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <p className="stat-value text-[22px]">{summary.approved}</p>
                <p className="stat-label text-[12px] mt-1">Approved</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon bg-rose-50 text-rose-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <p className="stat-value text-[22px]">{summary.with_discrepancies}</p>
                <p className="stat-label text-[12px] mt-1">Discrepancies</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon bg-stone-50 text-stone-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <p className="stat-value text-[18px]">{formatCurrency(summary.total_expected)}</p>
                <p className="stat-label text-[12px] mt-1">Expected</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon bg-stone-50 text-stone-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <p className="stat-value text-[18px]">{formatCurrency(summary.total_actual)}</p>
                <p className="stat-label text-[12px] mt-1">Actual</p>
              </div>

              <div className="stat-card">
                <div className={`stat-icon ${summary.total_variance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {summary.total_variance >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                </div>
                <p className={`stat-value text-[18px] ${summary.total_variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(Math.abs(summary.total_variance))}
                </p>
                <p className="stat-label text-[12px] mt-1">Variance</p>
              </div>
            </div>
          )}

          {/* Clearances Table */}
          <div className="card-elevated p-0 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-2 opacity-50">
                  <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-stone-400">Loading clearances...</span>
                </div>
              </div>
            ) : clearances.length === 0 ? (
              <div className="text-center py-20 px-6">
                <div className="h-16 w-16 rounded-full bg-stone-50 flex items-center justify-center mb-4 mx-auto">
                  <CheckCircle className="h-8 w-8 text-stone-300" />
                </div>
                <h3 className="text-lg font-bold text-stone-900">No Clearances Found</h3>
                <p className="text-sm text-stone-500 mt-1">No cashier shifts found for the selected date and filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="table-header-cell">Cashier</th>
                      <th className="table-header-cell">Shift Time</th>
                      <th className="table-header-cell text-right">Expected</th>
                      <th className="table-header-cell text-right">Actual</th>
                      <th className="table-header-cell text-right">Variance</th>
                      <th className="table-header-cell text-center">Status</th>
                      <th className="table-header-cell text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {clearances.map((clearance) => (
                      <tr key={clearance.id} className="table-row">
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
                              <User className="h-4 w-4 text-stone-500" />
                            </div>
                            <div>
                              <p className="text-[13px] font-medium text-stone-800">{clearance.cashier_name}</p>
                              {clearance.has_discrepancy && (
                                <span className="text-[10px] text-rose-600 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Discrepancy
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="table-cell">
                          <p className="text-[12px] text-stone-600">
                            {formatTime(clearance.shift_start)}
                            {clearance.shift_end && ` - ${formatTime(clearance.shift_end)}`}
                          </p>
                        </td>
                        <td className="table-cell text-right">
                          <p className="text-[13px] font-medium text-stone-800">
                            {formatCurrency(clearance.expected_cash)}
                          </p>
                        </td>
                        <td className="table-cell text-right">
                          <p className="text-[13px] font-medium text-stone-800">
                            {formatCurrency(clearance.actual_cash)}
                          </p>
                        </td>
                        <td className="table-cell text-right">
                          <p className={`text-[13px] font-bold ${clearance.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {clearance.variance >= 0 ? '+' : ''}{formatCurrency(clearance.variance)}
                            <span className="text-[10px] ml-1">
                              ({clearance.variance_percentage.toFixed(1)}%)
                            </span>
                          </p>
                        </td>
                        <td className="table-cell text-center">
                          {getStatusBadge(clearance.status)}
                        </td>
                        <td className="table-cell text-right">
                          <div className="flex items-center justify-end gap-1">
                            {(clearance.status === 'open' || clearance.status === 'pending') && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedClearance(clearance);
                                    setShowApproveModal(true);
                                  }}
                                  className="p-1.5 rounded-md hover:bg-emerald-50 transition-colors group"
                                  title="Approve"
                                >
                                  <Check className="h-4 w-4 text-stone-400 group-hover:text-emerald-600" />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedClearance(clearance);
                                    setShowFlagModal(true);
                                  }}
                                  className="p-1.5 rounded-md hover:bg-rose-50 transition-colors group"
                                  title="Flag"
                                >
                                  <Flag className="h-4 w-4 text-stone-400 group-hover:text-rose-600" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => setSelectedClearance(clearance)}
                              className="p-1.5 rounded-md hover:bg-stone-100 transition-colors"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4 text-stone-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Approve Modal */}
        <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Approve Clearance</DialogTitle>
              <DialogDescription>
                Approve cashier clearance for {selectedClearance?.cashier_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-stone-500 uppercase tracking-wider mb-1">Expected</p>
                  <p className="text-[16px] font-bold text-stone-900">
                    {selectedClearance && formatCurrency(selectedClearance.expected_cash)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-stone-500 uppercase tracking-wider mb-1">Actual</p>
                  <p className="text-[16px] font-bold text-stone-900">
                    {selectedClearance && formatCurrency(selectedClearance.actual_cash)}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-stone-500 uppercase tracking-wider mb-1">Variance</p>
                <p className={`text-[18px] font-bold ${selectedClearance && selectedClearance.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {selectedClearance && `${selectedClearance.variance >= 0 ? '+' : ''}${formatCurrency(selectedClearance.variance)}`}
                </p>
              </div>
              <div>
                <label className="text-[13px] font-medium text-stone-700 mb-2 block">
                  Approval Notes (Optional)
                </label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Add any notes about this approval..."
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-stone-900 focus:bg-white outline-none min-h-[80px] resize-none"
                />
              </div>
            </div>
            <DialogFooter>
              <button
                onClick={() => setShowApproveModal(false)}
                className="btn-secondary"
                disabled={isActionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="btn-primary"
                disabled={isActionLoading}
              >
                {isActionLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Approve Clearance</span>
                  </>
                )}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Flag Modal */}
        <Dialog open={showFlagModal} onOpenChange={setShowFlagModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Flag Clearance</DialogTitle>
              <DialogDescription>
                Flag this clearance for discrepancy review
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-[13px] font-medium text-stone-700 mb-2 block">
                  Reason for Flagging <span className="text-rose-500">*</span>
                </label>
                <select
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none"
                >
                  <option value="">Select a reason...</option>
                  <option value="cash_shortage">Cash Shortage</option>
                  <option value="cash_overage">Cash Overage</option>
                  <option value="missing_receipts">Missing Receipts</option>
                  <option value="suspicious_activity">Suspicious Activity</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[13px] font-medium text-stone-700 mb-2 block">
                  Additional Notes
                </label>
                <textarea
                  value={flagNotes}
                  onChange={(e) => setFlagNotes(e.target.value)}
                  placeholder="Provide additional details about the discrepancy..."
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-stone-900 focus:bg-white outline-none min-h-[80px] resize-none"
                />
              </div>
            </div>
            <DialogFooter>
              <button
                onClick={() => setShowFlagModal(false)}
                className="btn-secondary"
                disabled={isActionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleFlag}
                className="bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 transition-colors flex items-center gap-2 text-sm font-medium"
                disabled={isActionLoading || !flagReason}
              >
                {isActionLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Flagging...</span>
                  </>
                ) : (
                  <>
                    <Flag className="h-4 w-4" />
                    <span>Flag Clearance</span>
                  </>
                )}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
