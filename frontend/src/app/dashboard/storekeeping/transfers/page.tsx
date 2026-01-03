'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Truck, RefreshCw, ArrowRight, Package, Building2, Clock, Check, AlertTriangle, Plus, X, Send, Eye, ShoppingCart, User, Search } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { storeAPI } from '@/lib/api';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Dispatch {
  id: string;
  dispatch_number: string;
  from_branch_id: number;
  to_branch_id: number;
  status: string;
  created_at: string;
  dispatched_at?: string;
  from_branch?: { id: number; name: string; code: string };
  to_branch?: { id: number; name: string; code: string };
  items_count?: number;
}

interface TransferItem {
  id: string;
  item_sku: string;
  quantity: number;
  ordered: boolean;
  created_at: string;
  item?: { sku: string; item_name?: string; description?: string; retail_price?: number };
  shop_user?: { id: string; first_name?: string; last_name?: string; email?: string };
}

interface Item {
  sku: string;
  item_name: string;
  description?: string;
  quantity: number;
  retail_price?: number;
}

export default function TransfersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'dispatches' | 'transfers' | 'my-cart'>('dispatches');
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [myCart, setMyCart] = useState<TransferItem[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddToCartOpen, setIsAddToCartOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [transferQty, setTransferQty] = useState(1);
  
  const isManager =
    user?.role === UserRole.SUPER_ADMIN ||
    user?.role === UserRole.GENERAL_MANAGER ||
    user?.role === UserRole.CENTRAL_STOREKEEPER ||
    user?.role === UserRole.BRANCH_STOREKEEPER;

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [dispatchRes, transferRes, itemsRes] = await Promise.all([
        storeAPI.getDispatchHistory().catch((err) => {
          console.error('Dispatches error:', err);
          return { data: [] as any[] } as any;
        }),
        storeAPI.getTransferItems().catch((err) => {
          console.error('Transfer items error:', err);
          return { data: [] as any[] } as any;
        }),
        storeAPI.getItems().catch((err) => {
          console.error('Items error:', err);
          return { data: [] as any[] } as any;
        }),
      ]);

      const dispatchList = (dispatchRes as any).data || (dispatchRes as any).dispatches || dispatchRes || [];
      const transferList = (transferRes as any).data || (transferRes as any).items || transferRes || [];
      const itemsList = (itemsRes as any).data || (itemsRes as any).items || itemsRes || [];

      setDispatches(Array.isArray(dispatchList) ? dispatchList : []);

      if (Array.isArray(transferList)) {
        setTransferItems(transferList.filter((t: TransferItem) => t.ordered));
        setMyCart(transferList.filter((t: TransferItem) => !t.ordered));
      } else {
        setTransferItems([]);
        setMyCart([]);
      }

      setItems(Array.isArray(itemsList) ? itemsList : []);
    } catch (error) {
      console.error('Error loading transfers data:', error);
      toast.error('Failed to load transfers data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!selectedItem || transferQty <= 0) return;
    try {
      await storeAPI.transferItem({
        sku: selectedItem.sku,
        transfer_quantity: transferQty,
      });
      toast.success('Added to cart');
      setIsAddToCartOpen(false);
      setSelectedItem(null);
      setTransferQty(1);
      fetchAllData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add');
    }
  };

  const handleSubmitRequest = async () => {
    if (myCart.length === 0) { toast.error('Cart empty'); return; }
    try {
      await storeAPI.submitTransferRequest();
      toast.success('Request submitted');
      fetchAllData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed');
    }
  };

  const handleCompleteTransfer = async (item: TransferItem, cancel = false) => {
    try {
      await storeAPI.completeTransfer({
        sku: item.item_sku,
        quantity: item.quantity,
        shop_user_id: item.shop_user?.id || '',
        cancel,
      });
      toast.success(cancel ? 'Cancelled' : 'Completed');
      fetchAllData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed');
    }
  };

  const filteredItems = items.filter(i => !searchTerm || i.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || i.sku?.toLowerCase().includes(searchTerm.toLowerCase()));
  const getStatusColor = (s: string) => ({ DRAFT: 'bg-gray-100 text-gray-800', PENDING: 'bg-[#F2F2F7] text-[#3C3C43]', IN_TRANSIT: 'bg-[#F2F2F7] text-[#000000]', DELIVERED: 'bg-[#F2F2F7] text-[#000000]', CONFIRMED: 'bg-[#E5E5EA] text-[#000000]', DISPUTED: 'bg-[#F2F2F7] text-[#000000]' }[s] || 'bg-gray-100 text-gray-800');
  const inTransitCount = dispatches.filter(d => d.status === 'IN_TRANSIT').length;
  const deliveredCount = dispatches.filter(d => ['DELIVERED', 'CONFIRMED'].includes(d.status)).length;

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Stock Transfers</h1>
              <p className="text-gray-600">Manage stock transfers and dispatch requests</p>
            </div>
            <div className="flex gap-3">
              <IOSButton variant="outline" onClick={fetchAllData} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton onClick={() => setIsAddToCartOpen(true)} leftIcon={<Plus />}>Request Transfer</IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <IOSCard className="p-4 cursor-pointer hover:bg-[#F2F2F7]" onClick={() => setActiveTab('dispatches')}>
              <div className="flex items-center gap-3"><Truck className="h-8 w-8 text-[#8E8E93]0" /><div><p className="text-sm text-gray-500">Dispatches</p><p className="text-2xl font-bold">{dispatches.length}</p></div></div>
            </IOSCard>
            <IOSCard className="p-4 cursor-pointer hover:bg-[#F2F2F7]" onClick={() => setActiveTab('transfers')}>
              <div className="flex items-center gap-3"><Clock className="h-8 w-8 text-[#3C3C43]" /><div><p className="text-sm text-gray-500">Pending</p><p className="text-2xl font-bold text-[#3C3C43]">{transferItems.length}</p></div></div>
            </IOSCard>
            <IOSCard className="p-4 cursor-pointer hover:bg-[#F2F2F7]" onClick={() => setActiveTab('my-cart')}>
              <div className="flex items-center gap-3"><ShoppingCart className="h-8 w-8 text-[#3C3C43]" /><div><p className="text-sm text-gray-500">My Cart</p><p className="text-2xl font-bold text-[#3C3C43]">{myCart.length}</p></div></div>
            </IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><Check className="h-8 w-8 text-[#8E8E93]0" /><div><p className="text-sm text-gray-500">Delivered</p><p className="text-2xl font-bold text-[#3C3C43]">{deliveredCount}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-[#3C3C43]" /><div><p className="text-sm text-gray-500">In Transit</p><p className="text-2xl font-bold text-[#3C3C43]">{inTransitCount}</p></div></div></IOSCard>
          </div>

          <div className="flex gap-2 border-b">
            {(['dispatches', 'transfers', 'my-cart'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 font-medium border-b-2 ${activeTab === tab ? 'border-[rgba(60,60,67,0.12)] text-[#3C3C43]' : 'border-transparent text-gray-500'}`}>
                {tab === 'dispatches' && <><Truck className="h-4 w-4 inline mr-2" />Dispatches</>}
                {tab === 'transfers' && <><Clock className="h-4 w-4 inline mr-2" />Pending {transferItems.length > 0 && <IOSBadge className="ml-1">{transferItems.length}</IOSBadge>}</>}
                {tab === 'my-cart' && <><ShoppingCart className="h-4 w-4 inline mr-2" />Cart {myCart.length > 0 && <IOSBadge className="ml-1 bg-[#3C3C43]">{myCart.length}</IOSBadge>}</>}
              </button>
            ))}
          </div>

          {activeTab === 'dispatches' && (
            <IOSCard>
              {isLoading ? <div className="p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(60,60,67,0.12)] mx-auto"></div></div>
              : dispatches.length === 0 ? <div className="p-12 text-center text-gray-500"><Truck className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No dispatches</p></div>
              : <div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50"><tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dispatch #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr></thead><tbody className="divide-y">
                {dispatches.map(d => <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 font-mono text-sm">{d.dispatch_number}</td>
                  <td className="px-4 py-4"><span>{d.from_branch?.name || 'Central'}</span> <ArrowRight className="h-4 w-4 inline text-gray-400" /> <span>{d.to_branch?.name || 'Branch'}</span></td>
                  <td className="px-4 py-4"><IOSBadge className={getStatusColor(d.status)}>{d.status}</IOSBadge></td>
                  <td className="px-4 py-4">{d.items_count || 0}</td>
                  <td className="px-4 py-4 text-sm text-gray-500">{formatDate(d.created_at)}</td>
                </tr>)}
              </tbody></table></div>}
            </IOSCard>
          )}

          {activeTab === 'transfers' && (
            <IOSCard>
              <div className="p-4 border-b bg-[#F2F2F7]"><h3 className="font-semibold font-sf-pro-display flex items-center gap-2"><Clock className="h-5 w-5 text-[#3C3C43]" />Pending Requests</h3></div>
              {transferItems.length === 0 ? <div className="p-12 text-center text-gray-500"><Clock className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No pending</p></div>
              : <div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50"><tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                {isManager && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
              </tr></thead><tbody className="divide-y">
                {transferItems.map(i => <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4"><p className="font-medium">{i.item?.item_name || i.item?.description}</p><p className="text-xs text-gray-500 font-mono">{i.item_sku}</p></td>
                  <td className="px-4 py-4"><User className="h-4 w-4 inline text-gray-400 mr-1" />{i.shop_user?.first_name} {i.shop_user?.last_name}</td>
                  <td className="px-4 py-4 font-bold">{i.quantity}</td>
                  {isManager && <td className="px-4 py-4"><div className="flex gap-2">
                    <IOSButton size="sm" className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={() => handleCompleteTransfer(i)} leftIcon={<Check />}>Approve</IOSButton>
                    <IOSButton size="sm" variant="outline" className="text-[#3C3C43]" onClick={() => handleCompleteTransfer(i, true)} leftIcon={<X />}>Reject</IOSButton>
                  </div></td>}
                </tr>)}
              </tbody></table></div>}
            </IOSCard>
          )}

          {activeTab === 'my-cart' && (
            <IOSCard>
              <div className="p-4 border-b bg-[#F2F2F7] flex items-center justify-between">
                <h3 className="font-semibold font-sf-pro-display flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-[#3C3C43]" />My Cart</h3>
                {myCart.length > 0 && <IOSButton onClick={handleSubmitRequest} className="bg-[#3C3C43] hover:bg-[#3C3C43]" leftIcon={<Send />}>Submit ({myCart.length})</IOSButton>}
              </div>
              {myCart.length === 0 ? <div className="p-12 text-center text-gray-500"><ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>Empty</p><IOSButton className="mt-4" onClick={() => setIsAddToCartOpen(true)} leftIcon={<Plus />}>Add</IOSButton></div>
              : <div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50"><tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remove</th>
              </tr></thead><tbody className="divide-y">
                {myCart.map(i => <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4"><p className="font-medium">{i.item?.item_name || i.item?.description}</p><p className="text-xs text-gray-500 font-mono">{i.item_sku}</p></td>
                  <td className="px-4 py-4 font-bold text-[#3C3C43]">{i.quantity}</td>
                  <td className="px-4 py-4">KES {(i.item?.retail_price || 0).toLocaleString()}</td>
                  <td className="px-4 py-4"><IOSButton size="sm" variant="outline" className="text-[#3C3C43]" onClick={() => handleCompleteTransfer(i, true)}><X className="h-4 w-4" /></IOSButton></td>
                </tr>)}
              </tbody></table></div>}
            </IOSCard>
          )}
        </div>

        <Dialog open={isAddToCartOpen} onOpenChange={setIsAddToCartOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-[#3C3C43]" />Request Transfer</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" /><Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" /></div>
              <div className="max-h-64 overflow-y-auto border rounded-ios-lg">
                {filteredItems.slice(0, 20).map(i => (
                  <div key={i.sku} onClick={() => setSelectedItem(i)} className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${selectedItem?.sku === i.sku ? 'bg-[#F2F2F7]' : ''}`}>
                    <div className="flex justify-between"><div><p className="font-medium">{i.item_name}</p><p className="text-xs text-gray-500 font-mono">{i.sku}</p></div><div className="text-right"><p className="font-bold">{i.quantity} stock</p><p className="text-xs text-gray-500">KES {(i.retail_price || 0).toLocaleString()}</p></div></div>
                  </div>
                ))}
              </div>
              {selectedItem && <div className="bg-[#F2F2F7] p-4 rounded-ios-lg"><p className="font-medium mb-2">Selected: {selectedItem.item_name}</p><div className="flex items-center gap-4"><label>Qty:</label><Input type="number" min="1" max={selectedItem.quantity} value={transferQty} onChange={e => setTransferQty(parseInt(e.target.value) || 1)} className="w-24" /><span className="text-sm text-gray-500">Max: {selectedItem.quantity}</span></div></div>}
              <div className="flex justify-end gap-3 pt-4 border-t"><IOSButton variant="outline" onClick={() => setIsAddToCartOpen(false)}>Cancel</IOSButton><IOSButton onClick={handleAddToCart} disabled={!selectedItem || transferQty <= 0} leftIcon={<Plus />}>Add</IOSButton></div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
