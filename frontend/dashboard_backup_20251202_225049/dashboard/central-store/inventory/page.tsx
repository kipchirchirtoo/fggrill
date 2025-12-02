'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { storeAPI } from '@/lib/api';
import { Package, RefreshCw, Search, Plus, Edit2, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Item { id: string; sku: string; name: string; category: string; quantity: number; min_quantity: number; unit: string; unit_price: number; }

export default function CentralInventoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', sku: '', category: '', quantity: 0, min_quantity: 0, unit: 'pcs', unit_price: 0 });

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getItems({ category: categoryFilter !== 'all' ? categoryFilter : undefined });
      if (response.success) setItems(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [categoryFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const categories = [...new Set(items.map(i => i.category))].filter(Boolean);
  const filteredItems = items.filter((i) => i.name?.toLowerCase().includes(searchQuery.toLowerCase()) || i.sku?.toLowerCase().includes(searchQuery.toLowerCase()));
  const lowStockItems = items.filter(i => i.quantity <= i.min_quantity);

  const handleAddItem = async () => {
    if (!formData.name || !formData.sku) { toast.error('Fill required fields'); return; }
    try {
      await storeAPI.createItem(formData);
      toast.success('Item added');
      setAddModalOpen(false);
      fetchItems();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Inventory</h1><p className="text-gray-500">Central store items</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchItems}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Item</IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><Package className="h-6 w-6 text-blue-600 mb-2" /><p className="text-sm text-gray-500">Total Items</p><p className="text-xl font-bold">{items.length}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-yellow-500"><AlertTriangle className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Low Stock</p><p className="text-xl font-bold text-yellow-600">{lowStockItems.length}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-green-500"><CheckCircle className="h-6 w-6 text-green-600 mb-2" /><p className="text-sm text-gray-500">Adequate</p><p className="text-xl font-bold text-green-600">{items.length - lowStockItems.length}</p></IOSCard>
          </div>

          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 border rounded-ios-lg">
                <option value="all">All Categories</option>
                {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium">Item</th>
                    <th className="text-left p-3 font-medium">SKU</th>
                    <th className="text-left p-3 font-medium">Category</th>
                    <th className="text-center p-3 font-medium">Quantity</th>
                    <th className="text-center p-3 font-medium">Min</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredItems.map((item) => {
                    const isLow = item.quantity <= item.min_quantity;
                    return (
                      <tr key={item.id} className={`hover:bg-gray-50 ${isLow ? 'bg-yellow-50' : ''}`}>
                        <td className="p-3 font-medium">{item.name}</td>
                        <td className="p-3 text-gray-500">{item.sku}</td>
                        <td className="p-3 text-gray-500">{item.category}</td>
                        <td className="p-3 text-center font-bold">{item.quantity} {item.unit}</td>
                        <td className="p-3 text-center text-gray-500">{item.min_quantity}</td>
                        <td className="p-3 text-center"><IOSBadge variant={isLow ? 'warning' : 'success'}>{isLow ? 'Low' : 'OK'}</IOSBadge></td>
                        <td className="p-3 text-right">KES {item.unit_price?.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add New Item</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Name *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">SKU *</label><Input value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Category</label><Input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Quantity</label><Input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} /></div>
                <div><label className="text-sm font-medium">Min Qty</label><Input type="number" value={formData.min_quantity} onChange={(e) => setFormData({ ...formData, min_quantity: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Unit</label><Input value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Price</label><Input type="number" value={formData.unit_price} onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })} /></div>
              </div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleAddItem} className="flex-1">Add Item</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
