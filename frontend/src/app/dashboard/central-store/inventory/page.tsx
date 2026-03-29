'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { storeAPI, InventoryItem } from '@/lib/api';
import { Package, Plus, RefreshCw, Search, Trash2, Edit, AlertTriangle, ChevronRight, ShoppingCart } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/utils';

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ item_name: '', category: '', unit_of_measure: '', reorder_level: 0, cost_price: 0, sku: '' });
  const [globalStats, setGlobalStats] = useState({ total: 0, inStock: 0, lowStock: 0, outOfStock: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getItems({ 
        page: currentPage, 
        limit: 50,
        search: searchQuery 
      });
      if (response.success) {
        setItems(response.data || []);
        setTotalPages(response.pages || 1);
        if (response.stats) {
          setGlobalStats(response.stats);
        }
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [currentPage, searchQuery]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleCreateOrUpdate = async () => {
    setIsActionLoading(true);
    try {
      const payload = { ...formData, quantity: isEdit ? (selectedItem?.quantity || 0) : 0 };
      const response = isEdit && selectedItem
        ? await storeAPI.updateItem(selectedItem.id, payload)
        : await storeAPI.createItem(payload);

      if (response.success) {
        toast.success(isEdit ? 'Item updated' : 'Item added');
        setModalOpen(false);
        fetchItems();
      } else {
        toast.error(response.message || 'Action failed');
      }
    } catch (error: any) { toast.error(error.message || 'Error occurred'); }
    finally { setIsActionLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      const res = await storeAPI.deleteItem(id);
      if (res.success) { toast.success('Item removed'); fetchItems(); }
    } catch (error) { toast.error('Failed to delete item'); }
  };

  const openEditModal = (item: InventoryItem) => {
    setIsEdit(true);
    setSelectedItem(item);
    setFormData({
      item_name: item.item_name || '',
      category: item.category || '',
      unit_of_measure: item.unit_of_measure || '',
      reorder_level: item.reorder_level || 0,
      cost_price: item.cost_price || 0,
      sku: item.sku || ''
    });
    setModalOpen(true);
  };

  const openAddModal = () => {
    setIsEdit(false);
    setSelectedItem(null);
    setFormData({ item_name: '', category: '', unit_of_measure: '', reorder_level: 0, cost_price: 0, sku: '' });
    setModalOpen(true);
  };

  const suggestAttributes = async (name: string) => {
    if (name.length < 3) return;
    try {
      const res = await storeAPI.suggestAttributes(name);
      if (res.success && res.data) {
        setFormData(prev => ({
          ...prev,
          category: prev.category || res.data.category,
          unit_of_measure: prev.unit_of_measure || res.data.unit_of_measure
        }));
      }
    } catch (e) { /* ignore */ }
  };

  const filteredItems = items.filter((i) =>
    i.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.CENTRAL_STOREKEEPER,
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.CENTRAL_OPERATIONS_MANAGER,
      UserRole.AUDITOR
    ]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Master Inventory</h1>
              <p className="text-stone-500 mt-0.5">Central catalog of all items and materials</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchItems} className="btn-secondary h-10 px-3">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={openAddModal} className="btn-primary h-10">
                <Plus className="h-4 w-4" />
                <span>Add New Item</span>
              </button>
            </div>
          </div>

          {/* Stats Summary - Minimal Stone */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm">
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Total SKU</p>
              <p className="text-2xl font-semibold text-stone-900 mt-1">{globalStats.total}</p>
            </div>
            <div className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm">
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">In Stock</p>
              <p className="text-2xl font-semibold text-stone-900 mt-1">{globalStats.inStock}</p>
            </div>
            <div className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm border-l-4 border-l-stone-400">
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Low Stock</p>
              <p className="text-2xl font-semibold text-amber-600 mt-1">{globalStats.lowStock}</p>
            </div>
            <div className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm">
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Out of Stock</p>
              <p className="text-2xl font-semibold text-stone-300 mt-1">{globalStats.outOfStock}</p>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="bg-white p-4 rounded-lg border border-stone-100 shadow-sm">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <input
                placeholder="Search by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>
          </div>

          {/* Items Table - Minimal Monochrome */}
          <div className="bg-white rounded-lg border border-stone-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50/50 border-b border-stone-100 text-left">
                  <tr>
                    <th className="p-4 font-semibold text-stone-500 uppercase text-[11px] tracking-wider">Item Details</th>
                    <th className="p-4 font-semibold text-stone-500 uppercase text-[11px] tracking-wider">Category</th>
                    <th className="p-4 font-semibold text-stone-500 uppercase text-[11px] tracking-wider text-center">Stock Level</th>
                    <th className="p-4 font-semibold text-stone-500 uppercase text-[11px] tracking-wider text-right">Unit Price</th>
                    <th className="p-4 font-semibold text-stone-500 uppercase text-[11px] tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {isLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <tr key={`skeleton-${i}`}><td colSpan={5} className="p-4"><Skeleton className="h-10 w-full" /></td></tr>
                    ))
                  ) : items.length === 0 ? (
                    <tr><td colSpan={5} className="p-20 text-center text-stone-400">No items found matching your search.</td></tr>
                  ) : (
                    items.map((item, idx) => {
                      const isLow = (item.quantity ?? 0) <= (item.reorder_level ?? 0);
                      return (
                        <tr key={item.id ?? item.sku ?? idx} className="hover:bg-stone-50/50 transition-colors">
                          <td className="p-4">
                            <p className="font-medium text-stone-900">{item.item_name || item.name}</p>
                            <p className="text-[11px] font-mono text-stone-400 mt-0.5 uppercase tracking-tighter">{item.sku}</p>
                          </td>
                          <td className="p-4">
                            <span className="text-[12px] bg-stone-100 px-2 py-0.5 rounded text-stone-600 capitalize font-medium">{item.category}</span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex flex-col items-center">
                              <p className={`font-semibold ${isLow ? 'text-amber-600' : 'text-stone-900'}`}>{item.quantity ?? 0} {item.unit_of_measure || item.unit}</p>
                              <p className="text-[10px] text-stone-400 mt-0.5">Min: {item.reorder_level ?? 0}</p>
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <p className="font-medium text-stone-900">KES {formatNumber(item.cost_price || 0)}</p>
                            <p className="text-[10px] text-stone-400 mt-0.5">Per {item.unit_of_measure || item.unit}</p>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => window.location.href = `/dashboard/central-store/receiving?sku=${item.sku}`}
                                className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Receive Stock"
                              >
                                <ShoppingCart className="h-4 w-4" />
                              </button>
                              <button onClick={() => openEditModal(item)} className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors">
                                <Edit className="h-4 w-4" />
                              </button>
                              <button onClick={() => handleDelete(item.sku)} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination UI */}
            {!isLoading && totalPages > 1 && (
              <div className="p-4 border-t border-stone-100 flex items-center justify-between bg-stone-50/30">
                <p className="text-[12px] text-stone-500">
                  Showing page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="h-8 px-3 text-[12px] border border-stone-200 rounded md hover:bg-white disabled:opacity-50 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="h-8 px-3 text-[12px] bg-stone-900 text-white rounded md hover:bg-black disabled:opacity-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Upsert Modal - Standard Manager Styling */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-md bg-white border-none shadow-2xl p-0 overflow-hidden rounded-xl">
            <div className="bg-stone-50 border-b border-stone-100 p-5">
              <DialogHeader>
                <DialogTitle className="text-[18px] font-semibold text-stone-900">{isEdit ? 'Update Item Details' : 'Add New Catalog Item'}</DialogTitle>
                <p className="text-[12px] text-stone-500 mt-1">Configure item properties and stock parameters.</p>
              </DialogHeader>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 block">Item Name</label>
                <Input
                  className="bg-white border-stone-200 focus:ring-stone-500"
                  value={formData.item_name}
                  onChange={(e) => {
                    setFormData({ ...formData, item_name: e.target.value });
                    if (!isEdit) suggestAttributes(e.target.value);
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 block">Category</label>
                  <select
                    className="w-full h-10 px-3 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-stone-400 transition-shadow"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="">Select...</option>
                    <option value="food">Foodstuffs</option>
                    <option value="beverage">Beverage</option>
                    <option value="toiletries">Toiletries</option>
                    <option value="linen">Linen</option>
                    <option value="office_supplies">Stationery & Office</option>
                    <option value="cleaning_supplies">Cleaning Supplies</option>
                    <option value="maintenance_items">Maintenance</option>
                    <option value="kitchen_equipment">Kitchen Equipment</option>
                    <option value="amenities">Amenities/Guest</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 block">Unit Measure</label>
                  <select
                    className="w-full h-10 px-3 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-stone-400 transition-shadow"
                    value={formData.unit_of_measure}
                    onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                  >
                    <option value="">Select...</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="liters">Liters (L)</option>
                    <option value="packets">Packets</option>
                    <option value="bottles">Bottles</option>
                    <option value="units">Units</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 block">Reorder Level</label>
                  <Input
                    type="number"
                    className="bg-white border-stone-200"
                    value={formData.reorder_level}
                    onChange={(e) => setFormData({ ...formData, reorder_level: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 block">Cost Price (KES)</label>
                  <Input
                    type="number"
                    className="bg-white border-stone-200"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <div className="p-5 bg-stone-50 border-t border-stone-100 flex justify-end gap-2">
              <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={handleCreateOrUpdate}
                disabled={isActionLoading || !formData.item_name}
                className="btn-primary"
              >
                {isActionLoading ? 'Saving...' : isEdit ? 'Update Catalog' : 'Add to Catalog'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
