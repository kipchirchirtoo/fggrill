'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, CheckCircle, XCircle, AlertCircle, User,
  Plus, Edit, Eye, Search, Filter, RefreshCw, Loader2,
  ChevronRight, FileText, Send, X, Check, Download, Briefcase,
  Sun, Umbrella, Heart, Baby, GraduationCap, Plane
} from 'lucide-react';
import { toast } from 'sonner';
import { staffAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/lib/date-utils';

interface LeaveRequest {
  id: string;
  employee: {
    id: string;
    name: string;
    department: string;
    position: string;
    avatar?: string;
  };
  leave_type: 'annual' | 'sick' | 'maternity' | 'paternity' | 'study' | 'unpaid' | 'compassionate';
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  documents?: string[];
}

interface LeaveBalance {
  type: string;
  total: number;
  used: number;
  remaining: number;
}

interface LeaveManagementProps {
  branchId?: number;
  isManager?: boolean;
  employeeId?: string;
}

const LEAVE_TYPES = [
  { id: 'annual', label: 'Annual Leave', icon: Sun, color: 'bg-amber-100 text-amber-700', days: 21 },
  { id: 'sick', label: 'Sick Leave', icon: Heart, color: 'bg-red-100 text-red-700', days: 14 },
  { id: 'maternity', label: 'Maternity Leave', icon: Baby, color: 'bg-pink-100 text-pink-700', days: 90 },
  { id: 'paternity', label: 'Paternity Leave', icon: Baby, color: 'bg-blue-100 text-blue-700', days: 14 },
  { id: 'study', label: 'Study Leave', icon: GraduationCap, color: 'bg-purple-100 text-purple-700', days: 10 },
  { id: 'unpaid', label: 'Unpaid Leave', icon: Briefcase, color: 'bg-gray-100 text-gray-700', days: 30 },
  { id: 'compassionate', label: 'Compassionate Leave', icon: Heart, color: 'bg-indigo-100 text-indigo-700', days: 5 }
];

const STATUS_CONFIG = {
  pending: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Pending' },
  approved: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Approved' },
  rejected: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Rejected' },
  cancelled: { color: 'bg-gray-100 text-gray-700', icon: X, label: 'Cancelled' }
};

export function LeaveManagement({ branchId, isManager = false, employeeId }: LeaveManagementProps) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  
  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    leave_type: 'annual' as LeaveRequest['leave_type'],
    start_date: '',
    end_date: '',
    reason: '',
    documents: [] as string[]
  });
  
  // Approval state
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    onLeaveToday: 0
  });

  useEffect(() => {
    fetchRequests();
    fetchBalances();
  }, [branchId, employeeId]);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      // In production, this would call the leave API
      const response = await staffAPI.getLeaveRequests({ 
        branch_id: branchId,
        employee_id: isManager ? undefined : (employeeId || user?.id)
      });
      const requestsData = response.data || response.requests || response || [];
      
      const processed: LeaveRequest[] = requestsData.map((r: any) => ({
        id: r.id,
        employee: {
          id: r.employee?.id || r.employee_id,
          name: r.employee?.name || r.employee_name || 'Unknown',
          department: r.employee?.department || r.department || '',
          position: r.employee?.position || r.position || '',
          avatar: r.employee?.avatar
        },
        leave_type: r.leave_type || 'annual',
        start_date: r.start_date,
        end_date: r.end_date,
        days: r.days || calculateDays(r.start_date, r.end_date),
        reason: r.reason || '',
        status: r.status || 'pending',
        approved_by: r.approved_by,
        approved_at: r.approved_at,
        rejection_reason: r.rejection_reason,
        created_at: r.created_at,
        documents: r.documents || []
      }));

      setRequests(processed);

      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      setStats({
        total: processed.length,
        pending: processed.filter(r => r.status === 'pending').length,
        approved: processed.filter(r => r.status === 'approved').length,
        rejected: processed.filter(r => r.status === 'rejected').length,
        onLeaveToday: processed.filter(r => 
          r.status === 'approved' && 
          r.start_date <= today && 
          r.end_date >= today
        ).length
      });
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBalances = async () => {
    try {
      // In production, this would fetch actual balances
      setBalances(LEAVE_TYPES.map(lt => ({
        type: lt.id,
        total: lt.days,
        used: Math.floor(Math.random() * (lt.days / 2)),
        remaining: lt.days - Math.floor(Math.random() * (lt.days / 2))
      })));
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const filteredRequests = useMemo(() => {
    let result = [...requests];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r =>
        r.employee.name.toLowerCase().includes(term) ||
        r.employee.department.toLowerCase().includes(term)
      );
    }

    if (statusFilter) {
      result = result.filter(r => r.status === statusFilter);
    }

    if (typeFilter) {
      result = result.filter(r => r.leave_type === typeFilter);
    }

    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [requests, searchTerm, statusFilter, typeFilter]);

  const handleNewRequest = () => {
    setFormData({
      leave_type: 'annual',
      start_date: '',
      end_date: '',
      reason: '',
      documents: []
    });
    setIsNewModalOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (!formData.start_date || !formData.end_date || !formData.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    const days = calculateDays(formData.start_date, formData.end_date);
    const balance = balances.find(b => b.type === formData.leave_type);
    
    if (balance && days > balance.remaining && formData.leave_type !== 'unpaid') {
      toast.error(`Insufficient leave balance. You have ${balance.remaining} days remaining.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await staffAPI.createLeaveRequest({
        employee_id: employeeId || user?.id,
        leave_type: formData.leave_type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        days,
        reason: formData.reason
      });

      toast.success('Leave request submitted successfully');
      setIsNewModalOpen(false);
      fetchRequests();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprovalAction = async () => {
    if (!selectedRequest) return;

    if (approvalAction === 'reject' && !rejectionReason) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setIsSubmitting(true);
    try {
      await staffAPI.updateLeaveRequest(selectedRequest.id, {
        status: approvalAction === 'approve' ? 'approved' : 'rejected',
        approved_by: user?.id,
        rejection_reason: approvalAction === 'reject' ? rejectionReason : undefined
      });

      toast.success(`Leave request ${approvalAction === 'approve' ? 'approved' : 'rejected'}`);
      setIsApprovalModalOpen(false);
      setRejectionReason('');
      fetchRequests();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this leave request?')) return;

    try {
      await staffAPI.updateLeaveRequest(id, { status: 'cancelled' });
      toast.success('Leave request cancelled');
      fetchRequests();
    } catch (error) {
      toast.error('Failed to cancel request');
    }
  };

  const openApprovalModal = (request: LeaveRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setApprovalAction(action);
    setRejectionReason('');
    setIsApprovalModalOpen(true);
  };

  const getLeaveTypeConfig = (type: string) => {
    return LEAVE_TYPES.find(lt => lt.id === type) || LEAVE_TYPES[0];
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Leave Management
          </h2>
          <p className="text-sm text-gray-500">
            {isManager ? `${stats.pending} pending approvals` : 'Manage your leave requests'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <IOSButton variant="outline" onClick={fetchRequests}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </IOSButton>
          {!isManager && (
            <IOSButton onClick={handleNewRequest} className="bg-[#3C3C43] hover:bg-[#000000] text-white">
              <Plus className="h-4 w-4 mr-2" />
              Request Leave
            </IOSButton>
          )}
        </div>
      </div>

      {/* Leave Balances (for employees) */}
      {!isManager && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {balances.slice(0, 4).map(balance => {
            const config = getLeaveTypeConfig(balance.type);
            const Icon = config.icon;
            const usedPercent = (balance.used / balance.total) * 100;
            
            return (
              <IOSCard key={balance.type} className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-ios-lg ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{config.label}</span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-2xl font-bold">{balance.remaining}</span>
                    <span className="text-sm text-gray-500"> / {balance.total}</span>
                  </div>
                  <span className="text-xs text-gray-500">{balance.used} used</span>
                </div>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${usedPercent > 80 ? 'bg-red-500' : usedPercent > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${usedPercent}%` }}
                  />
                </div>
              </IOSCard>
            );
          })}
        </div>
      )}

      {/* Stats (for managers) */}
      {isManager && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <IOSCard className="p-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#3C3C43]" />
              <div>
                <p className="text-xl font-bold">{stats.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
            </div>
          </IOSCard>
          <IOSCard className="p-3 bg-yellow-50">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-xl font-bold text-yellow-700">{stats.pending}</p>
                <p className="text-xs text-yellow-600">Pending</p>
              </div>
            </div>
          </IOSCard>
          <IOSCard className="p-3 bg-green-50">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xl font-bold text-green-700">{stats.approved}</p>
                <p className="text-xs text-green-600">Approved</p>
              </div>
            </div>
          </IOSCard>
          <IOSCard className="p-3 bg-red-50">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-xl font-bold text-red-700">{stats.rejected}</p>
                <p className="text-xs text-red-600">Rejected</p>
              </div>
            </div>
          </IOSCard>
          <IOSCard className="p-3 bg-blue-50">
            <div className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xl font-bold text-blue-700">{stats.onLeaveToday}</p>
                <p className="text-xs text-blue-600">On Leave Today</p>
              </div>
            </div>
          </IOSCard>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
          <Input
            placeholder="Search by name or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-ios-lg text-sm"
        >
          <option value="">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border rounded-ios-lg text-sm"
        >
          <option value="">All Types</option>
          {LEAVE_TYPES.map(lt => (
            <option key={lt.id} value={lt.id}>{lt.label}</option>
          ))}
        </select>
      </div>

      {/* Requests List */}
      <IOSCard className="divide-y">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No leave requests found</p>
          </div>
        ) : (
          filteredRequests.map(request => {
            const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
            const typeConfig = getLeaveTypeConfig(request.leave_type);
            const StatusIcon = statusConfig.icon;
            const TypeIcon = typeConfig.icon;

            return (
              <motion.div
                key={request.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${typeConfig.color}`}>
                      <TypeIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold font-sf-pro-display">{request.employee.name}</h3>
                        <IOSBadge className={typeConfig.color}>{typeConfig.label}</IOSBadge>
                      </div>
                      <p className="text-sm text-gray-500">
                        {request.employee.department} • {request.employee.position}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden md:block">
                      <p className="font-medium">
                        {formatDate(request.start_date)} - {formatDate(request.end_date)}
                      </p>
                      <p className="text-sm text-gray-500">{request.days} day{request.days !== 1 ? 's' : ''}</p>
                    </div>
                    <IOSBadge className={statusConfig.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </IOSBadge>
                    <div className="flex items-center gap-1">
                      {isManager && request.status === 'pending' && (
                        <>
                          <IOSButton
                            size="sm"
                            variant="ghost"
                            onClick={() => openApprovalModal(request, 'approve')}
                            title="Approve"
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </IOSButton>
                          <IOSButton
                            size="sm"
                            variant="ghost"
                            onClick={() => openApprovalModal(request, 'reject')}
                            title="Reject"
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </IOSButton>
                        </>
                      )}
                      {!isManager && request.status === 'pending' && (
                        <IOSButton
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancelRequest(request.id)}
                          title="Cancel"
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </IOSButton>
                      )}
                      <IOSButton
                        size="sm"
                        variant="ghost"
                        onClick={() => { setSelectedRequest(request); setIsViewModalOpen(true); }}
                      >
                        <Eye className="h-4 w-4" />
                      </IOSButton>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </IOSCard>

      {/* New Request Modal */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Leave Type *</label>
              <div className="grid grid-cols-2 gap-2">
                {LEAVE_TYPES.slice(0, 6).map(lt => {
                  const Icon = lt.icon;
                  const balance = balances.find(b => b.type === lt.id);
                  return (
                    <button
                      key={lt.id}
                      onClick={() => setFormData({ ...formData, leave_type: lt.id as any })}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        formData.leave_type === lt.id 
                          ? `${lt.color} border-current` 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{lt.label}</span>
                      </div>
                      {balance && (
                        <p className="text-xs text-gray-500">{balance.remaining} days left</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Start Date *</label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">End Date *</label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  min={formData.start_date || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {formData.start_date && formData.end_date && (
              <div className="p-3 bg-[#F2F2F7] rounded-ios-lg text-center">
                <span className="text-2xl font-bold">{calculateDays(formData.start_date, formData.end_date)}</span>
                <span className="text-gray-500"> day(s)</span>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Reason *</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Please provide a reason for your leave request..."
                className="w-full px-3 py-2 border rounded-ios-lg resize-none"
                rows={4}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <IOSButton variant="outline" className="flex-1" onClick={() => setIsNewModalOpen(false)}>
                Cancel
              </IOSButton>
              <IOSButton 
                className="flex-1 bg-[#3C3C43] hover:bg-[#000000]"
                onClick={handleSubmitRequest}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Submit Request
              </IOSButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Request Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-[#F2F2F7] rounded-xl">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${getLeaveTypeConfig(selectedRequest.leave_type).color}`}>
                  {(() => {
                    const Icon = getLeaveTypeConfig(selectedRequest.leave_type).icon;
                    return <Icon className="h-7 w-7" />;
                  })()}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold">{selectedRequest.employee.name}</h3>
                  <p className="text-sm text-gray-600">{selectedRequest.employee.department}</p>
                </div>
                <IOSBadge className={STATUS_CONFIG[selectedRequest.status]?.color}>
                  {STATUS_CONFIG[selectedRequest.status]?.label}
                </IOSBadge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-ios-lg">
                  <p className="text-xs text-gray-500">Leave Type</p>
                  <p className="font-medium">{getLeaveTypeConfig(selectedRequest.leave_type).label}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-ios-lg">
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="font-medium">{selectedRequest.days} day(s)</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-ios-lg">
                  <p className="text-xs text-gray-500">Start Date</p>
                  <p className="font-medium">{formatDate(selectedRequest.start_date)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-ios-lg">
                  <p className="text-xs text-gray-500">End Date</p>
                  <p className="font-medium">{formatDate(selectedRequest.end_date)}</p>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-ios-lg">
                <p className="text-xs text-gray-500 mb-1">Reason</p>
                <p className="text-sm">{selectedRequest.reason}</p>
              </div>

              {selectedRequest.rejection_reason && (
                <div className="p-3 bg-red-50 rounded-ios-lg">
                  <p className="text-xs text-red-600 mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-700">{selectedRequest.rejection_reason}</p>
                </div>
              )}

              {selectedRequest.approved_by && (
                <div className="p-3 bg-green-50 rounded-ios-lg">
                  <p className="text-xs text-green-600 mb-1">Approved By</p>
                  <p className="text-sm text-green-700">{selectedRequest.approved_by}</p>
                </div>
              )}

              <IOSButton variant="outline" className="w-full" onClick={() => setIsViewModalOpen(false)}>
                Close
              </IOSButton>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Modal */}
      <Dialog open={isApprovalModalOpen} onOpenChange={setIsApprovalModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 bg-[#F2F2F7] rounded-xl">
                <p className="font-medium">{selectedRequest.employee.name}</p>
                <p className="text-sm text-gray-600">
                  {getLeaveTypeConfig(selectedRequest.leave_type).label} • {selectedRequest.days} days
                </p>
                <p className="text-sm text-gray-500">
                  {formatDate(selectedRequest.start_date)} - {formatDate(selectedRequest.end_date)}
                </p>
              </div>

              {approvalAction === 'reject' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Reason for Rejection *</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Please provide a reason..."
                    className="w-full px-3 py-2 border rounded-ios-lg resize-none"
                    rows={3}
                  />
                </div>
              )}

              <div className="flex gap-3">
                <IOSButton variant="outline" className="flex-1" onClick={() => setIsApprovalModalOpen(false)}>
                  Cancel
                </IOSButton>
                <IOSButton 
                  className={`flex-1 ${approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                  onClick={handleApprovalAction}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : approvalAction === 'approve' ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <X className="h-4 w-4 mr-2" />
                  )}
                  {approvalAction === 'approve' ? 'Approve' : 'Reject'}
                </IOSButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
