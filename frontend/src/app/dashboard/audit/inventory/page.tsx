'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { auditAPI } from '@/lib/api';
import { Package, RefreshCw, Search, AlertTriangle, CheckCircle, XCircle, BarChart3 } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface InventoryAuditItem { id: string; item_name: string; sku: string; system_qty: number; actual_qty: number; variance: number; status: 'match' | 'shortage' | 'surplus'; last_audit?: string; }

export default function InventoryAuditPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryAuditItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await auditAPI.getInventoryAudit();
      if (response.success) setItems(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredItems = items.filter((i) => {
    const matchesSearch = i.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) || i.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: items.length,
    matches: items.filter(i => i.status === 'match').length,
    shortages: items.filter(i => i.status === 'shortage').length,
    surpluses: items.filter(i => i.status === 'surplus').length,
    totalVariance: items.reduce((sum, i) => sum + Math.abs(i.variance), 0),
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    match: { label: 'Match', color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle },
    shortage: { label: 'Shortage', color: 'text-red-700', bg: 'bg-red-100', icon: AlertTriangle },
    surplus: { label: 'Surplus', color: 'text-blue-700', bg: 'bg-blue-100', icon: BarChart3 },
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Inventory Audit</h1><p className="text-gray-500">Stock verification and variance</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchData} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton>Start Audit</IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><Package className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Total Items</p><p className="text-xl font-bold">{stats.total}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-green-500"><CheckCircle className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Matches</p><p className="text-xl font-bold text-[#34C759]">{stats.matches}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-red-500"><AlertTriangle className="h-6 w-6 text-[#FF3B30] mb-2" /><p className="text-sm text-gray-500">Shortages</p><p className="text-xl font-bold text-[#FF3B30]">{stats.shortages}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-[#007AFF]"><BarChart3 className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Total Variance</p><p className="text-xl font-bold">{stats.totalVariance}</p></IOSCard>
          </div>

          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
              <div className="flex gap-2">
                {['all', 'match', 'shortage', 'surplus'].map((status) => (
                  <IOSButton key={status} variant={statusFilter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(status)}>
                    {status === 'all' ? 'All' : statusConfig[status]?.label || status}
                  </IOSButton>
                ))}
              </div>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredItems.length === 0 ? (
            <IOSCard className="p-12 text-center"><Package className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No audit data</p></IOSCard>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium">Item</th>
                    <th className="text-center p-3 font-medium">System Qty</th>
                    <th className="text-center p-3 font-medium">Actual Qty</th>
                    <th className="text-center p-3 font-medium">Variance</th>
                    <th className="text-center p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredItems.map((item) => {
                    const status = statusConfig[item.status];
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="p-3"><p className="font-medium">{item.item_name}</p><p className="text-sm text-gray-500">{item.sku}</p></td>
                        <td className="p-3 text-center">{item.system_qty}</td>
                        <td className="p-3 text-center">{item.actual_qty}</td>
                        <td className={`p-3 text-center font-medium ${item.variance < 0 ? 'text-[#FF3B30]' : item.variance > 0 ? 'text-[#007AFF]' : ''}`}>
                          {item.variance > 0 ? '+' : ''}{item.variance}
                        </td>
                        <td className="p-3 text-center"><IOSBadge className={`${status.bg} ${status.color}`}>{status.label}</IOSBadge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
