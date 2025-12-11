'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { storeAPI } from '@/lib/api';
import { TrendingDown, RefreshCw, Package, Calendar, User } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface StockOut { id: string; item_name: string; quantity: number; department: string; recorded_by: string; date: string; }

export default function BranchStockOutPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<StockOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getStockMovements();
      if (response.success) {
        // Filter for stock out movements
        const stockOuts = (response.data || []).filter((m: any) => m.movement_type === 'out');
        setRecords(stockOuts);
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.BRANCH_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Stock Out Records</h1><p className="text-gray-500">Items issued from stock</p></div>
            <IOSButton variant="secondary" onClick={fetchRecords} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : records.length === 0 ? (
            <IOSCard className="p-12 text-center"><TrendingDown className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No stock out records</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <IOSCard key={record.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-ios-lg bg-red-100 flex items-center justify-center"><TrendingDown className="h-6 w-6 text-[#FF3B30]" /></div>
                      <div>
                        <p className="font-bold">{record.item_name}</p>
                        <p className="text-sm text-gray-500">{record.department}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-2"><User className="h-3 w-3" /> {record.recorded_by} <Calendar className="h-3 w-3 ml-2" /> {new Date(record.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <p className="font-bold text-lg text-[#FF3B30]">-{record.quantity}</p>
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
