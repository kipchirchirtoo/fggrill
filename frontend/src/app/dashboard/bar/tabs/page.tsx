'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { barAPI } from '@/lib/api';
import { useBranch } from '@/lib/branch-context';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { RefreshCw, Plus, CreditCard, DollarSign, Check, User } from 'lucide-react';

interface Tab {
  id: string;
  tab_number?: string;
  customer_name: string;
  phone?: string;
  status: 'open' | 'closed';
  total_amount: number;
  items?: any[];
  created_at: string;
  closed_at?: string;
}

export default function BarTabsPage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('open');
  const [newTabModalOpen, setNewTabModalOpen] = useState(false);
  const [closeTabModalOpen, setCloseTabModalOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<Tab | null>(null);
  const [newTabData, setNewTabData] = useState({ customer_name: '', table_number: '' });

  const fetchTabs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await barAPI.getTabs(activeBranchId || undefined);
      if (response.success) {
        setTabs(response.data || []);
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [activeBranchId]);

  useEffect(() => { fetchTabs(); }, [fetchTabs]);

  const filteredTabs = tabs.filter((tab) => statusFilter === 'all' || tab.status === statusFilter);
  const openTabs = tabs.filter(t => t.status === 'open');
  const totalOpen = openTabs.reduce((sum, t) => sum + (t.total_amount || 0), 0);

  const handleCreateTab = async () => {
    if (!newTabData.customer_name) { toast.error('Enter customer name'); return; }
    try {
      await barAPI.createTab({
        customer_name: newTabData.customer_name,
        phone: newTabData.table_number || undefined,
        branch_id: activeBranchId,
      });
      toast.success('Tab opened');
      setNewTabModalOpen(false);
      setNewTabData({ customer_name: '', table_number: '' });
      fetchTabs();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const handleCloseTab = async () => {
    if (!selectedTab) return;
    try {
      await barAPI.closeTab(selectedTab.id, 'cash');
      toast.success('Tab closed');
      setCloseTabModalOpen(false);
      fetchTabs();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BARTENDER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Bar Tabs</h1><p className="text-gray-500">Manage open tabs</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchTabs} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton onClick={() => setNewTabModalOpen(true)} leftIcon={<Plus />}>Open Tab</IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <IOSCard className="p-4">
              <CreditCard className="h-8 w-8 text-[#007AFF] mb-2" />
              <p className="text-sm text-gray-500">Open Tabs</p>
              <p className="text-2xl font-bold">{openTabs.length}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <DollarSign className="h-8 w-8 text-[#34C759] mb-2" />
              <p className="text-sm text-gray-500">Total Outstanding</p>
              <p className="text-2xl font-bold">KES {totalOpen.toLocaleString()}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <Check className="h-8 w-8 text-gray-600 mb-2" />
              <p className="text-sm text-gray-500">Closed Today</p>
              <p className="text-2xl font-bold">{tabs.filter(t => t.status === 'closed').length}</p>
            </IOSCard>
          </div>

          <div className="flex gap-2">
            {(['all', 'open', 'closed'] as const).map((status) => (
              <IOSButton key={status} variant={statusFilter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(status)}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </IOSButton>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredTabs.length === 0 ? (
            <IOSCard className="p-12 text-center"><CreditCard className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No tabs found</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTabs.map((tab) => (
                <IOSCard key={tab.id} className={`p-4 ${tab.status === 'open' ? 'border-l-4 border-[#007AFF]' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold">#{tab.tab_number}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1"><User className="h-3 w-3" /> {tab.customer_name}</p>
                      {tab.phone && <p className="text-sm text-gray-500">Phone: {tab.phone}</p>}
                    </div>
                    <IOSBadge color={tab.status === 'open' ? 'info' : 'success'}>{tab.status}</IOSBadge>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t">
                    <div>
                      <p className="text-xl font-bold">KES {(tab.total_amount || 0).toLocaleString()}</p>
                      <p className="text-xs text-gray-500">{tab.items?.length || 0} items</p>
                    </div>
                    {tab.status === 'open' && (
                      <IOSButton size="sm" onClick={() => { setSelectedTab(tab); setCloseTabModalOpen(true); }}>
                        <Check className="h-3 w-3 mr-1" /> Close
                      </IOSButton>
                    )}
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>

        <Dialog open={newTabModalOpen} onOpenChange={setNewTabModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Open New Tab</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Customer Name *</label><Input value={newTabData.customer_name} onChange={(e) => setNewTabData({ ...newTabData, customer_name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Table Number</label><Input value={newTabData.table_number} onChange={(e) => setNewTabData({ ...newTabData, table_number: e.target.value })} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setNewTabModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleCreateTab} className="flex-1">Open Tab</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={closeTabModalOpen} onOpenChange={setCloseTabModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Close Tab</DialogTitle></DialogHeader>
            {selectedTab && (
              <div className="space-y-4 mt-4">
                <div className="p-4 bg-gray-50 rounded-ios-lg">
                  <p className="font-bold">Tab #{selectedTab.tab_number}</p>
                  <p className="text-gray-500">{selectedTab.customer_name}</p>
                  <p className="text-2xl font-bold mt-2">KES {(selectedTab.total_amount || 0).toLocaleString()}</p>
                </div>
                <div className="flex gap-3">
                  <IOSButton variant="secondary" onClick={() => setCloseTabModalOpen(false)} className="flex-1">Cancel</IOSButton>
                  <IOSButton onClick={handleCloseTab} className="flex-1" leftIcon={<Check />}>Close & Pay</IOSButton>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
