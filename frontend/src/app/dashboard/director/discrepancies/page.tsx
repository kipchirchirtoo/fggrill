'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UserRole } from '@/lib/user-roles';
import { financeAPI } from '@/lib/api/finance';
import { 
  AlertTriangle, CheckCircle2, Clock, MessageSquare, 
  ShieldAlert, User, Calendar, Filter, Search, MoreHorizontal, XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function DiscrepancyControlPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [flags, setFlags] = useState<any[]>([]);
  const [filter, setFilter] = useState({ status: '', severity: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchFlags = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `/api/finance/discrepancies?`;
      if (filter.status) url += `status=${filter.status}&`;
      if (filter.severity) url += `severity=${filter.severity}&`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setFlags(result.data || []);
      } else {
        toast.error(result.message || 'Failed to fetch discrepancies');
      }
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to fetch discrepancies';
      
      if (message.includes('403') || message.includes('Forbidden')) {
        toast.error('Access Denied: You need director or auditor role');
      } else {
        toast.error(message);
      }
      
      console.error('Discrepancy Control Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, [filter]);

  const handleCreateFlag = async (formData: any) => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/finance/discrepancies', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('Discrepancy flag created successfully');
        setShowCreateModal(false);
        fetchFlags();
      } else {
        toast.error(result.message || 'Failed to create flag');
      }
    } catch (error) {
      toast.error('Failed to create discrepancy flag');
      console.error('Create Flag Error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespondToFlag = async (flagId: string, response: string) => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/finance/discrepancies/${flagId}/respond`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ accountant_response: response })
      });
      
      const result = await res.json();
      
      if (result.success) {
        toast.success('Response submitted successfully');
        setShowDetailModal(false);
        fetchFlags();
      } else {
        toast.error(result.message || 'Failed to submit response');
      }
    } catch (error) {
      toast.error('Failed to submit response');
      console.error('Respond Error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizeFlag = async (flagId: string, resolution: string) => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/finance/discrepancies/${flagId}/finalize`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ director_resolution: resolution, status: 'RESOLVED' })
      });
      
      const result = await res.json();
      
      if (result.success) {
        toast.success('Flag finalized successfully');
        setShowDetailModal(false);
        fetchFlags();
      } else {
        toast.error(result.message || 'Failed to finalize flag');
      }
    } catch (error) {
      toast.error('Failed to finalize flag');
      console.error('Finalize Error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute roles={[UserRole.DIRECTOR, UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="p-6 space-y-8">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-stone-900 tracking-tight flex items-center gap-3">
                <ShieldAlert className="w-8 h-8 text-rose-600" />
                Discrepancy Control
              </h1>
              <p className="text-stone-500 mt-1">Audit management and anomaly resolution workflow</p>
            </div>
            <div className="flex items-center gap-3">
              <select 
                className="bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007AFF]/20"
                value={filter.status}
                onChange={(e) => setFilter({...filter, status: e.target.value})}
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="RESOLVED">Resolved</option>
                <option value="ESCALATED">Escalated</option>
              </select>
              <button className="bg-[#007AFF] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-[#0056b3] transition-colors" onClick={() => setShowCreateModal(true)}>
                Create New Flag
              </button>
              <button className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-emerald-700 transition-colors">
                Generate Audit Report
              </button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Total Flags</p>
                <h4 className="text-3xl font-black text-stone-900">{flags.length}</h4>
             </div>
             <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm border-l-4 border-l-rose-500">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Pending Resolution</p>
                <h4 className="text-3xl font-black text-rose-600">{flags.filter(f => f.status === 'PENDING').length}</h4>
             </div>
             <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm border-l-4 border-l-amber-500">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Under Review</p>
                <h4 className="text-3xl font-black text-amber-600">{flags.filter(f => f.status === 'UNDER_REVIEW').length}</h4>
             </div>
             <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm border-l-4 border-l-emerald-500">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Resolved Today</p>
                <h4 className="text-3xl font-black text-emerald-600">{flags.filter(f => f.status === 'RESOLVED').length}</h4>
             </div>
          </div>

          {/* Flags Feed */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007AFF]"></div>
              <p className="text-stone-500 text-sm">Loading discrepancies...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {flags.length === 0 && !isLoading && (
                <div className="bg-stone-50 border border-dashed border-stone-200 rounded-3xl p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-stone-800">System is Clean</h3>
                  <p className="text-stone-500">No discrepancies detected or manual flags raised.</p>
                </div>
              )}
              
              {flags.map((flag) => (
                <DiscrepancyCard key={flag.id} flag={flag} onViewDetails={(f) => { setSelectedFlag(f); setShowDetailModal(true); }} />
              ))}
            </div>
          )}
        </div>

        {/* Create Flag Modal */}
        {showCreateModal && (
          <CreateFlagModal 
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleCreateFlag}
            isSubmitting={isSubmitting}
          />
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedFlag && (
          <FlagDetailModal 
            flag={selectedFlag}
            onClose={() => { setShowDetailModal(false); setSelectedFlag(null); }}
            onRespond={handleRespondToFlag}
            onFinalize={handleFinalizeFlag}
            isSubmitting={isSubmitting}
          />
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function CreateFlagModal({ onClose, onSubmit, isSubmitting }: any) {
  const [formData, setFormData] = useState({
    flag_type: 'MISSING_DOCUMENTATION',
    severity: 'MEDIUM',
    description: '',
    branch_id: '',
    record_date: format(new Date(), 'yyyy-MM-dd')
  });
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch('/api/finance/branches');
        const result = await response.json();
        if (result.success) setBranches(result.data || []);
      } catch (error) {
        console.error('Failed to fetch branches:', error);
      }
    };
    fetchBranches();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-bold text-stone-900 mb-6">Create Discrepancy Flag</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Branch</label>
            <select 
              value={formData.branch_id}
              onChange={(e) => setFormData({...formData, branch_id: e.target.value})}
              className="w-full px-4 py-2 border-2 border-stone-200 rounded-xl outline-none focus:border-[#007AFF]"
              required
            >
              <option value="">Select Branch</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Flag Type</label>
            <select 
              value={formData.flag_type}
              onChange={(e) => setFormData({...formData, flag_type: e.target.value})}
              className="w-full px-4 py-2 border-2 border-stone-200 rounded-xl outline-none focus:border-[#007AFF]"
              required
            >
              <option value="MISSING_DOCUMENTATION">Missing Documentation</option>
              <option value="AMOUNT_MISMATCH">Amount Mismatch</option>
              <option value="UNAUTHORIZED_TRANSACTION">Unauthorized Transaction</option>
              <option value="POLICY_VIOLATION">Policy Violation</option>
              <option value="SUSPICIOUS_ACTIVITY">Suspicious Activity</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Severity</label>
            <select 
              value={formData.severity}
              onChange={(e) => setFormData({...formData, severity: e.target.value})}
              className="w-full px-4 py-2 border-2 border-stone-200 rounded-xl outline-none focus:border-[#007AFF]"
              required
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Record Date</label>
            <input 
              type="date"
              value={formData.record_date}
              onChange={(e) => setFormData({...formData, record_date: e.target.value})}
              className="w-full px-4 py-2 border-2 border-stone-200 rounded-xl outline-none focus:border-[#007AFF]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Description</label>
            <textarea 
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-2 border-2 border-stone-200 rounded-xl outline-none focus:border-[#007AFF] min-h-[120px]"
              placeholder="Describe the discrepancy in detail..."
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border-2 border-stone-200 rounded-xl font-bold text-stone-700 hover:bg-stone-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2 bg-[#007AFF] text-white rounded-xl font-bold hover:bg-[#0056b3] disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Flag'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FlagDetailModal({ flag, onClose, onRespond, onFinalize, isSubmitting }: any) {
  const [response, setResponse] = useState('');
  const [resolution, setResolution] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'respond' | 'finalize'>('details');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-2xl font-bold text-stone-900">Discrepancy Details</h3>
            <p className="text-sm text-stone-500 mt-1">Flag ID: {flag.id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-lg">
            <XCircle className="w-6 h-6 text-stone-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-stone-200">
          <button 
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 font-bold ${activeTab === 'details' ? 'text-[#007AFF] border-b-2 border-[#007AFF]' : 'text-stone-500'}`}
          >
            Details
          </button>
          <button 
            onClick={() => setActiveTab('respond')}
            className={`px-4 py-2 font-bold ${activeTab === 'respond' ? 'text-[#007AFF] border-b-2 border-[#007AFF]' : 'text-stone-500'}`}
          >
            Respond
          </button>
          <button 
            onClick={() => setActiveTab('finalize')}
            className={`px-4 py-2 font-bold ${activeTab === 'finalize' ? 'text-[#007AFF] border-b-2 border-[#007AFF]' : 'text-stone-500'}`}
          >
            Finalize
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase mb-1">Branch</p>
                <p className="text-sm font-medium text-stone-900">{flag.branches?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase mb-1">Flag Type</p>
                <p className="text-sm font-medium text-stone-900">{flag.flag_type?.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase mb-1">Severity</p>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                  flag.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                  flag.severity === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                  flag.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {flag.severity}
                </span>
              </div>
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase mb-1">Status</p>
                <p className="text-sm font-medium text-stone-900">{flag.status?.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase mb-1">Record Date</p>
                <p className="text-sm font-medium text-stone-900">{format(new Date(flag.record_date), 'MMM d, yyyy')}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase mb-1">Created</p>
                <p className="text-sm font-medium text-stone-900">{format(new Date(flag.created_at), 'MMM d, yyyy HH:mm')}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-2">Description</p>
              <p className="text-sm text-stone-700 bg-stone-50 p-4 rounded-xl">{flag.description}</p>
            </div>
            {flag.accountant_response && (
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase mb-2">Accountant Response</p>
                <p className="text-sm text-stone-700 bg-blue-50 p-4 rounded-xl border-l-4 border-blue-500">{flag.accountant_response}</p>
              </div>
            )}
            {flag.director_resolution && (
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase mb-2">Director Resolution</p>
                <p className="text-sm text-stone-700 bg-emerald-50 p-4 rounded-xl border-l-4 border-emerald-500">{flag.director_resolution}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'respond' && (
          <div className="space-y-4">
            <p className="text-sm text-stone-600">Provide a response to this discrepancy flag (Accountant/Branch Manager):</p>
            <textarea 
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl outline-none focus:border-[#007AFF] min-h-[150px]"
              placeholder="Enter your response..."
            />
            <button 
              onClick={() => onRespond(flag.id, response)}
              disabled={!response.trim() || isSubmitting}
              className="w-full px-4 py-3 bg-[#007AFF] text-white rounded-xl font-bold hover:bg-[#0056b3] disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Response'}
            </button>
          </div>
        )}

        {activeTab === 'finalize' && (
          <div className="space-y-4">
            <p className="text-sm text-stone-600">Provide final resolution and close this flag (Director only):</p>
            <textarea 
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl outline-none focus:border-[#007AFF] min-h-[150px]"
              placeholder="Enter final resolution..."
            />
            <button 
              onClick={() => onFinalize(flag.id, resolution)}
              disabled={!resolution.trim() || isSubmitting}
              className="w-full px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Finalizing...' : 'Finalize & Close Flag'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DiscrepancyCard({ flag, onViewDetails }: any) {
  const severityColors: any = {
    LOW: 'bg-blue-50 text-blue-700 border-blue-100',
    MEDIUM: 'bg-amber-50 text-amber-700 border-amber-100',
    HIGH: 'bg-orange-50 text-orange-700 border-orange-100',
    CRITICAL: 'bg-rose-50 text-rose-700 border-rose-100'
  };

  const statusIcons: any = {
    PENDING: <Clock className="w-4 h-4 text-rose-500" />,
    UNDER_REVIEW: <MessageSquare className="w-4 h-4 text-amber-500" />,
    RESOLVED: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    ESCALATED: <ShieldAlert className="w-4 h-4 text-rose-700" />
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden hover:border-[#007AFF]/30 transition-all duration-300">
      <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4 flex-1">
          <div className={`p-3 rounded-xl ${flag.severity === 'CRITICAL' ? 'bg-rose-600' : 'bg-stone-900'} text-white shadow-lg`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${severityColors[flag.severity]}`}>
                {flag.severity}
              </span>
              <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">•</span>
              <span className="text-xs font-bold text-stone-900">{flag.branches?.name}</span>
              <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">•</span>
              <span className="text-xs font-medium text-stone-500">{format(new Date(flag.record_date), 'MMM d, yyyy')}</span>
            </div>
            <h4 className="text-lg font-bold text-stone-900">{flag.flag_type.replace('_', ' ')}</h4>
            <p className="text-stone-600 text-sm max-w-2xl">{flag.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-8 border-t lg:border-t-0 lg:border-l border-stone-100 pt-4 lg:pt-0 lg:pl-8">
          <div className="text-center">
            <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">Status</p>
            <div className="flex items-center justify-center gap-1.5 px-3 py-1 bg-stone-50 rounded-full border border-stone-100">
              {statusIcons[flag.status]}
              <span className="text-xs font-bold text-stone-700">{flag.status.replace('_', ' ')}</span>
            </div>
          </div>
          
          <div className="flex -space-x-2">
            <div title="Auditor" className="w-8 h-8 rounded-full bg-stone-100 border-2 border-white flex items-center justify-center text-xs font-bold text-stone-500">A</div>
            <div title="Accountant" className="w-8 h-8 rounded-full bg-[#007AFF] border-2 border-white flex items-center justify-center text-xs font-bold text-white">B</div>
          </div>

          <button className="p-2 hover:bg-stone-100 rounded-lg transition-colors" onClick={() => onViewDetails(flag)}>
            <MoreHorizontal className="w-5 h-5 text-stone-400" />
          </button>
        </div>
      </div>
      
      {/* Workflow Section - Preview */}
      {flag.accountant_response && (
        <div className="bg-stone-50/50 border-t border-stone-100 p-4 flex gap-4">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-4 h-4 text-[#007AFF]" />
          </div>
          <div>
            <p className="text-xs font-bold text-stone-400 uppercase mb-1">Accountant Response</p>
            <p className="text-sm text-stone-700 italic">"{flag.accountant_response}"</p>
          </div>
        </div>
      )}
    </div>
  );
}
