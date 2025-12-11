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
import { restaurantAPI } from '@/lib/api';
import { Utensils, RefreshCw, Plus, Search, Edit2, Trash2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface MenuItem { id: string; name: string; description?: string; price: number; category: string; is_available: boolean; }

export default function AdminMenuPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', price: 0, category_id: '' });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [itemsRes, catsRes] = await Promise.all([restaurantAPI.getMenuItems(), restaurantAPI.getCategories()]);
      if (itemsRes.success) setItems(itemsRes.data || []);
      if (catsRes.success) setCategories(catsRes.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredItems = items.filter((i) => i.name?.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleAddItem = async () => {
    if (!formData.name || !formData.price) { toast.error('Fill required fields'); return; }
    try {
      await restaurantAPI.createMenuItem(formData);
      toast.success('Menu item added');
      setAddModalOpen(false);
      fetchData();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const handleToggleAvailability = async (id: string) => {
    try {
      await restaurantAPI.toggleItemAvailability(id);
      toast.success('Availability updated');
      fetchData();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Menu Management</h1><p className="text-gray-500">Manage restaurant menu items</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchData} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>Add Item</IOSButton>
            </div>
          </div>

          <IOSCard className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search menu items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredItems.length === 0 ? (
            <IOSCard className="p-12 text-center"><Utensils className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No menu items</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <IOSCard key={item.id} className={`p-4 ${!item.is_available ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div><p className="font-bold">{item.name}</p><p className="text-sm text-gray-500">{item.category}</p></div>
                    <IOSBadge variant={item.is_available ? 'success' : 'neutral'}>{item.is_available ? 'Available' : 'Unavailable'}</IOSBadge>
                  </div>
                  {item.description && <p className="text-sm text-gray-500 mb-3">{item.description}</p>}
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-lg flex items-center gap-1"><DollarSign className="h-4 w-4" /> KES {item.price?.toLocaleString()}</p>
                    <div className="flex gap-2">
                      <IOSButton size="sm" variant="secondary" onClick={() => handleToggleAvailability(item.id)}>{item.is_available ? 'Disable' : 'Enable'}</IOSButton>
                      <IOSButton size="sm" variant="ghost"><Edit2 className="h-4 w-4" /></IOSButton>
                    </div>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>

        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Menu Item</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Name *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Description</label><Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Price *</label><Input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className="text-sm font-medium">Category</label>
                <select value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })} className="w-full p-2 border rounded-ios-lg">
                  <option value="">Select category</option>
                  {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleAddItem} className="flex-1">Add</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
