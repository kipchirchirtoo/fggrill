'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin, Users, Package, TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { storeAPI } from '@/lib/api';

export default function GMBranchesPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getBranchesWithStock();
      setBranches(res.branches || res || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
      setBranches([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Branch Management</h1>
              <p className="text-gray-600">View and manage all Famous Gate branches</p>
            </div>
            <Button onClick={fetchBranches} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {branches.map((branch: any) => (
              <Card key={branch.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Building2 className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{branch.name}</h3>
                      <p className="text-sm text-gray-500">{branch.code}</p>
                    </div>
                  </div>
                  {branch.is_central_warehouse && (
                    <Badge className="bg-indigo-100 text-indigo-800">Central</Badge>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    {branch.location || 'Location not set'}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Package className="h-4 w-4" />
                    Stock Value: KES {(branch.stock_value || 0).toLocaleString()}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {branches.length === 0 && !isLoading && (
            <div className="text-center py-12 text-gray-500">No branches found</div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
