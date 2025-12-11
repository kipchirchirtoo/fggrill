'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { storeAPI } from '@/lib/api';
import { ClipboardList, RefreshCw, Check, X, Clock, Building2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface StockRequest { id: string; request_number: string; branch_name: string; status: string; priority: string; items_count: number; created_at: string; }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  approved: { label: 'Approved', color: 'text-blue-700', bg: 'bg-blue-100' },
  fulfilled: { label: 'Fulfilled', color: 'text-green-700', bg: 'bg-green-100' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-100' },
};

export default function CentralRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = statusFilter === 'pending' ? await storeAPI.getPendingRequests() : await storeAPI.getBranchRequests();
      if (response.success) {
        const data = response.data || [];
        setRequests(statusFilter === 'all' ? data : data.filter((r: StockRequest) => r.status === statusFilter));
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleReview = async (id: string, action: 'APPROVE' | 'REJECT') => {
    try {
      await storeAPI.reviewStockRequest(id, { action });
      toast.success(`Request ${action.toLowerCase()}d`);
      fetchRequests();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const stats = { pending: requests.filter(r => r.status === 'pending').length, approved: requests.filter(r => r.status === 'approved').length };

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Stock Requests</h1><p className="text-gray-500">Branch stock requests</p></div>
            <IOSButton variant="secondary" onClick={fetchRequests} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <IOSCard className="p-4"><Clock className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending</p><p className="text-xl font-bold text-yellow-600">{stats.pending}</p></IOSCard>
            <IOSCard className="p-4"><Check className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Approved</p><p className="text-xl font-bold text-[#007AFF]">{stats.approved}</p></IOSCard>
          </div>

          <div className="flex gap-2">
            {['pending', 'approved', 'fulfilled', 'rejected'].map((status) => (
              <IOSButton key={status} variant={statusFilter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(status)}>
                {statusConfig[status]?.label || status}
              </IOSButton>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : requests.length === 0 ? (
            <IOSCard className="p-12 text-center"><ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No requests</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => {
                const status = statusConfig[request.status] || statusConfig.pending;
                return (
                  <IOSCard key={request.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-ios-lg bg-blue-100 flex items-center justify-center"><Building2 className="h-6 w-6 text-[#007AFF]" /></div>
                        <div>
                          <p className="font-bold">#{request.request_number}</p>
                          <p className="text-sm text-gray-500">{request.branch_name} • {request.items_count} items</p>
                          <p className="text-xs text-gray-400" suppressHydrationWarning>{new Date(request.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {request.priority === 'urgent' && <IOSBadge variant="light" color="danger">Urgent</IOSBadge>}
                        <IOSBadge className={`${status.bg} ${status.color}`}>{status.label}</IOSBadge>
                        {request.status === 'pending' && (
                          <div className="flex gap-2">
                            <IOSButton size="sm" onClick={() => handleReview(request.id, 'APPROVE')}><Check className="h-4 w-4" /></IOSButton>
                            <IOSButton size="sm" variant="destructive" onClick={() => handleReview(request.id, 'REJECT')}><X className="h-4 w-4" /></IOSButton>
                          </div>
                        )}
                      </div>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
