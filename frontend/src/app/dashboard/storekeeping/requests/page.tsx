'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { 
  ClipboardList, RefreshCw, Eye, Check, X, Clock,
  Building2, Package, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface StockRequest {
  id: string;
  request_number: string;
  branch_id: number;
  request_type: string;
  priority: string;
  status: string;
  reason?: string;
  created_at: string;
  branch?: {
    id: number;
    name: string;
    code: string;
    location: string;
  };
  items?: any[];
}

export default function StockRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Try pending first, then all
      const pendingRes = await fetch(`${API_URL}/api/store/stock-requests/pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setRequests(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-[#F2F2F7]0 text-white';
      case 'HIGH': return 'bg-[#F2F2F7] text-white';
      case 'NORMAL': return 'bg-[#F2F2F7]0 text-white';
      case 'LOW': return 'bg-[#8E8E93] text-white';
      default: return 'bg-[#8E8E93] text-white';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-[#F2F2F7] text-[#3C3C43]';
      case 'UNDER_REVIEW': return 'bg-[#F2F2F7] text-[#000000]';
      case 'APPROVED': return 'bg-[#F2F2F7] text-[#000000]';
      case 'REJECTED': return 'bg-[#F2F2F7] text-[#000000]';
      case 'DISPATCHED': return 'bg-[#F2F2F7] text-[#3C3C43]';
      case 'DELIVERED': return 'bg-[#E5E5EA] text-[#000000]';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredRequests = requests.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'pending') return ['PENDING', 'UNDER_REVIEW'].includes(r.status);
    if (filter === 'approved') return r.status === 'APPROVED';
    if (filter === 'rejected') return r.status === 'REJECTED';
    return true;
  });

  const pendingCount = requests.filter(r => ['PENDING', 'UNDER_REVIEW'].includes(r.status)).length;

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER, UserRole.HOUSEKEEPING, UserRole.HOUSEKEEPING_SUPERVISOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Stock Requests</h1>
              <p className="text-gray-600">View and manage stock requests from branches</p>
            </div>
            <IOSButton variant="outline" onClick={fetchRequests} leftIcon={<RefreshCw />}>Refresh
            </IOSButton>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <IOSCard className="p-4 cursor-pointer hover:bg-gray-50" onClick={() => setFilter('all')}>
              <div className="flex items-center gap-3">
                <ClipboardList className="h-8 w-8 text-[#8E8E93]0" />
                <div>
                  <p className="text-sm text-gray-500">Total Requests</p>
                  <p className="text-2xl font-bold">{requests.length}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4 cursor-pointer hover:bg-[#F2F2F7]" onClick={() => setFilter('pending')}>
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-[#3C3C43]" />
                <div>
                  <p className="text-sm text-gray-500">Pending Review</p>
                  <p className="text-2xl font-bold text-[#3C3C43]">{pendingCount}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4 cursor-pointer hover:bg-[#F2F2F7]" onClick={() => setFilter('approved')}>
              <div className="flex items-center gap-3">
                <Check className="h-8 w-8 text-[#8E8E93]0" />
                <div>
                  <p className="text-sm text-gray-500">Approved</p>
                  <p className="text-2xl font-bold text-[#3C3C43]">
                    {requests.filter(r => r.status === 'APPROVED').length}
                  </p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4 cursor-pointer hover:bg-[#F2F2F7]" onClick={() => setFilter('rejected')}>
              <div className="flex items-center gap-3">
                <X className="h-8 w-8 text-[#8E8E93]0" />
                <div>
                  <p className="text-sm text-gray-500">Rejected</p>
                  <p className="text-2xl font-bold text-[#3C3C43]">
                    {requests.filter(r => r.status === 'REJECTED').length}
                  </p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
              <IOSButton
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </IOSButton>
            ))}
          </div>

          {/* Requests List */}
          <IOSCard>
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(60,60,67,0.12)] mx-auto"></div>
                <p className="mt-4 text-gray-500">Loading requests...</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No stock requests found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRequests.map((request) => (
                      <tr key={request.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 font-mono text-sm">{request.request_number}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            <div>
                              <p className="font-medium">{request.branch?.name || 'Unknown'}</p>
                              <p className="text-xs text-gray-500">{request.branch?.location || ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">{request.request_type}</td>
                        <td className="px-4 py-4">
                          <IOSBadge className={getPriorityColor(request.priority)}>
                            {request.priority}
                          </IOSBadge>
                        </td>
                        <td className="px-4 py-4">
                          <IOSBadge className={getStatusColor(request.status)}>
                            {request.status}
                          </IOSBadge>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <Package className="h-4 w-4 text-gray-400" />
                            <span>{request.items?.length || 0} items</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {formatDate(request.created_at)}
                        </td>
                        <td className="px-4 py-4">
                          <IOSButton size="sm" variant="outline" leftIcon={<Eye />}>View</IOSButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </IOSCard>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
