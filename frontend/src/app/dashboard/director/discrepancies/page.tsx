'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UserRole } from '@/lib/user-roles';
import { financeAPI } from '@/lib/api/finance';
import { 
  AlertTriangle, CheckCircle2, Clock, MessageSquare, 
  ShieldAlert, User, Calendar, Filter, Search, MoreHorizontal
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function DiscrepancyControlPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [flags, setFlags] = useState<any[]>([]);
  const [filter, setFilter] = useState({ status: '', severity: '' });

  const fetchFlags = async () => {
    setIsLoading(true);
    try {
      const res = await financeAPI.director.getDiscrepancies(filter);
      if (res.success) {
        setFlags(res.data || []);
      } else {
        toast.error(res.message || 'Failed to fetch discrepancies');
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
              <button className="bg-[#007AFF] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-[#0056b3] transition-colors">
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
                <DiscrepancyCard key={flag.id} flag={flag} />
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function DiscrepancyCard({ flag }: any) {
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

          <button className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
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
