'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Package, RefreshCw, Plus, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { storeAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

export default function BranchManagerRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchRequests(); }, [user]);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getBranchRequests();
      setRequests(res.requests || res || []);
    } catch (error) { console.error('Error:', error); } 
    finally { setIsLoading(false); }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      case 'PENDING': return 'bg-amber-100 text-amber-800';
      case 'FULFILLED': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Stock Requests</h1>
              <p className="text-gray-600">Manage your branch stock requests</p>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard/storekeeping/requests">
                <Button><Plus className="h-4 w-4 mr-2" /> New Request</Button>
              </Link>
              <Button onClick={fetchRequests} variant="outline">
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 bg-amber-50">
              <Clock className="h-6 w-6 text-amber-600 mb-2" />
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-sm text-amber-700">Pending</p>
            </Card>
            <Card className="p-4 bg-green-50">
              <CheckCircle className="h-6 w-6 text-green-600 mb-2" />
              <p className="text-2xl font-bold">{approvedCount}</p>
              <p className="text-sm text-green-700">Approved</p>
            </Card>
            <Card className="p-4">
              <Package className="h-6 w-6 text-indigo-600 mb-2" />
              <p className="text-2xl font-bold">{requests.length}</p>
              <p className="text-sm text-gray-600">Total Requests</p>
            </Card>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requests.map((r: any) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{r.request_number || `REQ-${r.id}`}</td>
                      <td className="px-4 py-3 text-gray-600">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{r.items_count || r.items?.length || 0} items</td>
                      <td className="px-4 py-3">
                        <Badge className={getStatusBadge(r.status)}>{r.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {requests.length === 0 && (
              <div className="p-8 text-center text-gray-500">{isLoading ? 'Loading...' : 'No requests found'}</div>
            )}
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
