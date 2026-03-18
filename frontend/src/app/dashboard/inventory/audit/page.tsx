'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import {
  ClipboardCheck,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import type { StockAudit, StockAuditItem, Branch } from '@/types/inventory.types';


export default function AuditPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showNewAuditModal, setShowNewAuditModal] = useState(false);
  const [audits, setAudits] = useState<StockAudit[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch audit data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = {
          'Authorization': `Bearer ${token}`
        };

        // Fetch audits
        const auditsResponse = await fetch(`${API_URL}/api/inventory/audits`, { headers });
        if (!auditsResponse.ok) throw new Error('Failed to fetch audits');
        const auditsData = await auditsResponse.json();
        setAudits(auditsData.data);

        // Fetch branches
        const branchesResponse = await fetch(`${API_URL}/api/branches`, { headers });
        if (!branchesResponse.ok) throw new Error('Failed to fetch branches');
        const branchesData = await branchesResponse.json();
        setBranches(branchesData.data);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        toast.error('Failed to load audit data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate statistics
  const stats = {
    totalAudits: audits.length,
    pendingAudits: audits.filter(a => a.status === 'pending').length,
    inProgressAudits: audits.filter(a => a.status === 'in-progress').length,
    completedAudits: audits.filter(a => a.status === 'completed').length
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Inventory Audits</h1>
            <button
              onClick={() => setShowNewAuditModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#3C3C43] text-white rounded-ios-lg hover:bg-[#3C3C43]"
            >
              <Plus className="h-4 w-4" />
              New Audit
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-[#FFFFFF] rounded-xl shadow-none 0_1px_3px_rgba(0,0,0,0.04)] p-6 border border-gray-100">
              <div className="flex items-center gap-4">
                <ClipboardCheck className="h-8 w-8 text-[#3C3C43]" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Audits</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalAudits}</p>
                </div>
              </div>
            </div>
            <div className="bg-[#FFFFFF] rounded-xl shadow-none 0_1px_3px_rgba(0,0,0,0.04)] p-6 border border-gray-100">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-8 w-8 text-[#3C3C43]" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pendingAudits}</p>
                </div>
              </div>
            </div>
            <div className="bg-[#FFFFFF] rounded-xl shadow-none 0_1px_3px_rgba(0,0,0,0.04)] p-6 border border-gray-100">
              <div className="flex items-center gap-4">
                <ClipboardCheck className="h-8 w-8 text-[#3C3C43]" />
                <div>
                  <p className="text-sm font-medium text-gray-500">In Progress</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.inProgressAudits}</p>
                </div>
              </div>
            </div>
            <div className="bg-[#FFFFFF] rounded-xl shadow-none 0_1px_3px_rgba(0,0,0,0.04)] p-6 border border-gray-100">
              <div className="flex items-center gap-4">
                <CheckCircle className="h-8 w-8 text-[#3C3C43]" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.completedAudits}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-[#FFFFFF] rounded-xl shadow-none 0_1px_3px_rgba(0,0,0,0.04)] border border-gray-100">
            {/* Search and Filter */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search audits..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-[#E5E5EA] rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="pl-9 pr-8 py-2 border border-[#E5E5EA] rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent appearance-none bg-[#FFFFFF]"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Audit #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started By</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {audits
                    .filter(
                      audit =>
                        (filterStatus === 'all' || audit.status === filterStatus) &&
                        (searchTerm === '' ||
                          audit.auditNumber.toLowerCase().includes(searchTerm.toLowerCase()))
                    )
                    .map(audit => {
                      const branch = branches.find(b => b.id === audit.branchId);
                      return (
                        <tr key={audit.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {audit.auditNumber}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{branch?.name}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                audit.status === 'completed'
                                  ? 'bg-[#F2F2F7] text-[#000000]'
                                  : audit.status === 'in-progress'
                                  ? 'bg-[#F2F2F7] text-[#000000]'
                                  : 'bg-[#F2F2F7] text-[#3C3C43]'
                              }`}
                            >
                              {audit.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{audit.startedBy}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {new Date(audit.startedAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <button className="text-[#3C3C43] hover:text-[#3C3C43]">View</button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* TODO: Add modals for new audit and audit details */}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
