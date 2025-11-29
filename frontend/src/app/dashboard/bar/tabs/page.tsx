'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Users, Plus, Eye, X, CreditCard, Banknote, Smartphone, CheckCircle, RefreshCw, Clock, Wine, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { barAPI } from '@/lib/api';

export default function BarTabsPage() {
  const [tabs, setTabs] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open');
  const [showNewTab, setShowNewTab] = useState(false);
  const [showCloseTab, setShowCloseTab] = useState<any>(null);
  const [selectedTab, setSelectedTab] = useState<any>(null);
  const [newTabName, setNewTabName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mpesa'>('cash');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    barAPI.getTabs().then(res => {
      const list = res.tabs || res.data || [];
      setTabs(Array.isArray(list) ? list : []);
    }).catch(() => setTabs([]));
  }, []);

  const filteredTabs = tabs.filter(tab => filter === 'all' || tab.status === filter);

  const openTabs = tabs.filter(t => t.status === 'open');
  const totalOpen = openTabs.reduce((sum, t) => sum + t.total, 0);

  const createTab = () => {
    if (!newTabName.trim()) { toast.error('Enter customer name'); return; }
    const newTab = {
      id: `${Date.now()}`,
      tab_name: newTabName,
      status: 'open',
      items: [],
      total: 0,
      created_at: new Date().toISOString()
    };
    setTabs(prev => [newTab, ...prev]);
    toast.success(`Tab opened for ${newTabName}`);
    setShowNewTab(false);
    setNewTabName('');
  };

  const closeTab = async () => {
    if (!showCloseTab) return;
    setIsLoading(true);
    
    setTabs(prev => prev.map(t => t.id === showCloseTab.id ? {
      ...t,
      status: 'closed',
      closed_at: new Date().toISOString(),
      payment_method: paymentMethod
    } : t));
    
    toast.success(`Tab for ${showCloseTab.tab_name} closed - KES ${showCloseTab.total.toLocaleString()}`);
    setShowCloseTab(null);
    setIsLoading(false);
  };

  const getTimeSince = (date: string) => {
    const hours = Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
    return hours < 1 ? 'Just now' : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BARTENDER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Users className="h-8 w-8 text-purple-600" />
                Bar Tabs
              </h1>
              <p className="text-gray-600 mt-1">Manage customer running tabs</p>
            </div>
            <button onClick={() => setShowNewTab(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              <Plus className="h-5 w-5" /> Open New Tab
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-purple-100 rounded-lg"><Users className="h-6 w-6 text-purple-600" /></div>
                <span className="text-3xl font-bold text-purple-600">{openTabs.length}</span>
              </div>
              <div className="text-sm text-gray-500 mt-2">Open Tabs</div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-green-100 rounded-lg"><Wine className="h-6 w-6 text-green-600" /></div>
                <span className="text-3xl font-bold text-green-600">KES {totalOpen.toLocaleString()}</span>
              </div>
              <div className="text-sm text-gray-500 mt-2">Total Outstanding</div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-blue-100 rounded-lg"><CheckCircle className="h-6 w-6 text-blue-600" /></div>
                <span className="text-3xl font-bold text-blue-600">{tabs.filter(t => t.status === 'closed').length}</span>
              </div>
              <div className="text-sm text-gray-500 mt-2">Closed Today</div>
            </div>
          </div>

          {/* Filter */}
          <div className="flex gap-2">
            {(['all', 'open', 'closed'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${filter === f ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                {f} {f === 'open' && `(${openTabs.length})`}
              </button>
            ))}
          </div>

          {/* Tabs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTabs.map(tab => (
              <div key={tab.id} className={`bg-white rounded-xl border p-4 ${tab.status === 'closed' ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-bold text-lg">{tab.tab_name}</div>
                    <div className="text-sm text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Opened {getTimeSince(tab.created_at)}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${tab.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {tab.status === 'open' ? 'Open' : 'Closed'}
                  </span>
                </div>

                <div className="border-t py-3 my-3">
                  <div className="text-sm text-gray-500 mb-2">{tab.items.length} items</div>
                  {tab.items.slice(0, 3).map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm py-1">
                      <span>{item.quantity}x {item.name}</span>
                      <span className="text-gray-500">KES {(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                  {tab.items.length > 3 && <div className="text-xs text-gray-400">+{tab.items.length - 3} more items</div>}
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="text-xl font-bold text-purple-600">KES {tab.total.toLocaleString()}</div>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedTab(tab)} className="p-2 hover:bg-gray-100 rounded-lg"><Eye className="h-4 w-4" /></button>
                    {tab.status === 'open' && (
                      <button onClick={() => setShowCloseTab(tab)} className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                        Close Tab
                      </button>
                    )}
                  </div>
                </div>
                {tab.status === 'closed' && (
                  <div className="mt-2 text-xs text-gray-500">Paid via {tab.payment_method?.toUpperCase()}</div>
                )}
              </div>
            ))}
          </div>

          {filteredTabs.length === 0 && (
            <div className="text-center py-12 text-gray-500"><Users className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No tabs found</p></div>
          )}
        </div>

        {/* New Tab Modal */}
        {showNewTab && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewTab(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between mb-4">
                <h2 className="text-xl font-bold">Open New Tab</h2>
                <button onClick={() => setShowNewTab(false)}><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Customer Name</label>
                  <input type="text" value={newTabName} onChange={e => setNewTabName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Enter name" />
                </div>
                <button onClick={createTab} className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium">
                  Open Tab
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Close Tab Modal */}
        {showCloseTab && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCloseTab(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between mb-4">
                <h2 className="text-xl font-bold">Close Tab</h2>
                <button onClick={() => setShowCloseTab(null)}><X className="h-5 w-5" /></button>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-xl mb-4">
                <div className="text-sm text-gray-500">{showCloseTab.tab_name}</div>
                <div className="text-3xl font-bold text-purple-600">KES {showCloseTab.total.toLocaleString()}</div>
              </div>

              <div className="text-sm font-medium mb-2">Payment Method</div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {(['cash', 'card', 'mpesa'] as const).map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)} className={`p-3 rounded-lg border-2 ${paymentMethod === m ? 'border-purple-600 bg-purple-50' : 'border-gray-200'}`}>
                    {m === 'cash' ? <Banknote className="h-5 w-5 mx-auto" /> : m === 'card' ? <CreditCard className="h-5 w-5 mx-auto" /> : <Smartphone className="h-5 w-5 mx-auto" />}
                    <div className="text-xs mt-1 capitalize">{m === 'mpesa' ? 'M-Pesa' : m}</div>
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={() => window.print()} className="flex-1 py-2 border rounded-lg flex items-center justify-center gap-1"><Printer className="h-4 w-4" /> Print Bill</button>
                <button onClick={closeTab} disabled={isLoading} className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                  {isLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />} Close & Pay
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Detail Modal */}
        {selectedTab && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedTab(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between mb-4">
                <h2 className="text-xl font-bold">{selectedTab.tab_name}'s Tab</h2>
                <button onClick={() => setSelectedTab(null)}><X className="h-5 w-5" /></button>
              </div>
              
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">Status</div>
                  <div className="font-medium capitalize">{selectedTab.status}</div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Items ({selectedTab.items.length})</div>
                  <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                    {selectedTab.items.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between p-3">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="font-medium">KES {(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-xl font-bold text-purple-600">KES {selectedTab.total.toLocaleString()}</span>
                </div>

                {selectedTab.status === 'open' && (
                  <button onClick={() => { setSelectedTab(null); setShowCloseTab(selectedTab); }} className="w-full py-3 bg-green-600 text-white rounded-lg font-medium">
                    Close This Tab
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
