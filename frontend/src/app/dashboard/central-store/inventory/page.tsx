'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { storeAPI, procurementAPI, suppliersAPI, InventoryItem } from '@/lib/api';
import { Package, Plus, RefreshCw, Search, Trash2, Edit, AlertTriangle, ChevronRight, ShoppingCart, ListChecks, FileText, X } from 'lucide-react';
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
  const [formData, setFormData] = useState({ item_name: '', category: '', unit_of_measure: '', reorder_level: 0, cost_price: 0, sku: '', store_type: 'foodstuffs', quantity: 0 });
  const [globalStats, setGlobalStats] = useState({ total: 0, inStock: 0, lowStock: 0, outOfStock: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Tab switcher filter state for Foods vs Bar Store
  const [storeTypeFilter, setStoreTypeFilter] = useState<'all' | 'foodstuffs' | 'bar_store'>('all');
  
  // Split valuation state
  const [valuationData, setValuationData] = useState<any>({
    foodstuffs: { item_count: 0, total_quantity: 0, total_value: 0 },
    bar_store: { item_count: 0, total_quantity: 0, total_value: 0 },
    grand_total: { item_count: 0, total_quantity: 0, total_value: 0 }
  });

  // Bulk reclassify state
  const [selectedItemSkus, setSelectedItemSkus] = useState<Set<string>>(new Set());
  const [isBulkReclassifying, setIsBulkReclassifying] = useState(false);

  // Procurement Planner States
  const [viewMode, setViewMode] = useState<'inventory' | 'planner'>('inventory');
  const [plannedItems, setPlannedItems] = useState<Set<string>>(new Set());
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  const fetchValuation = useCallback(async () => {
    try {
      const res = await storeAPI.getCentralValuation();
      if (res.success) {
        setValuationData(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch split valuation data:', e);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getItems({ 
        page: currentPage, 
        limit: 50,
        search: searchQuery,
        ...(storeTypeFilter !== 'all' ? { store_type: storeTypeFilter } : {})
      });
      
      if (response.success) {
        setItems(response.data || []);
        setTotalPages(response.pages || 1);
        
        // Update stats from response
        if (response.stats) {
          setGlobalStats({
            total: response.stats.total || 0,
            inStock: response.stats.inStock || 0,
            lowStock: response.stats.lowStock || 0,
            outOfStock: response.stats.outOfStock || 0
          });
        }
      }
    } catch (error: any) { 
      console.error('Error fetching items:', error);
      toast.error(error.message || 'Failed to fetch inventory items');
    }
    finally { setIsLoading(false); }
  }, [currentPage, searchQuery, storeTypeFilter]);

  useEffect(() => { 
    fetchItems();
    fetchValuation();
  }, [fetchItems, fetchValuation]);

  const handleBulkReclassify = async (targetStoreType: 'foodstuffs' | 'bar_store') => {
    if (selectedItemSkus.size === 0) return;
    setIsBulkReclassifying(true);
    toast.loading(`Reclassifying ${selectedItemSkus.size} items...`);
    try {
      let successCount = 0;
      for (const sku of selectedItemSkus) {
        const item = items.find(i => i.sku === sku);
        if (item) {
          await storeAPI.updateItem(sku, { store_type: targetStoreType });
          successCount++;
        }
      }
      toast.dismiss();
      toast.success(`Successfully reclassified ${successCount} items to ${targetStoreType === 'foodstuffs' ? 'Foodstuffs' : 'Bar Store'}`);
      setSelectedItemSkus(new Set());
      fetchItems();
      fetchValuation();
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || 'Failed to reclassify some items');
    } finally {
      setIsBulkReclassifying(false);
    }
  };

  const handleCreateOrUpdate = async () => {
    setIsActionLoading(true);
    try {
      const payload = { ...formData, quantity: isEdit ? (selectedItem?.quantity || 0) : formData.quantity };
      const response = isEdit && selectedItem
        ? await storeAPI.updateItem(selectedItem.sku, payload)
        : await storeAPI.createItem(payload);

      if (response.success) {
        toast.success(isEdit ? 'Item updated' : 'Item added');
        setModalOpen(false);
        fetchItems();
        fetchValuation();
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
      sku: item.sku || '',
      store_type: (item as any).store_type || 'foodstuffs',
      quantity: item.quantity || 0
    });
    setModalOpen(true);
  };

  const openAddModal = () => {
    setIsEdit(false);
    setSelectedItem(null);
    setFormData({ item_name: '', category: '', unit_of_measure: '', reorder_level: 0, cost_price: 0, sku: '', store_type: 'foodstuffs', quantity: 0 });
    setModalOpen(true);
  };

  const fetchSuppliers = async () => {
    try {
      const res = await suppliersAPI.getSuppliers();
      if (res.success) setSuppliers(res.data || []);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    if (viewMode === 'planner') fetchSuppliers();
  }, [viewMode]);

  const toggleItemSelection = (sku: string) => {
    const next = new Set(plannedItems);
    if (next.has(sku)) next.delete(sku);
    else next.add(sku);
    setPlannedItems(next);
  };

  const handleCreateBulkPO = async () => {
    if (!selectedSupplierId || plannedItems.size === 0) return;
    setIsActionLoading(true);
    try {
      const poItems = items
        .filter(item => plannedItems.has(item.sku))
        .map(item => ({
          item_id: item.sku,
          quantity: Math.max(1, (item.reorder_level || 0) * 2 - (item.quantity || 0)), // Suggest quantity
          unit_price: item.cost_price || 0
        }));

      const res = await procurementAPI.createPurchaseOrder({
        supplier_id: selectedSupplierId,
        items: poItems,
        auto_approve: false
      });

      if (res.success) {
        toast.success('Draft Purchase Order created successfully');
        setPoModalOpen(false);
        setPlannedItems(new Set());
        window.location.href = '/dashboard/central-store/suppliers/purchase-orders';
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create PO');
    } finally {
      setIsActionLoading(false);
    }
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
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">
                {viewMode === 'inventory' ? 'Master Inventory' : 'Procurement Planner'}
              </h1>
              <p className="text-stone-500 mt-0.5">
                {viewMode === 'inventory' 
                  ? 'Central catalog of all items and materials' 
                  : 'Identify low stock items and generate purchase orders'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-stone-100 p-1 rounded-lg flex mr-2">
                <button 
                  onClick={() => setViewMode('inventory')}
                  className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all ${viewMode === 'inventory' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  Inventory
                </button>
                <button 
                  onClick={() => setViewMode('planner')}
                  className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all ${viewMode === 'planner' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  PO Planner
                </button>
              </div>
              <button onClick={fetchItems} className="btn-secondary h-10 px-3">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              {viewMode === 'inventory' ? (
                <button onClick={openAddModal} className="btn-primary h-10">
                  <Plus className="h-4 w-4" />
                  <span>Add New Item</span>
                </button>
              ) : (
                <button 
                  onClick={() => setPoModalOpen(true)} 
                  disabled={plannedItems.size === 0}
                  className="btn-primary h-10 bg-emerald-600 hover:bg-emerald-700 border-emerald-600 disabled:opacity-50"
                >
                  <FileText className="h-4 w-4" />
                  <span>Create PO ({plannedItems.size})</span>
                </button>
              )}
            </div>
          </div>

          {/* Central Valuation Split Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-stone-100 p-5 rounded-xl shadow-sm border-l-4 border-l-emerald-500">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">🥦 FOODSTUFFS STORE</p>
                  <p className="text-[12px] text-stone-500 mt-1">{valuationData.foodstuffs.item_count} items • {valuationData.foodstuffs.total_quantity} units</p>
                </div>
                <p className="text-2xl font-bold text-stone-900">KES {formatNumber(valuationData.foodstuffs.total_value)}</p>
              </div>
            </div>
            
            <div className="bg-white border border-stone-100 p-5 rounded-xl shadow-sm border-l-4 border-l-amber-500">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">🍺 BAR STORE</p>
                  <p className="text-[12px] text-stone-500 mt-1">{valuationData.bar_store.item_count} items • {valuationData.bar_store.total_quantity} units</p>
                </div>
                <p className="text-2xl font-bold text-stone-900">KES {formatNumber(valuationData.bar_store.total_value)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-stone-900 text-white p-4 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between items-center gap-2">
            <div>
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider text-stone-400">GRAND TOTAL VALUATION</p>
              <p className="text-[12px] text-stone-300 mt-0.5">{valuationData.grand_total.item_count} active SKUs across both stores</p>
            </div>
            <p className="text-2xl font-extrabold tracking-tight">KES {formatNumber(valuationData.grand_total.total_value)}</p>
          </div>

          {/* Stats Summary - Minimal Stone */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm">
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Total SKU</p>
              {isLoading ? (
                <Skeleton className="h-8 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-semibold text-stone-900 mt-1">{globalStats.total}</p>
              )}
            </div>
            <div className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm">
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">In Stock</p>
              {isLoading ? (
                <Skeleton className="h-8 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-semibold text-stone-900 mt-1">{globalStats.inStock}</p>
              )}
            </div>
            <div 
              onClick={() => { setViewMode('planner'); setSearchQuery(''); }}
              className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm border-l-4 border-l-amber-400 cursor-pointer hover:bg-stone-50 transition-colors"
            >
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Low Stock</p>
              {isLoading ? (
                <Skeleton className="h-8 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-semibold text-amber-600 mt-1">{globalStats.lowStock}</p>
              )}
            </div>
            <div className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm">
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Out of Stock</p>
              {isLoading ? (
                <Skeleton className="h-8 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-semibold text-stone-300 mt-1">{globalStats.outOfStock}</p>
              )}
            </div>
          </div>

          {/* Search, Tabs & Bulk Reclassify Actions */}
          <div className="bg-white p-4 rounded-xl border border-stone-100 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  placeholder={viewMode === 'inventory' ? "Search by name or SKU..." : "Filter low stock items..."}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
              </div>

              {/* Tab Switcher */}
              <div className="bg-stone-100 p-1 rounded-lg flex self-start md:self-auto shrink-0">
                <button
                  onClick={() => { setStoreTypeFilter('all'); setCurrentPage(1); }}
                  className={`px-3 py-1.5 text-[12px] font-semibold rounded-md transition-all ${storeTypeFilter === 'all' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  All ({valuationData.grand_total.item_count})
                </button>
                <button
                  onClick={() => { setStoreTypeFilter('foodstuffs'); setCurrentPage(1); }}
                  className={`px-3 py-1.5 text-[12px] font-semibold rounded-md transition-all ${storeTypeFilter === 'foodstuffs' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  🥦 Foodstuffs ({valuationData.foodstuffs.item_count})
                </button>
                <button
                  onClick={() => { setStoreTypeFilter('bar_store'); setCurrentPage(1); }}
                  className={`px-3 py-1.5 text-[12px] font-semibold rounded-md transition-all ${storeTypeFilter === 'bar_store' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  🍺 Bar Store ({valuationData.bar_store.item_count})
                </button>
              </div>
            </div>

            {/* Bulk Actions (Admin-only / Super Admin "Reclassify" tool) */}
            {selectedItemSkus.size > 0 && (
              <div className="bg-stone-50 border border-stone-100 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
                <p className="text-[12px] font-medium text-stone-600">
                  Selected <span className="font-bold text-stone-900">{selectedItemSkus.size}</span> items
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Reclassify to:</span>
                  <button
                    onClick={() => handleBulkReclassify('foodstuffs')}
                    disabled={isBulkReclassifying}
                    className="h-8 px-3 text-[11px] font-bold bg-white border border-stone-200 text-stone-700 rounded hover:bg-stone-50"
                  >
                    🥦 foodstuffs
                  </button>
                  <button
                    onClick={() => handleBulkReclassify('bar_store')}
                    disabled={isBulkReclassifying}
                    className="h-8 px-3 text-[11px] font-bold bg-white border border-stone-200 text-stone-700 rounded hover:bg-stone-50"
                  >
                    🍺 bar_store
                  </button>
                  <button
                    onClick={() => setSelectedItemSkus(new Set())}
                    className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded"
                  >
                    Clear selection
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Items Table - Minimal Monochrome */}
          <div className="bg-white rounded-lg border border-stone-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50/50 border-b border-stone-100 text-left">
                  <tr>
                    {viewMode === 'planner' && (
                      <th className="p-4 w-10">
                        <input 
                          type="checkbox" 
                          onChange={(e) => {
                            if (e.target.checked) {
                              const lowStock = items.filter(i => (i.quantity ?? 0) <= (i.reorder_level ?? 0)).map(i => i.sku);
                              setPlannedItems(new Set(lowStock));
                            } else {
                              setPlannedItems(new Set());
                            }
                          }}
                        />
                      </th>
                    )}
                    {viewMode === 'inventory' && (
                      <th className="p-4 w-10">
                        <input
                          type="checkbox"
                          checked={items.length > 0 && items.every(i => selectedItemSkus.has(i.sku))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItemSkus(new Set(items.map(i => i.sku)));
                            } else {
                              setSelectedItemSkus(new Set());
                            }
                          }}
                        />
                      </th>
                    )}
                    <th className="p-4 font-semibold text-stone-500 uppercase text-[11px] tracking-wider">Item Details</th>
                    <th className="p-4 font-semibold text-stone-500 uppercase text-[11px] tracking-wider">Category / Store</th>
                    <th className="p-4 font-semibold text-stone-500 uppercase text-[11px] tracking-wider text-center">Stock Level</th>
                    <th className="p-4 font-semibold text-stone-500 uppercase text-[11px] tracking-wider text-right">Unit Price</th>
                    <th className="p-4 font-semibold text-stone-500 uppercase text-[11px] tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {isLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <tr key={`skeleton-${i}`}><td colSpan={viewMode === 'inventory' ? 6 : 5} className="p-4"><Skeleton className="h-10 w-full" /></td></tr>
                    ))
                  ) : items.length === 0 ? (
                    <tr><td colSpan={6} className="p-20 text-center text-stone-400">No items found matching your search.</td></tr>
                  ) : (
                    items
                      .filter(item => {
                        if (viewMode === 'planner') {
                          return (item.quantity ?? 0) <= (item.reorder_level ?? 0);
                        }
                        return true;
                      })
                      .map((item, idx) => {
                        const isLow = (item.quantity ?? 0) <= (item.reorder_level ?? 0);
                        const itemStoreType = (item as any).store_type || 'foodstuffs';
                        return (
                          <tr key={item.id ?? item.sku ?? idx} className={`hover:bg-stone-50/50 transition-colors ${plannedItems.has(item.sku) || selectedItemSkus.has(item.sku) ? 'bg-emerald-50/20' : ''}`}>
                            {viewMode === 'planner' && (
                              <td className="p-4">
                                <input 
                                  type="checkbox" 
                                  checked={plannedItems.has(item.sku)}
                                  onChange={() => toggleItemSelection(item.sku)}
                                />
                              </td>
                            )}
                            {viewMode === 'inventory' && (
                              <td className="p-4">
                                <input
                                  type="checkbox"
                                  checked={selectedItemSkus.has(item.sku)}
                                  onChange={() => {
                                    const next = new Set(selectedItemSkus);
                                    if (next.has(item.sku)) next.delete(item.sku);
                                    else next.add(item.sku);
                                    setSelectedItemSkus(next);
                                  }}
                                />
                              </td>
                            )}
                            <td className="p-4">
                              <p className="font-medium text-stone-900">{item.item_name || item.name}</p>
                              <p className="text-[11px] font-mono text-stone-400 mt-0.5 uppercase tracking-tighter">{item.sku}</p>
                            </td>
                            <td className="p-4 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 capitalize font-medium">{item.category}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${itemStoreType === 'bar_store' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                  {itemStoreType === 'bar_store' ? '🍺 Bar' : '🥦 Foodstuffs'}
                                </span>
                              </div>
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
              <div>
                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 block">Initial Stock Quantity</label>
                <Input
                  type="number"
                  min="0"
                  className="bg-white border-stone-200"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  placeholder="Enter initial stock amount (optional)"
                  disabled={isEdit}
                />
                <p className="text-[10px] text-stone-400 mt-1">
                  {isEdit ? 'Stock cannot be edited here. Use Receiving/GRN to adjust stock.' : 'Leave at 0 to add stock later via receiving/GRN'}
                </p>
              </div>
              <div>
                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 block">Store Type (Classification) *</label>
                <select
                  required
                  className="w-full h-10 px-3 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-stone-400 transition-shadow font-medium text-stone-800"
                  value={formData.store_type}
                  onChange={(e) => setFormData({ ...formData, store_type: e.target.value })}
                >
                  <option value="foodstuffs">🥦 Foodstuffs (Consumables, dry store, packaging)</option>
                  <option value="bar_store">🍺 Bar Store (Spirits, beers, wines, bar consumables)</option>
                </select>
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

        {/* PO Creation Modal - Procurement Planner */}
        <Dialog open={poModalOpen} onOpenChange={setPoModalOpen}>
          <DialogContent className="max-w-md bg-white border-none shadow-2xl p-0 overflow-hidden rounded-xl">
            <div className="bg-stone-50 border-b border-stone-100 p-5">
              <DialogHeader>
                <DialogTitle className="text-[18px] font-semibold text-stone-900">Create Bulk Purchase Order</DialogTitle>
                <p className="text-[12px] text-stone-500 mt-1">Select a supplier to fulfill the selected {plannedItems.size} items.</p>
              </DialogHeader>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 block">Target Supplier</label>
                <select
                  className="w-full h-10 px-3 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-stone-400 transition-shadow"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                >
                  <option value="">Select a supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.supplier_code})</option>
                  ))}
                </select>
              </div>
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-[12px] text-amber-800 leading-relaxed">
                  System will suggest quantities based on 2x Reorder Level minus current stock. You can edit these in the Draft PO before approving.
                </p>
              </div>
            </div>
            <div className="p-5 bg-stone-50 border-t border-stone-100 flex justify-end gap-2">
              <button onClick={() => setPoModalOpen(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={handleCreateBulkPO}
                disabled={isActionLoading || !selectedSupplierId}
                className="btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
              >
                {isActionLoading ? 'Creating PO...' : 'Generate Draft PO'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
