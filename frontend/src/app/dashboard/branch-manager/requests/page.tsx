'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { storeAPI } from '@/lib/api';
import { ShoppingCart, RefreshCw, Clock, CheckCircle, XCircle, Package, Plus } from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface StockRequest { id: string; request_number: string; status: string; priority: string; items_count: number; created_at: string; }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  UNDER_REVIEW: { label: 'Reviewing', color: 'text-orange-700', bg: 'bg-orange-100' },
  APPROVED: { label: 'Approved', color: 'text-blue-700', bg: 'bg-blue-100' },
  PARTIALLY_APPROVED: { label: 'Partial', color: 'text-blue-600', bg: 'bg-blue-50' },
  DISPATCHED: { label: 'Dispatched', color: 'text-purple-700', bg: 'bg-purple-100' },
  DELIVERED: { label: 'Fulfilled', color: 'text-green-700', bg: 'bg-green-100' },
  FULFILLED: { label: 'Fulfilled', color: 'text-green-700', bg: 'bg-green-100' },
  REJECTED: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-100' },
  CANCELLED: { label: 'Cancelled', color: 'text-gray-700', bg: 'bg-gray-100' },
};

export default function BranchRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getBranchRequests();
      if (response.success && Array.isArray(response.data)) {
        // Map backend response to StockRequest interface
        const mappedRequests: StockRequest[] = response.data.map((record: any) => ({
          id: record.id,
          request_number: record.request_number,
          status: record.status.toUpperCase(),
          priority: record.priority,
          items_count: record.items ? record.items.length : 0,
          created_at: record.created_at
        }));
        setRequests(mappedRequests);
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error('Error:', error);
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, []); // Fetch all once or on refresh

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const stats = {
    pending: requests.filter(r => r.status === 'PENDING' || r.status === 'UNDER_REVIEW').length,
    approved: requests.filter(r => r.status === 'APPROVED' || r.status === 'PARTIALLY_APPROVED' || r.status === 'DISPATCHED').length
  };

  const filteredRequests = requests.filter(request => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'PENDING') return request.status === 'PENDING' || request.status === 'UNDER_REVIEW';
    if (statusFilter === 'APPROVED') return request.status === 'APPROVED' || request.status === 'PARTIALLY_APPROVED' || request.status === 'DISPATCHED';
    return request.status === statusFilter;
  });

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.CENTRAL_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Stock Requests</h1><p className="text-gray-500">Request stock from central</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchRequests} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <Link href="/dashboard/branch-manager/stock"><IOSButton leftIcon={<Plus />}>New Request</IOSButton></Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <IOSCard className="p-4"><Clock className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending</p><p className="text-xl font-bold text-yellow-600">{stats.pending}</p></IOSCard>
            <IOSCard className="p-4"><CheckCircle className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Approved</p><p className="text-xl font-bold text-[#007AFF]">{stats.approved}</p></IOSCard>
          </div>

          <div className="flex gap-2">
            {['all', 'PENDING', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'REJECTED'].map((status) => (
              <IOSButton key={status} variant={statusFilter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(status)}>
                {status === 'all' ? 'All' : statusConfig[status]?.label || status}
              </IOSButton>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredRequests.length === 0 ? (
            <IOSCard className="p-12 text-center"><ShoppingCart className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No requests</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((request) => {
                const status = statusConfig[request.status] || statusConfig.PENDING;
                return (
                  <IOSCard key={request.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-ios-lg bg-blue-100 flex items-center justify-center"><Package className="h-6 w-6 text-[#007AFF]" /></div>
                        <div>
                          <p className="font-bold">#{request.request_number}</p>
                          <p className="text-sm text-gray-500">{request.items_count} items • {new Date(request.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <IOSBadge className={`${status.bg} ${status.color}`}>{status.label}</IOSBadge>
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
