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
import { RefreshCw, Plus, CreditCard, DollarSign, Check, User, Edit2, Trash2 } from 'lucide-react';

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
  const [editTabModalOpen, setEditTabModalOpen] = useState(false);
  const [closeTabModalOpen, setCloseTabModalOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<Tab | null>(null);
  const [newTabData, setNewTabData] = useState({ customer_name: '', table_number: '' });
  const [editTabData, setEditTabData] = useState({ customer_name: '', phone: '', table_number: '' });

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

  const handleEditTab = async () => {
    if (!selectedTab) return;
    if (!editTabData.customer_name) { toast.error('Enter customer name'); return; }
    try {
      await barAPI.updateTab(selectedTab.id, {
        customer_name: editTabData.customer_name,
        phone: editTabData.phone || undefined,
        table_number: editTabData.table_number || undefined,
      });
      toast.success('Tab updated');
      setEditTabModalOpen(false);
      fetchTabs();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const handleDeleteTab = async (tab: Tab) => {
    if (!confirm(`Delete tab for ${tab.customer_name}? This action cannot be undone.`)) return;
    try {
      await barAPI.deleteTab(tab.id);
      toast.success('Tab deleted');
      fetchTabs();
    } catch (error: any) { toast.error(error.message || 'Failed to delete tab'); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BARTENDER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[22px] sm:text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Bar Tabs</h1>
              <p className="text-stone-500 text-sm mt-0.5">Manage open customer tabs</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchTabs}
                disabled={isLoading}
                className="btn-secondary h-[44px] px-4 flex-1 sm:flex-none flex items-center justify-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={() => setNewTabModalOpen(true)}
                className="btn-primary h-[44px] px-4 flex-1 sm:flex-none flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>Open Tab</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <IOSCard className="p-3 sm:p-4 shadow-sm border-stone-200">
              <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-[#007AFF] mb-2" />
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">Open Tabs</p>
              <p className="text-xl sm:text-2xl font-bold text-stone-900">{openTabs.length}</p>
            </IOSCard>
            <IOSCard className="p-3 sm:p-4 shadow-sm border-stone-200">
              <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-[#34C759] mb-2" />
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">Outstanding</p>
              <p className="text-xl sm:text-2xl font-bold text-stone-900">KES {totalOpen.toLocaleString()}</p>
            </IOSCard>
            <IOSCard className="p-3 sm:p-4 shadow-sm border-stone-200 col-span-2 lg:col-span-1">
              <Check className="h-6 w-6 sm:h-8 sm:w-8 text-stone-600 mb-2" />
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">Closed Today</p>
              <p className="text-xl sm:text-2xl font-bold text-stone-900">{tabs.filter(t => t.status === 'closed').length}</p>
            </IOSCard>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {(['all', 'open', 'closed'] as const).map((status) => (
              <IOSButton
                key={status}
                variant={statusFilter === status ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="whitespace-nowrap h-[36px] px-5"
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </IOSButton>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredTabs.length === 0 ? (
            <IOSCard className="p-12 text-center"><CreditCard className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No tabs found</p></IOSCard>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTabs.map((tab) => (
                <IOSCard key={tab.id} className={`p-4 shadow-sm hover:border-stone-300 transition-all ${tab.status === 'open' ? 'border-l-4 border-l-[#007AFF]' : ''}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="min-w-0">
                      <p className="font-bold text-stone-900">#{tab.tab_number}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <User className="h-3.5 w-3.5 text-stone-400" />
                        <p className="text-sm font-semibold text-stone-700 truncate">{tab.customer_name}</p>
                      </div>
                      {tab.phone && (
                        <p className="text-xs text-stone-500 mt-1 pl-5">{tab.phone}</p>
                      )}
                    </div>
                    <IOSBadge className={tab.status === 'open' ? 'bg-blue-50 text-[#007AFF]' : 'bg-green-50 text-[#34C759]'}>
                      {tab.status}
                    </IOSBadge>
                  </div>
                  <div className="flex flex-col gap-4 pt-4 border-t border-stone-100">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-lg font-bold text-stone-900">KES {(tab.total_amount || 0).toLocaleString()}</p>
                        <p className="text-[11px] font-bold text-stone-400 uppercase tracking-tight">{tab.items?.length || 0} items ordered</p>
                      </div>
                      {tab.status === 'open' && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedTab(tab);
                              setEditTabData({
                                customer_name: tab.customer_name,
                                phone: tab.phone || '',
                                table_number: ''
                              });
                              setEditTabModalOpen(true);
                            }}
                            className="p-2 rounded-xl bg-stone-50 text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTab(tab)}
                            disabled={tab.total_amount > 0}
                            className="p-2 rounded-xl bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors disabled:opacity-30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    {tab.status === 'open' && (
                      <button
                        onClick={() => { setSelectedTab(tab); setCloseTabModalOpen(true); }}
                        className="w-full h-11 bg-stone-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                      >
                        <Check className="h-4 w-4" />
                        <span>Close & Settle</span>
                      </button>
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

        <Dialog open={editTabModalOpen} onOpenChange={setEditTabModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Tab</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Customer Name *</label><Input value={editTabData.customer_name} onChange={(e) => setEditTabData({ ...editTabData, customer_name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Phone</label><Input value={editTabData.phone} onChange={(e) => setEditTabData({ ...editTabData, phone: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Table Number</label><Input value={editTabData.table_number} onChange={(e) => setEditTabData({ ...editTabData, table_number: e.target.value })} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setEditTabModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleEditTab} className="flex-1">Update Tab</IOSButton>
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
