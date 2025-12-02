'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { IOSBadge } from '@/components/ui/ios-badge';
import { IOSCard } from '@/components/ui/ios-card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Package, Search, Plus, Edit, Trash2, RefreshCw, Save,
  Filter, Download, Upload, BarChart3, AlertTriangle,
  Lock, Unlock, Settings, FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const CATEGORIES = ['Beverages', 'Food', 'Cleaning', 'Amenities', 'Kitchen', 'Office', 'Other'];
const UNITS = ['piece', 'kg', 'liter', 'bottle', 'packet', 'box', 'tray', 'roll', 'carton'];

interface Item {
  id?: number;
  sku: string;
  barcode?: string;
  item_name: string;
  description?: string;
  category: string;
  unit_of_measure: string;
  quantity: number;
  retail_price?: number;
  cost_price?: number;
  reorder_level?: number;
  supplier?: string;
  is_active?: boolean;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const canEdit = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER || user?.role === UserRole.CENTRAL_STOREKEEPER;
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  
  // Config state
  const [editLock, setEditLock] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [itemForm, setItemForm] = useState<Partial<Item>>({
    sku: '',
    item_name: '',
    description: '',
    category: 'Beverages',
    unit_of_measure: 'piece',
    quantity: 0,
    retail_price: 0,
    cost_price: 0,
    reorder_level: 10,
    supplier: ''
  });

