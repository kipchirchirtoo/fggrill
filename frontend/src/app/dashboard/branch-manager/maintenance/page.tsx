'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { maintenanceAPI } from '@/lib/api';
import { Wrench, RefreshCw, Clock, CheckCircle, AlertTriangle, Plus, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Request { id: string; title: string; location: string; priority: string; status: string; created_at: string; }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-100' },
  completed: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
};

export default function BranchMaintenancePage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await maintenanceAPI.getRequests(user?.branch_id || undefined);
      if (response.success) setRequests(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [user?.branch_id]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const stats = { pending: requests.filter(r => r.status === 'pending').length, inProgress: requests.filter(r => r.status === 'in_progress').length, urgent: requests.filter(r => r.priority === 'urgent').length };
  const priorityColors: Record<string, string> = { urgent: 'bg-[#FF3B30]', high: 'bg-orange-500', normal: 'bg-[#007AFF]', low: 'bg-[#8E8E93]' };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Maintenance</h1><p className="text-gray-500">Repair requests</p></div>
            <IOSButton variant="secondary" onClick={fetchRequests}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><Clock className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending</p><p className="text-xl font-bold text-yellow-600">{stats.pending}</p></IOSCard>
            <IOSCard className="p-4"><Wrench className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">In Progress</p><p className="text-xl font-bold text-[#007AFF]">{stats.inProgress}</p></IOSCard>
            <IOSCard className="p-4"><AlertTriangle className="h-6 w-6 text-[#FF3B30] mb-2" /><p className="text-sm text-gray-500">Urgent</p><p className="text-xl font-bold text-[#FF3B30]">{stats.urgent}</p></IOSCard>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : requests.length === 0 ? (
            <IOSCard className="p-12 text-center"><Wrench className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No maintenance requests</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => {
                const status = statusConfig[request.status] || statusConfig.pending;
                return (
                  <IOSCard key={request.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-10 rounded ${priorityColors[request.priority] || priorityColors.normal}`} />
                        <div>
                          <p className="font-bold">{request.title}</p>
                          <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" /> {request.location}</p>
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
