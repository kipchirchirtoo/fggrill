'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { storeAPI, stockTakeAPI } from '@/lib/api';
import { ClipboardList, RefreshCw, Plus, Calendar, User, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { API_URL } from '@/lib/config';

interface StockTake {
  id: string;
  count_number: string;
  count_type: string;
  status: string;
  counted_by: string;
  count_date: string;
  created_at: string;
  notes?: string;
}

export default function BranchStockTakesPage() {
  const { user } = useAuth();
  const [stockTakes, setStockTakes] = useState<StockTake[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStockTakes = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await stockTakeAPI.getStockTakes();
      if (response.success) setStockTakes(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchStockTakes(); }, [fetchStockTakes]);

  const handleStartStockTake = async () => {
    try {
      await stockTakeAPI.createStockTake({
        branch_id: user?.branch_id || (user as any)?.branchId || 1,
        take_type: 'daily'
      });
      toast.success('Stock take session initialized');
      fetchStockTakes();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const handleDownloadWorksheet = async () => {
    toast.info('Preparing worksheet...');
    try {
      const branchId = user?.branch_id || (user as any)?.branchId || 1;
      const result = await stockTakeAPI.downloadWorksheet(undefined, { branch_id: Number(branchId) });
      if (!result.success) throw new Error(result.message);
      toast.success('Download complete');
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error(error.message || 'Failed to download worksheet');
    }
  };

  const statusConfig: Record<string, { color: string; bg: string }> = {
    draft: { color: 'text-orange-700', bg: 'bg-orange-100' },
    submitted: { color: 'text-blue-700', bg: 'bg-blue-100' },
    approved: { color: 'text-green-700', bg: 'bg-green-100' },
    rejected: { color: 'text-red-700', bg: 'bg-red-100' },
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Stock Take History</h1><p className="text-gray-500">View and manage branch inventory audits</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchStockTakes} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton variant="secondary" onClick={handleDownloadWorksheet} leftIcon={<FileDown />}>Download Worksheet</IOSButton>
              <IOSButton onClick={handleStartStockTake} leftIcon={<Plus />}>Start New Count</IOSButton>
            </div>

          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : stockTakes.length === 0 ? (
            <IOSCard className="p-12 text-center"><ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No stock takes recorded. Click 'Start New Count' to begin.</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {stockTakes.map((take) => {
                const status = statusConfig[take.status] || statusConfig.draft;
                return (
                  <IOSCard key={take.id} className="p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => window.location.href = `/dashboard/branch-store/stock-takes/${take.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-ios-lg bg-gray-100 flex items-center justify-center"><ClipboardList className="h-6 w-6 text-gray-600" /></div>
                        <div>
                          <p className="font-bold">{take.count_number || `ST-${take.id.substring(0, 8).toUpperCase()}`}</p>
                          <p className="text-sm text-gray-500 capitalize">{take.count_type} Audit</p>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(take.count_date || take.created_at).toLocaleDateString()}</p>
                            {take.notes && <p className="text-xs text-gray-400 italic truncate max-w-[200px]">"{take.notes}"</p>}
                          </div>
                        </div>
                      </div>
                      <IOSBadge className={`${status.bg} ${status.color} px-3 py-1`}>{take.status?.replace('_', ' ')}</IOSBadge>
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
