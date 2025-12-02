'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { storeAPI } from '@/lib/api';
import { ClipboardList, RefreshCw, CheckCircle, XCircle, Clock, Package } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface StockRequest { id: string; request_number: string; branch_name: string; status: string; priority: string; items_count: number; created_at: string; }

export default function AdminRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getPendingRequests();
      if (response.success) setRequests(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (id: string) => {
    try {
      await storeAPI.reviewStockRequest(id, { action: 'APPROVE' });
      toast.success('Request approved');
      fetchRequests();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const handleReject = async (id: string) => {
    try {
      await storeAPI.reviewStockRequest(id, { action: 'REJECT', notes: 'Rejected by admin' });
      toast.success('Request rejected');
      fetchRequests();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Stock Requests</h1><p className="text-gray-500">Pending requests from branches</p></div>
            <IOSButton variant="secondary" onClick={fetchRequests}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <IOSCard className="p-4"><Clock className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending</p><p className="text-xl font-bold text-yellow-600">{requests.length}</p></IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : requests.length === 0 ? (
            <IOSCard className="p-12 text-center"><ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No pending requests</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <IOSCard key={request.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-ios-lg bg-blue-100 flex items-center justify-center"><Package className="h-6 w-6 text-[#007AFF]" /></div>
                      <div>
                        <p className="font-bold">#{request.request_number}</p>
                        <p className="text-sm text-gray-500">{request.branch_name} • {request.items_count} items</p>
                        <p className="text-xs text-gray-400">{new Date(request.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {request.priority === 'urgent' && <IOSBadge variant="error">Urgent</IOSBadge>}
                      <IOSButton size="sm" variant="secondary" onClick={() => handleReject(request.id)}><XCircle className="h-4 w-4 mr-1" /> Reject</IOSButton>
                      <IOSButton size="sm" onClick={() => handleApprove(request.id)}><CheckCircle className="h-4 w-4 mr-1" /> Approve</IOSButton>
                    </div>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