  useEffect(() => {
    fetchItems();
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/get_edit_lock_status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setEditLock(data.edit_lock || false);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const toggleEditLock = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/set_edit_lock_status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ edit_lock_status: !editLock })
      });
      if (response.ok) {
        setEditLock(!editLock);
        toast.success(editLock ? 'Edit lock disabled' : 'Edit lock enabled - Maintenance mode active');
      }
    } catch (error) {
      toast.error('Failed to toggle edit lock');
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/export_data`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('Export downloaded successfully');
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/store/import_data`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Import successful: ${result.created || 0} created, ${result.updated || 0} updated`);
        fetchItems();
      } else {
        const err = await response.json();
        throw new Error(err.detail || 'Import failed');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import data');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setItems(data.data || []);
      }
    } catch (error) {
      toast.error('Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(itemForm)
      });

      if (response.ok) {
        toast.success('Item added successfully');
        setIsAddModalOpen(false);
        fetchItems();
      } else {
        throw new Error('Failed to add item');
      }
    } catch (error) {
      toast.error('Failed to add item');
    }
  };

  const handleUpdateItem = async () => {
    if (!selectedItem) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/items/${selectedItem.sku}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(itemForm)
      });

      if (response.ok) {
        toast.success('Item updated successfully');
        setIsEditModalOpen(false);
        fetchItems();
      } else {
        throw new Error('Failed to update item');
      }
    } catch (error) {
      toast.error('Failed to update item');
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/items/${selectedItem.sku}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Item deleted successfully');
        setIsDeleteModalOpen(false);
        fetchItems();
      } else {
        throw new Error('Failed to delete item');
      }
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  const openAddModal = () => {
    setItemForm({
      sku: '',
      item_name: '',
      description: '',
      category: 'Beverages',
      unit_of_measure: 'piece',
      quantity: 0,
      retail_price: 0,
      cost_price: 0,
      reorder_level: 10,
      supplier: ''
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    setSelectedItem(item);
    setItemForm({ ...item });
    setIsEditModalOpen(true);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = !searchTerm || 
      item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const lowStockCount = items.filter(i => (i.quantity || 0) <= (i.reorder_level || 10)).length;
  const totalValue = items.reduce((sum, i) => sum + ((i.quantity || 0) * (i.cost_price || 0)), 0);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
              <p className="text-gray-600">Manage all inventory items across branches</p>
            </div>
            <div className="flex gap-3">
              {/* Edit Lock Indicator */}
              {editLock && (
                <IOSBadge className="bg-[#F2F2F7] text-white flex items-center gap-1 h-10 px-3">
                  <Lock className="h-4 w-4" />
                  Maintenance Mode
                </IOSBadge>
              )}
              <IOSButton variant="outline" onClick={handleExport} disabled={isExporting}>
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? 'Exporting...' : 'Export'}
              </IOSButton>
              {canEdit && (
                <label className="cursor-pointer">
                  <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" disabled={isImporting} />
                  <IOSButton variant="outline" asChild disabled={isImporting}>
                    <span><Upload className="h-4 w-4 mr-2" />{isImporting ? 'Importing...' : 'Import'}</span>
                  </IOSButton>
                </label>
              )}
              <IOSButton variant="outline" onClick={fetchItems}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </IOSButton>
              {canEdit && (
                <IOSButton variant="outline" onClick={() => setIsConfigModalOpen(true)}>
                  <Settings className="h-4 w-4" />
                </IOSButton>
              )}
              {canEdit && (
                <IOSButton onClick={openAddModal} disabled={editLock}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </IOSButton>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-[#8E8E93]0" />
                <div>
                  <p className="text-sm text-gray-500">Total Items</p>
                  <p className="text-2xl font-bold">{items.length}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-[#3C3C43]" />
                <div>
                  <p className="text-sm text-gray-500">Low Stock</p>
                  <p className="text-2xl font-bold text-[#3C3C43]">{lowStockCount}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-[#8E8E93]0" />
                <div>
                  <p className="text-sm text-gray-500">Total Value</p>
                  <p className="text-2xl font-bold">KES {totalValue.toLocaleString()}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <Filter className="h-8 w-8 text-[#3C3C43]" />
                <div>
                  <p className="text-sm text-gray-500">Categories</p>
                  <p className="text-2xl font-bold">{new Set(items.map(i => i.category)).size}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border rounded-ios-lg"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Items Table */}
          <IOSCard>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    {canEdit && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredItems.map((item) => (
                    <tr key={item.sku} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-xs text-gray-500">{item.description || '-'}</p>
                      </td>
                      <td className="px-4 py-4 font-mono text-sm">{item.sku}</td>
                      <td className="px-4 py-4">
                        <IOSBadge variant="outline">{item.category}</IOSBadge>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`font-bold ${
                          (item.quantity || 0) <= (item.reorder_level || 10) ? 'text-[#3C3C43]' : 'text-[#3C3C43]'
                        }`}>
                          {item.quantity || 0}
                        </span>
                      </td>
                      <td className="px-4 py-4">KES {(item.retail_price || 0).toLocaleString()}</td>
                      {canEdit && (
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            <IOSButton size="sm" variant="outline" onClick={() => openEditModal(item)}>
                              <Edit className="h-4 w-4" />
                            </IOSButton>
                            <IOSButton size="sm" variant="outline" className="text-[#3C3C43]" onClick={() => {
                              setSelectedItem(item);
                              setIsDeleteModalOpen(true);
                            }}>
                              <Trash2 className="h-4 w-4" />
                            </IOSButton>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredItems.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No items found</p>
                </div>
              )}
            </div>
          </IOSCard>
        </div>

        {/* Add Modal */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Item Name *</label>
                  <Input
                    value={itemForm.item_name}
                    onChange={(e) => setItemForm({ ...itemForm, item_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">SKU (auto if empty)</label>
                  <Input
                    value={itemForm.sku}
                    onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-ios-lg"
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Unit</label>
                  <select
                    value={itemForm.unit_of_measure}
                    onChange={(e) => setItemForm({ ...itemForm, unit_of_measure: e.target.value })}
                    className="w-full px-3 py-2 border rounded-ios-lg"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Quantity</label>
                  <Input type="number" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Cost Price</label>
                  <Input type="number" value={itemForm.cost_price} onChange={(e) => setItemForm({ ...itemForm, cost_price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Retail Price</label>
                  <Input type="number" value={itemForm.retail_price} onChange={(e) => setItemForm({ ...itemForm, retail_price: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <IOSButton variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</IOSButton>
                <IOSButton onClick={handleAddItem}><Save className="h-4 w-4 mr-2" />Add Item</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Item Name *</label>
                  <Input value={itemForm.item_name} onChange={(e) => setItemForm({ ...itemForm, item_name: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">SKU</label>
                  <Input value={itemForm.sku} disabled className="bg-gray-100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} className="w-full px-3 py-2 border rounded-ios-lg">
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Unit</label>
                  <select value={itemForm.unit_of_measure} onChange={(e) => setItemForm({ ...itemForm, unit_of_measure: e.target.value })} className="w-full px-3 py-2 border rounded-ios-lg">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Quantity</label>
                  <Input type="number" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Cost Price</label>
                  <Input type="number" value={itemForm.cost_price} onChange={(e) => setItemForm({ ...itemForm, cost_price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Retail Price</label>
                  <Input type="number" value={itemForm.retail_price} onChange={(e) => setItemForm({ ...itemForm, retail_price: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <IOSButton variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</IOSButton>
                <IOSButton onClick={handleUpdateItem}><Save className="h-4 w-4 mr-2" />Update</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Modal */}
        <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-[#3C3C43]">Delete Item</DialogTitle>
            </DialogHeader>
            <p>Are you sure you want to delete <strong>{selectedItem?.item_name}</strong>?</p>
            <div className="flex justify-end gap-3 pt-4">
              <IOSButton variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</IOSButton>
              <IOSButton className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={handleDeleteItem}>
                <Trash2 className="h-4 w-4 mr-2" />Delete
              </IOSButton>
            </div>
          </DialogContent>
        </Dialog>

        {/* Config Modal */}
        <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-[#3C3C43]" />
                Inventory Settings
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              {/* Edit Lock Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-ios-lg">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    {editLock ? <Lock className="h-4 w-4 text-[#3C3C43]" /> : <Unlock className="h-4 w-4 text-[#8E8E93]0" />}
                    Maintenance Mode
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    When enabled, transfers and edits are disabled
                  </p>
                </div>
                <IOSButton
                  variant={editLock ? 'default' : 'outline'}
                  className={editLock ? 'bg-[#F2F2F7] hover:bg-[#F2F2F7]' : ''}
                  onClick={toggleEditLock}
                >
                  {editLock ? 'Disable' : 'Enable'}
                </IOSButton>
              </div>

              {/* Quick Actions */}
              <div className="space-y-3">
                <p className="font-medium text-sm text-gray-500">Quick Actions</p>
                <IOSButton variant="outline" className="w-full justify-start" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export All Items to Excel
                </IOSButton>
                <label className="block">
                  <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
                  <IOSButton variant="outline" className="w-full justify-start" asChild>
                    <span><Upload className="h-4 w-4 mr-2" />Import from Excel</span>
                  </IOSButton>
                </label>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <IOSButton variant="outline" onClick={() => setIsConfigModalOpen(false)}>Close</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
