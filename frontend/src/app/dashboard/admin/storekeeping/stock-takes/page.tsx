'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { storeAPI } from '@/lib/api';
import { ClipboardList, RefreshCw, Calendar, User, CheckCircle } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface StockTake { id: string; take_number: string; branch_name: string; take_type: string; status: string; created_by: string; created_at: string; completed_at?: string; }

export default function AdminStockTakesPage() {
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

  const statusConfig: Record<string, { color: string; bg: string }> = {
    in_progress: { color: 'text-blue-700', bg: 'bg-blue-100' },
    completed: { color: 'text-green-700', bg: 'bg-green-100' },
    cancelled: { color: 'text-red-700', bg: 'bg-red-100' },
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Stock Takes</h1><p className="text-gray-500">Inventory audits</p></div>
            <IOSButton variant="secondary" onClick={fetchStockTakes}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : stockTakes.length === 0 ? (
            <IOSCard className="p-12 text-center"><ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No stock takes</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {stockTakes.map((take) => {
                const status = statusConfig[take.status] || statusConfig.in_progress;
                return (
                  <IOSCard key={take.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-ios-lg bg-orange-100 flex items-center justify-center"><ClipboardList className="h-6 w-6 text-orange-600" /></div>
                        <div>
                          <p className="font-bold">#{take.take_number}</p>
                          <p className="text-sm text-gray-500">{take.branch_name} • {take.take_type}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-2"><User className="h-3 w-3" /> {take.created_by} <Calendar className="h-3 w-3 ml-2" /> {new Date(take.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <IOSBadge className={`${status.bg} ${status.color}`}>{take.status?.replace('_', ' ')}</IOSBadge>
                        {take.status === 'completed' && take.completed_at && (
                          <span className="text-xs text-gray-400 flex items-center gap-1"><CheckCircle className="h-3 w-3 text-[#34C759]" /> {new Date(take.completed_at).toLocaleDateString()}</span>
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
