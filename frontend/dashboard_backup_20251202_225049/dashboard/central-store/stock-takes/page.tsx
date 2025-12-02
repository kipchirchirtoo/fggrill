'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { storeAPI } from '@/lib/api';
import { ClipboardList, RefreshCw, Plus, Calendar, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface StockTake { id: string; reference: string; status: string; items_count: number; variance_count: number; created_at: string; completed_at?: string; }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  in_progress: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-100' },
  completed: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-100' },
};

export default function CentralStockTakesPage() {
  const { user } = useAuth();
  const [stockTakes, setStockTakes] = useState<StockTake[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStockTakes = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getStockTakes();
      if (response.success) setStockTakes(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchStockTakes(); }, [fetchStockTakes]);

  const handleStartStockTake = async () => {
    try {
      await storeAPI.createStockTake({ branch_id: 1, take_type: 'full' });
      toast.success('Stock take started');
      fetchStockTakes();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Stock Takes</h1><p className="text-gray-500">Inventory audits</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchStockTakes}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
              <IOSButton onClick={handleStartStockTake}><Plus className="h-4 w-4 mr-2" /> Start Stock Take</IOSButton>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : stockTakes.length === 0 ? (
            <IOSCard className="p-12 text-center"><ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No stock takes</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {stockTakes.map((st) => {
                const status = statusConfig[st.status] || statusConfig.in_progress;
                return (
                  <IOSCard key={st.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-ios-lg bg-blue-100 flex items-center justify-center"><ClipboardList className="h-6 w-6 text-blue-600" /></div>
                        <div>
                          <p className="font-bold">{st.reference}</p>
                          <p className="text-sm text-gray-500">{st.items_count} items</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(st.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {st.variance_count > 0 && <span className="text-sm text-yellow-600 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> {st.variance_count} variances</span>}
                        <IOSBadge className={`${status.bg} ${status.color}`}>{status.label}</IOSBadge>
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
