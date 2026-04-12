'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/minimal/card";
import { IOSBadge } from '@/components/ui/ios-badge';
import { IOSButton } from '@/components/ui/ios-button';
import { staffAPI } from '@/lib/api';
import {
  RefreshCw, Calendar, Users, Plus, Search, CheckCircle2, XCircle, Clock,
  Eye, FileText, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface LeaveRequest {
  id: string;
  staff_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason?: string;
  notes?: string;
  approved_by?: string;
  created_at: string;
  reported_to_duty?: boolean;
  actual_return_date?: string;
  reported_at?: string;
  reported_by?: string;
  report_notes?: string;
  staff?: {
    first_name: string;
    last_name: string;
    id_number?: string;
    department?: string;
  };
  approver?: {
    first_name: string;
    last_name: string;
  };
}

const LEAVE_TYPES = [
  { value: 'annual', label: 'Annual Leave', color: 'bg-blue-100 text-blue-700' },
  { value: 'sick', label: 'Sick Leave', color: 'bg-red-100 text-red-700' },
  { value: 'maternity', label: 'Maternity Leave', color: 'bg-pink-100 text-pink-700' },
  { value: 'paternity', label: 'Paternity Leave', color: 'bg-purple-100 text-purple-700' },
  { value: 'unpaid', label: 'Unpaid Leave', color: 'bg-gray-100 text-gray-700' },
  { value: 'other', label: 'Other', color: 'bg-amber-100 text-amber-700' },
];

export default function LeaveManagementPage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showReportDutyModal, setShowReportDutyModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [leaveForm, setLeaveForm] = useState({
    staff_id: '',
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: ''
  });

  const [reportDutyForm, setReportDutyForm] = useState({
    actual_return_date: '',
    report_notes: ''
  });

  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchData = useCallback(async () => {
    if (!currentBranchId) return;
    setIsLoading(true);
    try {
      const [leaveRes, staffRes] = await Promise.all([
        staffAPI.getLeaveRequests({ branch_id: currentBranchId }),
        staffAPI.getStaff(currentBranchId)
      ]);

      if (leaveRes.success) {
        setLeaveRequests(leaveRes.data || []);
      }

      if (staffRes.success) {
        setStaffList(staffRes.data || []);
      }
    } catch (error) {
      console.error('Error fetching leave data:', error);
      toast.error('Failed to load leave requests');
    } finally {
      setIsLoading(false);
    }
  }, [currentBranchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRequests = leaveRequests.filter(req => {
    const matchesSearch = searchQuery === '' || 
      `${req.staff?.first_name} ${req.staff?.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.staff?.id_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'danger';
      case 'pending': return 'warning';
      case 'cancelled': return 'secondary';
      default: return 'info';
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    return LEAVE_TYPES.find(t => t.value === type)?.label || type;
  };

  const getLeaveTypeColor = (type: string) => {
    return LEAVE_TYPES.find(t => t.value === type)?.color || 'bg-gray-100 text-gray-700';
  };

  const calculateDays = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!leaveForm.staff_id || !leaveForm.start_date || !leaveForm.end_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (new Date(leaveForm.end_date) < new Date(leaveForm.start_date)) {
      toast.error('End date must be after start date');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await staffAPI.submitLeaveRequest(leaveForm);
      
      if (response.success) {
        toast.success('Leave request submitted successfully');
        setShowRequestModal(false);
        setLeaveForm({
          staff_id: '',
          leave_type: 'annual',
          start_date: '',
          end_date: '',
          reason: ''
        });
        fetchData();
      } else {
        toast.error(response.message || 'Failed to submit leave request');
      }
    } catch (error) {
      console.error('Error submitting leave request:', error);
      toast.error('Failed to submit leave request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const response = await staffAPI.approveLeaveRequest(id);
      if (response.success) {
        toast.success('Leave request approved');
        fetchData();
        setShowDetailsModal(false);
      } else {
        toast.error('Failed to approve leave request');
      }
    } catch (error) {
      console.error('Error approving leave:', error);
      toast.error('Failed to approve leave request');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const response = await staffAPI.rejectLeaveRequest(id);
      if (response.success) {
        toast.success('Leave request rejected');
        fetchData();
        setShowDetailsModal(false);
      } else {
        toast.error('Failed to reject leave request');
      }
    } catch (error) {
      console.error('Error rejecting leave:', error);
      toast.error('Failed to reject leave request');
    }
  };

  const handleReportToDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRequest) return;

    setIsSubmitting(true);
    try {
      const response = await staffAPI.reportToDuty(selectedRequest.id, reportDutyForm);
      
      if (response.success) {
        toast.success('Employee reported to duty successfully');
        setShowReportDutyModal(false);
        setReportDutyForm({
          actual_return_date: '',
          report_notes: ''
        });
        fetchData();
      } else {
        toast.error(response.message || 'Failed to report to duty');
      }
    } catch (error) {
      console.error('Error reporting to duty:', error);
      toast.error('Failed to report to duty');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = {
    total: leaveRequests.length,
    pending: leaveRequests.filter(r => r.status === 'pending').length,
    approved: leaveRequests.filter(r => r.status === 'approved').length,
    rejected: leaveRequests.filter(r => r.status === 'rejected').length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="max-w-7xl mx-auto space-y-8 pb-10">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Leave Management</h1>
              <p className="text-sm text-stone-500 mt-1">Manage staff leave requests for {activeBranch?.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                className="h-10 w-10 flex items-center justify-center border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 text-stone-600 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <IOSButton
                onClick={() => setShowRequestModal(true)}
                className="h-10 px-4 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Request
              </IOSButton>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Total Requests', value: stats.total, icon: FileText, color: 'text-stone-600' },
              { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-600' },
              { label: 'Approved', value: stats.approved, icon: CheckCircle2, color: 'text-green-600' },
              { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600' },
            ].map((stat, i) => (
              <div key={i} className="bg-white border border-stone-100 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2.5 mb-2">
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold text-stone-900">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <Card className="border-stone-100 shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search by name or employee ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 text-sm bg-stone-50/50 border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-400 outline-none transition-all"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 px-3 text-sm bg-white border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-400 outline-none transition-all"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Leave Requests Table */}
          <Card className="border-stone-100 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-stone-50 bg-white py-5 px-6">
              <CardTitle className="text-lg font-medium text-stone-900">Leave Requests</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50/50 border-b border-stone-100">
                      <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Leave Type</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Duration</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Days</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Requested</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center text-stone-400">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 opacity-20" />
                          <span className="text-sm">Loading leave requests...</span>
                        </td>
                      </tr>
                    ) : filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center text-stone-400">
                          <span className="text-sm">No leave requests found.</span>
                        </td>
                      </tr>
                    ) : (
                      filteredRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-stone-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-semibold text-xs">
                                {request.staff?.first_name?.[0]}{request.staff?.last_name?.[0]}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-stone-900">
                                  {request.staff?.first_name} {request.staff?.last_name}
                                </div>
                                <div className="text-[11px] text-stone-400">{request.staff?.id_number || '-'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getLeaveTypeColor(request.leave_type)}`}>
                              {getLeaveTypeLabel(request.leave_type)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-stone-600">
                            <div>{format(new Date(request.start_date), 'MMM dd, yyyy')}</div>
                            <div className="text-[11px] text-stone-400">to {format(new Date(request.end_date), 'MMM dd, yyyy')}</div>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-stone-900">
                            {calculateDays(request.start_date, request.end_date)} days
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <IOSBadge color={getStatusColor(request.status)} variant="light" size="sm">
                                {request.status.toUpperCase()}
                              </IOSBadge>
                              {request.status === 'approved' && request.reported_to_duty && (
                                <IOSBadge color="info" variant="light" size="sm">
                                  RETURNED
                                </IOSBadge>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-stone-600">
                            {format(new Date(request.created_at), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowDetailsModal(true);
                              }}
                              className="p-1.5 text-stone-400 hover:text-stone-600 transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* New Request Modal */}
          <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Plus className="h-5 w-5 text-stone-600" />
                  New Leave Request
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmitRequest} className="space-y-6 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">Employee *</label>
                  <select
                    value={leaveForm.staff_id}
                    onChange={(e) => setLeaveForm({ ...leaveForm, staff_id: e.target.value })}
                    className="w-full h-10 px-3 text-sm bg-white border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-400 outline-none"
                    required
                  >
                    <option value="">Select employee...</option>
                    {staffList.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.first_name} {staff.last_name} - {staff.id_number || staff.id.substring(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">Leave Type *</label>
                  <select
                    value={leaveForm.leave_type}
                    onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                    className="w-full h-10 px-3 text-sm bg-white border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-400 outline-none"
                    required
                  >
                    {LEAVE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Start Date *</label>
                    <input
                      type="date"
                      value={leaveForm.start_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                      className="w-full h-10 px-3 text-sm bg-white border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-400 outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">End Date *</label>
                    <input
                      type="date"
                      value={leaveForm.end_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                      className="w-full h-10 px-3 text-sm bg-white border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-400 outline-none"
                      required
                    />
                  </div>
                </div>

                {leaveForm.start_date && leaveForm.end_date && (
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-700">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Duration: {calculateDays(leaveForm.start_date, leaveForm.end_date)} days
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">Reason</label>
                  <textarea
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-400 outline-none resize-none"
                    placeholder="Optional: Provide reason for leave..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <IOSButton
                    type="button"
                    variant="secondary"
                    onClick={() => setShowRequestModal(false)}
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </IOSButton>
                  <IOSButton
                    type="submit"
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                  </IOSButton>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Details Modal */}
          <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <FileText className="h-5 w-5 text-stone-600" />
                  Leave Request Details
                </DialogTitle>
              </DialogHeader>

              {selectedRequest && (
                <div className="space-y-6 py-4">
                  <div className="flex items-center gap-5 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <div className="w-16 h-16 rounded-full bg-stone-200 flex items-center justify-center text-stone-700 font-bold text-xl shadow-sm">
                      {selectedRequest.staff?.first_name?.[0]}{selectedRequest.staff?.last_name?.[0]}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-stone-900 tracking-tight">
                        {selectedRequest.staff?.first_name} {selectedRequest.staff?.last_name}
                      </h4>
                      <p className="text-sm text-stone-500 font-medium">{selectedRequest.staff?.department || '-'}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest bg-stone-100 px-2 py-0.5 rounded">
                          ID: {selectedRequest.staff?.id_number || '-'}
                        </span>
                        <IOSBadge color={getStatusColor(selectedRequest.status)} variant="light" size="sm">
                          {selectedRequest.status.toUpperCase()}
                        </IOSBadge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white border border-stone-200 rounded-xl shadow-sm">
                      <div className="flex items-center gap-2 text-stone-400 mb-2">
                        <Calendar className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Leave Type</span>
                      </div>
                      <div className="text-lg font-semibold text-stone-900">
                        {getLeaveTypeLabel(selectedRequest.leave_type)}
                      </div>
                    </div>
                    <div className="p-4 bg-white border border-stone-200 rounded-xl shadow-sm">
                      <div className="flex items-center gap-2 text-stone-400 mb-2">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Duration</span>
                      </div>
                      <div className="text-lg font-semibold text-stone-900">
                        {calculateDays(selectedRequest.start_date, selectedRequest.end_date)} days
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider px-1">Period</label>
                    <div className="p-4 bg-stone-50 border border-stone-100 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-stone-500 mb-1">Start Date</div>
                          <div className="text-sm font-semibold text-stone-900">
                            {format(new Date(selectedRequest.start_date), 'MMMM dd, yyyy')}
                          </div>
                        </div>
                        <div className="text-stone-300">→</div>
                        <div>
                          <div className="text-xs text-stone-500 mb-1">End Date</div>
                          <div className="text-sm font-semibold text-stone-900">
                            {format(new Date(selectedRequest.end_date), 'MMMM dd, yyyy')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedRequest.reason && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider px-1">Reason</label>
                      <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl text-stone-700 text-sm leading-relaxed">
                        {selectedRequest.reason}
                      </div>
                    </div>
                  )}

                  {selectedRequest.notes && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider px-1">Admin Notes</label>
                      <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl text-stone-700 text-sm leading-relaxed">
                        {selectedRequest.notes}
                      </div>
                    </div>
                  )}

                  {selectedRequest.status === 'pending' && (
                    <div className="flex gap-3 pt-6 border-t border-stone-100">
                      <IOSButton
                        variant="secondary"
                        onClick={() => handleReject(selectedRequest.id)}
                        className="flex-1 bg-red-50 text-red-700 hover:bg-red-100"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </IOSButton>
                      <IOSButton
                        onClick={() => handleApprove(selectedRequest.id)}
                        className="flex-1"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approve
                      </IOSButton>
                    </div>
                  )}

                  {selectedRequest.status === 'approved' && !selectedRequest.reported_to_duty && (
                    <div className="pt-6 border-t border-stone-100">
                      <IOSButton
                        onClick={() => {
                          setShowDetailsModal(false);
                          setShowReportDutyModal(true);
                          setReportDutyForm({
                            actual_return_date: new Date().toISOString().split('T')[0],
                            report_notes: ''
                          });
                        }}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Report to Duty
                      </IOSButton>
                    </div>
                  )}

                  {selectedRequest.status === 'approved' && selectedRequest.reported_to_duty && (
                    <div className="space-y-4 pt-6 border-t border-stone-100">
                      <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
                        <div className="flex items-center gap-2 text-green-700 mb-2">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm font-semibold">Employee Returned to Duty</span>
                        </div>
                        <div className="text-xs text-green-600">
                          Returned on: {selectedRequest.actual_return_date ? format(new Date(selectedRequest.actual_return_date), 'MMMM dd, yyyy') : 'N/A'}
                        </div>
                        {selectedRequest.report_notes && (
                          <div className="mt-2 text-xs text-green-700">
                            Notes: {selectedRequest.report_notes}
                          </div>
                        )}
                      </div>
                      <IOSButton
                        variant="secondary"
                        onClick={() => setShowDetailsModal(false)}
                        className="w-full"
                      >
                        Close
                      </IOSButton>
                    </div>
                  )}

                  {(selectedRequest.status === 'rejected' || selectedRequest.status === 'cancelled') && (
                    <div className="pt-6 border-t border-stone-100">
                      <IOSButton
                        variant="secondary"
                        onClick={() => setShowDetailsModal(false)}
                        className="w-full"
                      >
                        Close
                      </IOSButton>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Report to Duty Modal */}
          <Dialog open={showReportDutyModal} onOpenChange={setShowReportDutyModal}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Report to Duty
                </DialogTitle>
              </DialogHeader>

              {selectedRequest && (
                <form onSubmit={handleReportToDuty} className="space-y-6 py-4">
                  <div className="flex items-center gap-5 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <div className="w-16 h-16 rounded-full bg-stone-200 flex items-center justify-center text-stone-700 font-bold text-xl shadow-sm">
                      {selectedRequest.staff?.first_name?.[0]}{selectedRequest.staff?.last_name?.[0]}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-stone-900 tracking-tight">
                        {selectedRequest.staff?.first_name} {selectedRequest.staff?.last_name}
                      </h4>
                      <p className="text-sm text-stone-500 font-medium">{selectedRequest.staff?.department || '-'}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest bg-stone-100 px-2 py-0.5 rounded">
                          ID: {selectedRequest.staff?.id_number || '-'}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getLeaveTypeColor(selectedRequest.leave_type)}`}>
                          {getLeaveTypeLabel(selectedRequest.leave_type)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <div className="flex items-center gap-2 text-blue-700 mb-2">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-semibold">Leave Period</span>
                    </div>
                    <div className="text-sm text-blue-600">
                      {format(new Date(selectedRequest.start_date), 'MMM dd, yyyy')} → {format(new Date(selectedRequest.end_date), 'MMM dd, yyyy')}
                      <span className="ml-2">({calculateDays(selectedRequest.start_date, selectedRequest.end_date)} days)</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Actual Return Date *</label>
                    <input
                      type="date"
                      value={reportDutyForm.actual_return_date}
                      onChange={(e) => setReportDutyForm({ ...reportDutyForm, actual_return_date: e.target.value })}
                      min={selectedRequest.start_date}
                      className="w-full h-10 px-3 text-sm bg-white border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-400 outline-none"
                      required
                    />
                    <p className="text-xs text-stone-500">The date the employee actually returned to work</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Notes (Optional)</label>
                    <textarea
                      value={reportDutyForm.report_notes}
                      onChange={(e) => setReportDutyForm({ ...reportDutyForm, report_notes: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-400 outline-none resize-none"
                      placeholder="Optional: Add any notes about the return (e.g., returned early, extended leave, etc.)"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <IOSButton
                      type="button"
                      variant="secondary"
                      onClick={() => setShowReportDutyModal(false)}
                      className="flex-1"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </IOSButton>
                    <IOSButton
                      type="submit"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Confirming...' : 'Confirm Return to Duty'}
                    </IOSButton>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
