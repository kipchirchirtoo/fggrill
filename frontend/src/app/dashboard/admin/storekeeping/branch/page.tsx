'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { storeAPI, systemAPI } from '@/lib/api';
import { Building2, RefreshCw, Package, AlertTriangle } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Branch { id: number; name: string; location: string; totalItems: number; lowStock: number; }

export default function AdminBranchStorePage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBranches = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getBranchesWithStock();
      if (response.success) setBranches(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Branch Stores</h1><p className="text-gray-500">Stock levels by branch</p></div>
            <IOSButton variant="secondary" onClick={fetchBranches} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : branches.length === 0 ? (
            <IOSCard className="p-12 text-center"><Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No branches</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((branch) => (
                <IOSCard key={branch.id} className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-100 rounded-ios-lg"><Building2 className="h-6 w-6 text-[#007AFF]" /></div>
                    <div className="flex-1">
                      <p className="font-bold text-lg">{branch.name}</p>
                      <p className="text-sm text-gray-500">{branch.location}</p>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="flex items-center gap-2"><Package className="h-4 w-4 text-[#007AFF]" /><span className="text-sm">{branch.totalItems || 0} items</span></div>
                        <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-600" /><span className="text-sm text-yellow-600">{branch.lowStock || 0} low</span></div>
                      </div>
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
