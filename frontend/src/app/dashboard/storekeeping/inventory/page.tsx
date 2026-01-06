'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from "@/components/ui/minimal/button";
import { Input } from '@/components/ui/input';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { IOSButton } from '@/components/ui/ios-button';
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
  Lock, Unlock, Settings, FileSpreadsheet, Building2, Barcode, Eye
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// SKU Category codes mapping - matches backend sku.service.ts
const CATEGORY_CODES: Record<string, string> = {
  'Bar': 'BAR',
  'Bar & Beverages': 'BAR',
  'Beverages': 'BAR',
  'Kitchen': 'KIT',
  'Food': 'KIT',
  'Housekeeping': 'HK',
  'Cleaning': 'HK',
  'Maintenance': 'MNT',
  'Laundry': 'LDR',
  'Amenities': 'GEN',
  'Office': 'OFF',
  'General': 'GEN',
  'Other': 'GEN'
};

const CATEGORIES = [
  { name: 'Bar & Beverages', code: 'BAR' },
  { name: 'Kitchen', code: 'KIT' },
  { name: 'Housekeeping', code: 'HK' },
  { name: 'Maintenance', code: 'MNT' },
  { name: 'Laundry', code: 'LDR' },
  { name: 'Office', code: 'OFF' },
  { name: 'General', code: 'GEN' }
];
const UNITS = ['piece', 'kg', 'liter', 'bottle', 'packet', 'box', 'tray', 'roll', 'carton', 'case', 'dozen'];

interface Branch {
  id: number;
  name: string;
  code: string;
  is_central_warehouse?: boolean;
}

interface Item {
  id?: number;
  sku: string;
  barcode?: string;
  item_name: string;
  description?: string;
  category: string;
  category_code?: string;
  unit_of_measure: string;
  quantity: number;
  retail_price?: number;
  cost_price?: number;
  reorder_level?: number;
  supplier?: string;
  is_active?: boolean;
  is_auto_sku?: boolean;
  branch_id?: number;
}

