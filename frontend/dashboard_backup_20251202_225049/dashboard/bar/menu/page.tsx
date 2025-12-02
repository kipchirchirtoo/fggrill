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
import { restaurantAPI } from '@/lib/api';
import { Wine, Plus, RefreshCw, Search, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface MenuItem { id: string; name: string; description?: string; price: number; category_id: string; category_name?: string; is_available: boolean; }
interface Category { id: string; name: string; }

export default function BarMenuPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', price: 0, category_id: '' });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [itemsRes, categoriesRes] = await Promise.all([restaurantAPI.getMenuItems(), restaurantAPI.getCategories()]);
      if (itemsRes.success) setItems(itemsRes.data || []);
      if (categoriesRes.success) setCategories(categoriesRes.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      await restaurantAPI.toggleItemAvailability(item.id);
      toast.success(`${item.name} ${item.is_available ? 'hidden' : 'shown'}`);
      fetchData();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const handleSaveItem = async () => {
    if (!formData.name || !formData.price) { toast.error('Fill required fields'); return; }
    try {
      if (selectedItem) await restaurantAPI.updateMenuItem(selectedItem.id, formData);
      else await restaurantAPI.createMenuItem(formData);
      toast.success(selectedItem ? 'Updated' : 'Created');
      setItemModalOpen(false);
      fetchData();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const handleDeleteItem = async (item: MenuItem) => {
    if (!confirm(`Delete ${item.name}?`)) return;
    try { await restaurantAPI.deleteMenuItem(item.id); toast.success('Deleted'); fetchData(); }
    catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const openEditModal = (item: MenuItem) => {
    setSelectedItem(item);
    setFormData({ name: item.name, description: item.description || '', price: item.price, category_id: item.category_id });
    setItemModalOpen(true);
  };

  const openNewModal = () => {
    setSelectedItem(null);
    setFormData({ name: '', description: '', price: 0, category_id: '' });
    setItemModalOpen(true);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BARTENDER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Bar Menu</h1><p className="text-gray-500">Manage drinks and beverages</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
              <IOSButton onClick={openNewModal}><Plus className="h-4 w-4 mr-2" /> Add Item</IOSButton>
            </div>
          </div>

          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 border rounded-ios-lg">
                <option value="all">All Categories</option>
                {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredItems.length === 0 ? (
            <IOSCard className="p-12 text-center"><Wine className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No items found</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <IOSCard key={item.id} className={`p-4 ${!item.is_available ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold">{item.name}</h3>
                        {!item.is_available && <IOSBadge variant="error">Hidden</IOSBadge>}
                      </div>
                      <p className="text-sm text-gray-500">{item.category_name}</p>
                    </div>
                    <p className="font-bold text-lg">KES {item.price?.toLocaleString()}</p>
                  </div>
                  {item.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>}
                  <div className="flex items-center justify-between pt-3 border-t">
                    <IOSButton size="sm" variant={item.is_available ? 'secondary' : 'primary'} onClick={() => handleToggleAvailability(item)}>
                      {item.is_available ? <><EyeOff className="h-3 w-3 mr-1" /> Hide</> : <><Eye className="h-3 w-3 mr-1" /> Show</>}
                    </IOSButton>
                    <div className="flex gap-2">
                      <IOSButton size="sm" variant="secondary" onClick={() => openEditModal(item)}><Edit2 className="h-3 w-3" /></IOSButton>
                      <IOSButton size="sm" variant="destructive" onClick={() => handleDeleteItem(item)}><Trash2 className="h-3 w-3" /></IOSButton>
                    </div>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>

        <Dialog open={itemModalOpen} onOpenChange={setItemModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{selectedItem ? 'Edit Item' : 'Add New Item'}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Name *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Category</label>
                <select value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })} className="w-full p-2 border rounded-ios-lg">
                  <option value="">Select</option>
                  {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-medium">Price (KES) *</label><Input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className="text-sm font-medium">Description</label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full p-2 border rounded-ios-lg" rows={2} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setItemModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleSaveItem} className="flex-1">{selectedItem ? 'Update' : 'Create'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
