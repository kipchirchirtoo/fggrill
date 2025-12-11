'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { systemAPI } from '@/lib/api';
import { Building2, RefreshCw, MapPin, Users, Bed, DollarSign, Eye } from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Branch { id: number; name: string; location: string; is_central: boolean; staff_count: number; room_count: number; occupancy_rate: number; daily_revenue: number; status: 'active' | 'inactive'; }

export default function GMBranchesPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBranches = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await systemAPI.getBranches();
      if (response.success) setBranches(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  const stats = {
    total: branches.length,
    active: branches.filter(b => b.status === 'active').length,
    totalStaff: branches.reduce((sum, b) => sum + (b.staff_count || 0), 0),
    totalRooms: branches.reduce((sum, b) => sum + (b.room_count || 0), 0),
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">All Branches</h1><p className="text-gray-500">Manage all hotel locations</p></div>
            <IOSButton variant="secondary" onClick={fetchBranches} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><Building2 className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Total Branches</p><p className="text-xl font-bold">{stats.total}</p></IOSCard>
            <IOSCard className="p-4"><Users className="h-6 w-6 text-purple-600 mb-2" /><p className="text-sm text-gray-500">Total Staff</p><p className="text-xl font-bold">{stats.totalStaff}</p></IOSCard>
            <IOSCard className="p-4"><Bed className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Total Rooms</p><p className="text-xl font-bold">{stats.totalRooms}</p></IOSCard>
            <IOSCard className="p-4"><DollarSign className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Active</p><p className="text-xl font-bold text-[#34C759]">{stats.active}</p></IOSCard>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : branches.length === 0 ? (
            <IOSCard className="p-12 text-center"><Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No branches found</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((branch) => (
                <IOSCard key={branch.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-bold text-lg">{branch.name}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" /> {branch.location}</p>
                    </div>
                    <div className="flex gap-2">
                      {branch.is_central && <IOSBadge variant="light" color="info">Central</IOSBadge>}
                      <IOSBadge variant={branch.status === 'active' ? 'success' : 'neutral'}>{branch.status}</IOSBadge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-2 bg-gray-50 rounded"><p className="text-xs text-gray-500">Staff</p><p className="font-bold">{branch.staff_count || 0}</p></div>
                    <div className="p-2 bg-gray-50 rounded"><p className="text-xs text-gray-500">Rooms</p><p className="font-bold">{branch.room_count || 0}</p></div>
                    <div className="p-2 bg-gray-50 rounded"><p className="text-xs text-gray-500">Occupancy</p><p className="font-bold">{branch.occupancy_rate || 0}%</p></div>
                    <div className="p-2 bg-gray-50 rounded"><p className="text-xs text-gray-500">Revenue</p><p className="font-bold">KES {(branch.daily_revenue || 0).toLocaleString()}</p></div>
                  </div>
                  <Link href={`/dashboard/branch-manager?branch=${branch.id}`}>
                    <IOSButton variant="secondary" className="w-full" leftIcon={<Eye />}>View Details</IOSButton>
                  </Link>
                </IOSCard>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