// Generate SKU preview (matches backend logic)
function generateSKUPreview(category: string, itemName: string): string {
  const categoryCode = CATEGORY_CODES[category] || 'GEN';
  const productCode = itemName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .substring(0, 6) || 'ITEM';
  return `FGH-${categoryCode}-${productCode}-XXXX`;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const canEdit = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER || user?.role === UserRole.CENTRAL_STOREKEEPER;
  const isCentralUser = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER || user?.role === UserRole.CENTRAL_STOREKEEPER;

  const [items, setItems] = useState<Item[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
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
  const [isSaving, setIsSaving] = useState(false);
  const [skuPreview, setSkuPreview] = useState('');

  const [itemForm, setItemForm] = useState<Partial<Item>>({
    sku: '',
    barcode: '',
    item_name: '',
    description: '',
    category: 'Bar & Beverages',
    unit_of_measure: 'piece',
    quantity: 0,
    retail_price: 0,
    cost_price: 0,
    reorder_level: 10,
    supplier: ''
  });

  // Update SKU preview when item name or category changes
  useEffect(() => {
    if (!itemForm.sku || itemForm.sku === '') {
      setSkuPreview(generateSKUPreview(itemForm.category || 'General', itemForm.item_name || ''));
    } else {
      setSkuPreview(itemForm.sku);
    }
  }, [itemForm.item_name, itemForm.category, itemForm.sku]);

  // Fetch branches on mount
  useEffect(() => {
    fetchBranches();
    fetchConfig();
  }, []);

  // Fetch items when branch changes
  useEffect(() => {
    if (selectedBranch !== null || !isCentralUser) {
      fetchItems();
    }
  }, [selectedBranch]);

  const fetchBranches = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/branches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const branchList = Array.isArray(data.data) ? data.data : [];
        setBranches(branchList);

        // Auto-select user's branch or first branch
        if (user?.branch_id) {
          setSelectedBranch(user.branch_id);
        } else if (branchList.length > 0) {
          // For central users, select central warehouse first
          const central = branchList.find((b: Branch) => b.is_central_warehouse);
          setSelectedBranch(central?.id || branchList[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

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
      // Use branch-specific endpoint if branch is selected
      const url = selectedBranch
        ? `${API_URL}/api/store/items?branch_id=${selectedBranch}`
        : `${API_URL}/api/store/items`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setItems(Array.isArray(data.data) ? data.data : []);
      }
    } catch (error) {
      toast.error('Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!itemForm.item_name?.trim()) {
      toast.error('Item name is required');
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');

      // Prepare payload - SKU will be auto-generated by backend if empty
      const payload = {
        ...itemForm,
        sku: itemForm.sku?.trim() || '', // Empty = auto-generate
        barcode: itemForm.barcode?.trim() || null,
        branch_id: selectedBranch
      };

      const response = await fetch(`${API_URL}/api/store/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const generatedSku = result.data?.sku || 'unknown';
        toast.success(`Item added successfully! SKU: ${generatedSku}`);
        setIsAddModalOpen(false);
        fetchItems();
        // Reset form
        setItemForm({
          sku: '',
          barcode: '',
          item_name: '',
          description: '',
          category: 'Bar & Beverages',
          unit_of_measure: 'piece',
          quantity: 0,
          retail_price: 0,
          cost_price: 0,
          reorder_level: 10,
          supplier: ''
        });
      } else {
        throw new Error(result.message || 'Failed to add item');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to add item');
    } finally {
      setIsSaving(false);
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
    <ProtectedRoute
      allowedRoles={[
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER,
        UserRole.BRANCH_MANAGER,
        UserRole.CENTRAL_STOREKEEPER,
        UserRole.BRANCH_STOREKEEPER
      ]}
    >
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[22px] sm:text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Inventory Items</h1>
              <p className="text-stone-500 text-sm mt-0.5">Manage stock across active branches</p>
            </div>
            <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 xs:pb-0">
                {editLock && (
                  <IOSBadge className="bg-stone-100 text-stone-600 border-stone-200 flex items-center gap-1.5 h-10 px-3 shrink-0">
                    <Lock className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-bold">LOCKED</span>
                  </IOSBadge>
                )}
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="btn-secondary h-10 px-3 flex items-center justify-center gap-2 shrink-0"
                >
                  <Download className="h-4 w-4" />
                  <span className="text-[13px]">{isExporting ? '...' : 'Export'}</span>
                </button>
                <button
                  onClick={fetchItems}
                  className="btn-secondary h-10 px-3 flex items-center justify-center gap-2 shrink-0"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="flex gap-2">
                {canEdit && (
                  <button
                    onClick={openAddModal}
                    disabled={editLock}
                    className="flex-1 xs:flex-none btn-primary h-10 px-4 flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Item</span>
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => setIsConfigModalOpen(true)}
                    className="btn-secondary h-10 w-10 flex items-center justify-center shrink-0"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Items', value: items.length, icon: Package, color: 'text-stone-600', bg: 'bg-stone-50' },
              { label: 'Low Stock', value: lowStockCount, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Total Value', value: `KES ${totalValue.toLocaleString()}`, icon: BarChart3, color: 'text-amber-600', bg: 'bg-amber-50', span: true },
              { label: 'Categories', value: new Set(items.map(i => i.category)).size, icon: Filter, color: 'text-blue-600', bg: 'bg-blue-50' },
            ].map((stat, i) => (
              <IOSCard key={i} className={`p-3 sm:p-4 shadow-sm flex items-center gap-3 sm:gap-4 ${stat.span ? 'col-span-2 md:col-span-1' : ''}`}>
                <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">{stat.label}</p>
                  <p className="text-lg sm:text-xl font-bold text-stone-900 truncate">{stat.value}</p>
                </div>
              </IOSCard>
            ))}
          </div>

          {/* Branch Selector & Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              {isCentralUser && branches.length > 0 && (
                <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 h-11 sm:min-w-[200px]">
                  <Building2 className="h-4 w-4 text-stone-400 shrink-0" />
                  <select
                    value={selectedBranch || ''}
                    onChange={(e) => setSelectedBranch(parseInt(e.target.value))}
                    className="w-full bg-transparent text-sm font-semibold text-stone-700 focus:outline-none"
                  >
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} {branch.is_central_warehouse ? '(Central)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-stone-400" />
                <input
                  type="text"
                  placeholder="Search materials, SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-11 pl-9 pr-4 text-sm bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 transition-all font-medium"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
              <button
                onClick={() => setCategoryFilter('')}
                className={`h-9 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${categoryFilter === '' ? 'bg-stone-900 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >
                All Categories
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.code}
                  onClick={() => setCategoryFilter(cat.name)}
                  className={`h-9 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${categoryFilter === cat.name ? 'bg-stone-900 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Items Table */}
          <IOSCard className="overflow-hidden border-stone-200 shadow-sm">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-100">
                    <th className="px-5 py-4 text-left text-[10px] font-bold text-stone-400 uppercase tracking-wider">Item Details</th>
                    <th className="px-4 py-4 text-left text-[10px] font-bold text-stone-400 uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-4 text-left text-[10px] font-bold text-stone-400 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-4 text-center text-[10px] font-bold text-stone-400 uppercase tracking-wider">Stock</th>
                    <th className="px-4 py-4 text-right text-[10px] font-bold text-stone-400 uppercase tracking-wider">Price</th>
                    {canEdit && <th className="px-5 py-4 text-right text-[10px] font-bold text-stone-400 uppercase tracking-wider">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {filteredItems.map((item) => {
                    const isLowStock = (item.quantity || 0) <= (item.reorder_level || 10);
                    return (
                      <tr key={item.sku} className="group hover:bg-stone-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-[13px] font-bold text-stone-900 leading-tight">{item.item_name}</p>
                          <p className="text-[11px] text-stone-400 mt-0.5 font-medium line-clamp-1">{item.description || '-'}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <code className="text-[11px] font-bold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-md">{item.sku}</code>
                        </td>
                        <td className="px-4 py-3.5">
                          <IOSBadge size="sm" className="bg-stone-50 text-stone-600 border-stone-200 text-[10px]">
                            {item.category}
                          </IOSBadge>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className={`inline-flex flex-col items-center ${isLowStock ? 'text-red-600' : 'text-stone-900'}`}>
                            <span className="text-[13px] font-bold">{item.quantity || 0}</span>
                            <span className="text-[10px] font-bold opacity-50 uppercase">{item.unit_of_measure}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-stone-900 text-[13px]">
                          KES {(item.retail_price || 0).toLocaleString()}
                        </td>
                        {canEdit && (
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditModal(item)}
                                className="p-2 h-9 w-9 flex items-center justify-center rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-900 hover:text-white transition-all"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedItem(item);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="p-2 h-9 w-9 flex items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
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

        {/* Add Modal - Enhanced with SKU preview and barcode */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Add New Inventory Item
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* SKU Preview Banner */}
              <div className="p-3 sm:p-4 bg-stone-50 rounded-xl border border-stone-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">SKU Preview</p>
                    <p className="font-mono text-lg font-bold text-stone-900 leading-tight">{skuPreview}</p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-[10px] font-bold text-stone-400">FORMAT: FGH-[CAT]-[NAME]-[XXXX]</p>
                    <p className="text-[10px] font-bold text-amber-600 mt-0.5 whitespace-nowrap">AUTO-GENERATES IF EMPTY</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1">Item Name *</p>
                    <input
                      placeholder="e.g., White Bread 400g"
                      value={itemForm.item_name}
                      onChange={(e) => setItemForm({ ...itemForm, item_name: e.target.value })}
                      className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1">Custom SKU (Optional)</p>
                    <input
                      placeholder="Enter custom SKU code"
                      value={itemForm.sku}
                      onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                      className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-mono font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1 flex items-center gap-1">
                      <Barcode className="h-3 w-3" /> Barcode
                    </p>
                    <input
                      placeholder="Scan or enter barcode"
                      value={itemForm.barcode}
                      onChange={(e) => setItemForm({ ...itemForm, barcode: e.target.value })}
                      className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-mono font-medium"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1">Description</p>
                    <input
                      placeholder="Add brief details..."
                      value={itemForm.description}
                      onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                      className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1">Category *</p>
                    <select
                      value={itemForm.category}
                      onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                      className="w-full h-11 px-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 text-sm font-bold text-stone-700"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat.code} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1">Unit of Measure</p>
                    <select
                      value={itemForm.unit_of_measure}
                      onChange={(e) => setItemForm({ ...itemForm, unit_of_measure: e.target.value })}
                      className="w-full h-11 px-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 text-sm font-bold text-stone-700"
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1">Initial Qty</p>
                    <input
                      type="number"
                      min="0"
                      value={itemForm.quantity}
                      onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 0 })}
                      className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-bold text-stone-900"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1">Cost Price</p>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemForm.cost_price}
                      onChange={(e) => setItemForm({ ...itemForm, cost_price: parseFloat(e.target.value) || 0 })}
                      className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-bold text-stone-900"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1">Retail Price</p>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemForm.retail_price}
                      onChange={(e) => setItemForm({ ...itemForm, retail_price: parseFloat(e.target.value) || 0 })}
                      className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-bold text-stone-900"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1">Min. Level</p>
                    <input
                      type="number"
                      min="0"
                      value={itemForm.reorder_level}
                      onChange={(e) => setItemForm({ ...itemForm, reorder_level: parseInt(e.target.value) || 10 })}
                      className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-bold text-stone-900"
                    />
                  </div>
                </div>

                {/* Branch indicator */}
                {selectedBranch && branches.length > 0 && (
                  <div className="p-2 bg-blue-50 rounded-lg text-sm text-blue-700 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Adding to: <strong>{branches.find(b => b.id === selectedBranch)?.name || 'Unknown'}</strong>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-stone-100">
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 h-11 btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddItem}
                    disabled={isSaving}
                    className="flex-[2] h-11 btn-primary flex items-center justify-center gap-2"
                  >
                    {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>{isSaving ? 'Saving...' : 'Create Item'}</span>
                  </button>
                </div>
              </div>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Edit Item Details
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1">Item Name *</p>
                  <input
                    value={itemForm.item_name}
                    onChange={(e) => setItemForm({ ...itemForm, item_name: e.target.value })}
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1">SKU (Read Only)</p>
                  <input
                    value={itemForm.sku}
                    disabled
                    className="w-full h-11 px-4 text-sm bg-stone-100 border border-stone-200 rounded-xl font-mono text-stone-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1">Category</p>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full h-11 px-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 text-sm font-bold text-stone-700"
                  >
                    {CATEGORIES.map(cat => <option key={cat.code} value={cat.name}>{cat.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1">Unit</p>
                  <select
                    value={itemForm.unit_of_measure}
                    onChange={(e) => setItemForm({ ...itemForm, unit_of_measure: e.target.value })}
                    className="w-full h-11 px-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 text-sm font-bold text-stone-700"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1">Quantity</p>
                  <input
                    type="number"
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-bold text-stone-900"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1">Cost Price</p>
                  <input
                    type="number"
                    value={itemForm.cost_price}
                    onChange={(e) => setItemForm({ ...itemForm, cost_price: parseFloat(e.target.value) || 0 })}
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-bold text-stone-900"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1">Retail Price</p>
                  <input
                    type="number"
                    value={itemForm.retail_price}
                    onChange={(e) => setItemForm({ ...itemForm, retail_price: parseFloat(e.target.value) || 0 })}
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-bold text-stone-900"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 ml-1">Min. Level</p>
                  <input
                    type="number"
                    value={itemForm.reorder_level}
                    onChange={(e) => setItemForm({ ...itemForm, reorder_level: parseInt(e.target.value) || 10 })}
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-bold text-stone-900"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-4 border-t border-stone-100">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 h-11 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateItem}
                  className="flex-[2] h-11 btn-primary flex items-center justify-center gap-2 text-sm"
                >
                  <Save className="h-4 w-4" />
                  <span>Update Item</span>
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Modal */}
        <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-stone-900">Delete Item</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-stone-600">
                Are you sure you want to delete <strong>{selectedItem?.item_name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 pt-4 border-t border-stone-100">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 h-11 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteItem}
                className="flex-1 h-11 bg-red-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
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
              <div className="flex items-center justify-between p-4 border border-stone-200 rounded-2xl bg-stone-50/50">
                <div className="min-w-0 pr-4">
                  <p className="font-bold text-stone-900 flex items-center gap-2">
                    {editLock ? <Lock className="h-4 w-4 text-amber-600" /> : <Unlock className="h-4 w-4 text-stone-400" />}
                    Maintenance Mode
                  </p>
                  <p className="text-[11px] font-medium text-stone-500 mt-1 leading-relaxed">
                    When enabled, stock transfers and inventory edits are temporarily disabled across all branches.
                  </p>
                </div>
                <button
                  onClick={toggleEditLock}
                  className={`shrink-0 h-10 px-4 rounded-xl text-xs font-bold transition-all ${editLock
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-100'
                    : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                >
                  {editLock ? 'Disable' : 'Enable'}
                </button>
              </div>

              {/* Quick Actions */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider ml-1">Tools & Management</p>
                <button
                  onClick={handleExport}
                  className="w-full h-11 btn-secondary flex items-center justify-start gap-3 px-4"
                >
                  <Download className="h-4 w-4 text-stone-500" />
                  <span className="text-sm">Export All Items to Excel</span>
                </button>
                <label className="block">
                  <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
                  <span className="w-full h-11 btn-secondary flex items-center justify-start gap-3 px-4 cursor-pointer">
                    <Upload className="h-4 w-4 text-stone-500" />
                    <span className="text-sm">Import from Excel</span>
                  </span>
                </label>
              </div>

              <div className="flex pt-4 border-t border-stone-100">
                <button
                  onClick={() => setIsConfigModalOpen(false)}
                  className="w-full h-11 btn-secondary"
                >
                  Close Settings
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
