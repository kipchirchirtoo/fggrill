'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Download, Calendar, Package, TrendingDown, DollarSign } from 'lucide-react';
import { storeAPI } from '@/lib/api';

export default function BranchReportsPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchSummary(); }, []);

  const fetchSummary = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getDailyUsageSummary();
      setSummary(res.data?.[0] || null);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Branch Reports</h1>
              <p className="text-gray-600">Stock and usage reports for your branch</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-500">Items Tracked</p>
                  <p className="text-xl font-bold">{summary?.items_tracked || 0}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-gray-500">Total Consumed</p>
                  <p className="text-xl font-bold">{summary?.total_consumed || 0}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-sm text-gray-500">Total Spoilt/Lost</p>
                  <p className="text-xl font-bold text-red-600">{(summary?.total_spoilt || 0) + (summary?.total_lost || 0)}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-sm text-gray-500">Loss Value</p>
                  <p className="text-xl font-bold text-red-600">KES {(summary?.total_loss_value || 0).toLocaleString()}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Report Types */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Available Reports</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3 mb-2">
                  <Package className="h-6 w-6 text-blue-500" />
                  <h3 className="font-medium">Stock Movement Report</h3>
                </div>
                <p className="text-sm text-gray-500 mb-3">Track all stock in and out movements</p>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-2" /> Generate
                </Button>
              </div>
              <div className="p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3 mb-2">
                  <BarChart3 className="h-6 w-6 text-green-500" />
                  <h3 className="font-medium">Kitchen Usage Report</h3>
                </div>
                <p className="text-sm text-gray-500 mb-3">Consumption and wastage analysis</p>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-2" /> Generate
                </Button>
              </div>
              <div className="p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="h-6 w-6 text-purple-500" />
                  <h3 className="font-medium">Daily Summary</h3>
                </div>
                <p className="text-sm text-gray-500 mb-3">Daily stock and activity summary</p>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-2" /> Generate
                </Button>
              </div>
              <div className="p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="h-6 w-6 text-amber-500" />
                  <h3 className="font-medium">Loss Report</h3>
                </div>
                <p className="text-sm text-gray-500 mb-3">Spoilage and loss analysis</p>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-2" /> Generate
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
