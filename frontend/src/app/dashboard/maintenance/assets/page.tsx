'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Settings, RefreshCw, Search, Plus, Wrench, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';
import { maintenanceAPI } from '@/lib/api';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Asset { id: string; name: string; type: string; location: string; status: 'operational' | 'needs_maintenance' | 'under_repair' | 'retired'; last_maintenance?: string; next_maintenance?: string; }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  operational: { label: 'Operational', color: 'text-green-700', bg: 'bg-green-100' },
  needs_maintenance: { label: 'Needs Maintenance', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  under_repair: { label: 'Under Repair', color: 'text-blue-700', bg: 'bg-blue-100' },
  retired: { label: 'Retired', color: 'text-gray-700', bg: 'bg-gray-100' },
};

export default function MaintenanceAssetsPage() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchAssets = async () => {
    setIsLoading(true);
    try {
      const response = await maintenanceAPI.getRequests();
      if (response.success) {
        // Map maintenance requests to assets format
        const mappedAssets = (response.data || []).map((r: any) => ({
          id: r.id,
          name: r.title || r.description || 'Asset',
          type: r.category || 'General',
          location: r.location || 'Unknown',
          status: r.status === 'completed' ? 'operational' : r.status === 'in_progress' ? 'under_repair' : 'needs_maintenance',
          last_maintenance: r.completed_at,
          next_maintenance: r.scheduled_date,
        }));
        setAssets(mappedAssets);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
      setAssets([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const filteredAssets = assets.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: assets.length,
    operational: assets.filter(a => a.status === 'operational').length,
    needsMaintenance: assets.filter(a => a.status === 'needs_maintenance').length,
    underRepair: assets.filter(a => a.status === 'under_repair').length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.MAINTENANCE, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Assets</h1><p className="text-gray-500">Manage equipment and assets</p></div>
            <IOSButton leftIcon={<Plus />}>Add Asset</IOSButton>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><Settings className="h-6 w-6 text-gray-600 mb-2" /><p className="text-sm text-gray-500">Total Assets</p><p className="text-xl font-bold">{stats.total}</p></IOSCard>
            <IOSCard className="p-4"><CheckCircle className="h-6 w-6 text-gray-600 mb-2" /><p className="text-sm text-gray-500">Operational</p><p className="text-xl font-bold">{stats.operational}</p></IOSCard>
            <IOSCard className="p-4"><AlertTriangle className="h-6 w-6 text-gray-600 mb-2" /><p className="text-sm text-gray-500">Needs Maintenance</p><p className="text-xl font-bold">{stats.needsMaintenance}</p></IOSCard>
            <IOSCard className="p-4"><Wrench className="h-6 w-6 text-gray-600 mb-2" /><p className="text-sm text-gray-500">Under Repair</p><p className="text-xl font-bold">{stats.underRepair}</p></IOSCard>
          </div>

          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input placeholder="Search assets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
              <div className="flex gap-2">
                {['all', 'operational', 'needs_maintenance', 'under_repair'].map((status) => (
                  <IOSButton key={status} variant={statusFilter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(status)}>
                    {status === 'all' ? 'All' : statusConfig[status]?.label || status}
                  </IOSButton>
                ))}
              </div>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredAssets.length === 0 ? (
            <IOSCard className="p-12 text-center"><Settings className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No assets found</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {filteredAssets.map((asset) => {
                const status = statusConfig[asset.status];
                return (
                  <IOSCard key={asset.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold">{asset.name}</p>
                        <p className="text-sm text-gray-500">{asset.type} • {asset.location}</p>
                      </div>
                      <IOSBadge className={`${status.bg} ${status.color}`}>{status.label}</IOSBadge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {asset.last_maintenance && (
                        <div className="p-2 bg-gray-50 rounded">
                          <p className="text-gray-500">Last Maintenance</p>
                          <p className="font-medium">{new Date(asset.last_maintenance).toLocaleDateString()}</p>
                        </div>
                      )}
                      {asset.next_maintenance && (
                        <div className="p-2 bg-gray-50 rounded">
                          <p className="text-gray-500">Next Maintenance</p>
                          <p className="font-medium">{new Date(asset.next_maintenance).toLocaleDateString()}</p>
                        </div>
                      )}
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
