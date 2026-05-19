'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { storeAPI, auditorReportsAPI } from '@/lib/api';
import { Package, RefreshCw, Search, AlertTriangle, ShoppingCart, FileDown, TrendingDown, LayoutGrid, List, Plus, Settings2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { Skeleton } from '@/components/ui/skeleton';
import { StockAdjustmentModal } from '@/components/store/StockAdjustmentModal';

interface StockItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  min_quantity: number;
  reorder_level: number;
  unit: string;
  last_updated?: string;
  source?: 'dispatch' | 'catalog';
}

interface CatalogItem {
  sku: string;
  item_name: string;
  category: string;
  unit_of_measure: string;
  description?: string;
}

export default function BranchStockPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'stock' | 'catalog'>('stock');
  const [items, setItems] = useState<StockItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modal State
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);
  const [initialAdjustmentType, setInitialAdjustmentType] = useState<string>('MANUAL_ADJUSTMENT');

  const fetchStock = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getBranchStock();
      if (response.success && response.data) {
        const mappedItems: StockItem[] = response.data.map((record: any) => ({
          id: record.id,
          sku: record.item_sku,
          name: record.item?.item_name || 'Unknown Item',
          category: record.item?.category || 'Uncategorized',
          quantity: record.quantity || 0,
          min_quantity: record.reorder_level ?? 10,
          reorder_level: record.reorder_level ?? 10,
          unit: record.item?.unit_of_measure || 'units',
          last_updated: record.updated_at,
          source: record.source || 'catalog'
        }));
        setItems(mappedItems);
      }
    } catch (error) {
      console.error('Error fetching stock:', error);
      toast.error('Failed to load branch stock');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCatalog = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getMasterCatalog({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchQuery || undefined
      });
      if (response.success) {
        setCatalog(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching catalog:', error);
      toast.error('Failed to load master catalog');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    if (activeTab === 'stock') {
      fetchStock();
    } else {
      fetchCatalog();
    }
  }, [activeTab, fetchStock, fetchCatalog]);

  const dispatchItems = items.filter(i => i.source === 'dispatch');
  const catalogItems = items.filter(i => i.source === 'catalog');

  const filteredStock = dispatchItems.filter((i) =>
    (i.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.sku || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockItems = dispatchItems.filter(i => i.quantity <= i.reorder_level);

  const handleRequestStock = async (item: StockItem) => {
    try {
      await storeAPI.createStockRequest({
        requesting_branch_id: user?.branch_id || undefined,
        items: [{ item_sku: item.sku, requested_quantity: item.min_quantity * 2, current_branch_stock: item.quantity }],
        priority: item.quantity === 0 ? 'urgent' : 'normal',
        reason: 'Stock replenishment',
      });
      toast.success('Request submitted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit request');
    }
  };

  const handleAdjustStock = (item: StockItem) => {
    setSelectedStockItem(item);
    setInitialAdjustmentType('MANUAL_ADJUSTMENT');
    setIsAdjustmentModalOpen(true);
  };

  const handleAddToBranch = (catalogItem: CatalogItem) => {
    // We reuse the adjustment modal to perform an "Initial Stock" entry
    setSelectedStockItem({
      id: '',
      sku: catalogItem.sku,
      name: catalogItem.item_name,
      category: catalogItem.category,
      quantity: 0,
      min_quantity: 10,
      reorder_level: 10,
      unit: catalogItem.unit_of_measure
    });
    setInitialAdjustmentType('INITIAL_STOCK');
    setIsAdjustmentModalOpen(true);
  };

  const handleExport = async () => {
    try {
      toast.loading("Generating stock ledger...");
      await auditorReportsAPI.exportComprehensiveStockAudit({
        branch_id: user?.branch_id || undefined
      });
      toast.dismiss();
      toast.success("Stock ledger generated successfully");
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Failed to export ledger");
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
                {user?.role === UserRole.AUDITOR ? 'Inventory Oversight' : 'Master Inventory'}
              </h1>
              <p className="text-stone-500 text-sm">
                Manage branch stock levels and reference the master catalog.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <IOSButton variant="secondary" onClick={() => activeTab === 'stock' ? fetchStock() : fetchCatalog()} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>
                Refresh
              </IOSButton>
              {user?.role === UserRole.AUDITOR && (
                <IOSButton variant="secondary" onClick={handleExport} leftIcon={<FileDown />}>Export Ledger</IOSButton>
              )}
              {user?.role !== UserRole.AUDITOR && (
                <div className="flex gap-2">
                  <Link href="/dashboard/branch-store/receive">
                    <IOSButton variant="secondary" leftIcon={<ArrowRight className="h-4 w-4" />}>Receive Dispatches</IOSButton>
                  </Link>
                  <Link href="/dashboard/branch-store/requests">
                    <IOSButton leftIcon={<Package className="h-4 w-4" />}>My Requests</IOSButton>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Stats Summary (Always visible) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <IOSCard className="p-4 flex items-center gap-4 border-none shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">In Stock SKUs</p>
                <p className="text-xl font-black text-stone-900">{items.length}</p>
              </div>
            </IOSCard>
            <IOSCard className="p-4 flex items-center gap-4 border-l-4 border-amber-500 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Low Stock Items</p>
                <p className="text-xl font-black text-amber-600">{lowStockItems.length}</p>
              </div>
            </IOSCard>
            <IOSCard className="p-4 flex items-center gap-4 border-l-4 border-stone-300 shadow-sm sm:col-span-2 md:col-span-1">
              <div className="w-12 h-12 rounded-xl bg-stone-50 flex items-center justify-center text-stone-400">
                <LayoutGrid className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Master Catalog</p>
                <p className="text-xl font-black text-stone-900">{catalog.length || '...'}</p>
              </div>
            </IOSCard>
          </div>

          {/* Main Action Tabs */}
          <div className="flex items-center p-1 bg-stone-100 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('stock')}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'stock' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Current Stock
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'catalog' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Stock Take List
            </button>
          </div>

          {/* Search and Filters */}
          <IOSCard className="p-4 space-y-4 shadow-sm border-none">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-stone-400" />
                <Input
                  placeholder={activeTab === 'stock' ? "Search branch inventory..." : "Search master product catalog..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11 bg-stone-50 border-stone-100"
                />
              </div>
              <select
                className="h-11 px-4 bg-stone-50 border border-stone-100 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-stone-400 transition-shadow min-w-[180px]"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="food">Foodstuffs</option>
                <option value="beverage">Beverage</option>
                <option value="toiletries">Toiletries</option>
                <option value="linen">Linen</option>
                <option value="office_supplies">Stationery</option>
                <option value="cleaning_supplies">Cleaning</option>
                <option value="maintenance_items">Maintenance</option>
                <option value="kitchen_equipment">Equipment</option>
              </select>
            </div>
            {activeTab === 'stock' && user?.role !== UserRole.AUDITOR && (
              <div className="pt-4 border-t border-stone-50 flex justify-end">
                <IOSButton 
                  size="sm" 
                  variant="secondary" 
                  onClick={() => setActiveTab('catalog')}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Register Items from Catalog
                </IOSButton>
              </div>
            )}
          </IOSCard>

          {/* Table / Grid Contents */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden min-h-[400px]">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : activeTab === 'stock' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50/50 border-b border-stone-100 text-left">
                    <tr>
                      <th className="p-4 font-bold text-stone-400 uppercase text-[10px] tracking-widest px-6">Item</th>
                      <th className="p-4 font-bold text-stone-400 uppercase text-[10px] tracking-widest">Category</th>
                      <th className="p-4 font-bold text-stone-400 uppercase text-[10px] tracking-widest text-center">Available</th>
                      <th className="p-4 font-bold text-stone-400 uppercase text-[10px] tracking-widest text-right px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {filteredStock.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-20 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Package className="h-10 w-10 text-stone-200" />
                            <p className="text-stone-400">No matching items found in your branch stock.</p>
                            <IOSButton size="sm" variant="secondary" onClick={() => setActiveTab('catalog')}>
                              Find in Master Catalog
                            </IOSButton>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredStock.map((item) => {
                        const isLow = item.quantity <= item.min_quantity;
                        const isOut = item.quantity === 0;
                        return (
                          <tr key={item.id} className="hover:bg-stone-50/50 transition-colors group">
                            <td className="p-4 px-6">
                              <p className="font-bold text-stone-900">{item.name}</p>
                              <p className="text-[10px] font-mono text-stone-400 mt-0.5 uppercase tracking-tighter">{item.sku}</p>
                            </td>
                            <td className="p-4">
                              <IOSBadge variant="light" className="text-stone-500 capitalize">{item.category}</IOSBadge>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex flex-col items-center">
                                <p className={`text-lg font-black ${isOut ? 'text-red-600' : isLow ? 'text-amber-500' : 'text-stone-900'}`}>
                                  {item.quantity}
                                </p>
                                <p className="text-[10px] font-medium text-stone-400">{item.unit}</p>
                              </div>
                            </td>
                            <td className="p-4 px-6 text-right">
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <IOSButton size="sm" variant="secondary" onClick={() => handleAdjustStock(item)} leftIcon={<Settings2 className="h-3 w-3" />}>
                                  Adjust
                                </IOSButton>
                                {(isLow || isOut) && (
                                  <IOSButton size="sm" onClick={() => handleRequestStock(item)} leftIcon={<Plus className="h-3 w-3" />}>
                                    Request
                                  </IOSButton>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50/50 border-b border-stone-100 text-left">
                    <tr>
                      <th className="p-4 font-bold text-stone-400 uppercase text-[10px] tracking-widest px-6">Stock Take List</th>
                      <th className="p-4 font-bold text-stone-400 uppercase text-[10px] tracking-widest">Category</th>
                      <th className="p-4 font-bold text-stone-400 uppercase text-[10px] tracking-widest">Status</th>
                      <th className="p-4 font-bold text-stone-400 uppercase text-[10px] tracking-widest text-right px-6">Operation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {catalog.length === 0 ? (
                      <tr><td colSpan={4} className="p-20 text-center text-stone-400">No catalog items found. Try a different search.</td></tr>
                    ) : (
                      catalog.map((cItem) => {
                        const inBranch = items.find(i => i.sku === cItem.sku);
                        return (
                          <tr key={cItem.sku} className="hover:bg-stone-50/50 transition-colors group">
                            <td className="p-4 px-6">
                              <p className="font-bold text-stone-900">{cItem.item_name}</p>
                              <p className="text-[10px] font-mono text-stone-400 mt-0.5 uppercase tracking-tighter">{cItem.sku}</p>
                            </td>
                            <td className="p-4">
                              <span className="text-[12px] bg-stone-100 px-2 py-0.5 rounded text-stone-600 capitalize font-medium">{cItem.category}</span>
                            </td>
                            <td className="p-4">
                              {inBranch ? (
                                inBranch.source === 'dispatch' ? (
                                  <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold">
                                    <LayoutGrid className="h-3 w-3" />
                                    <span>In Current Stock ({inBranch.quantity} {inBranch.unit})</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-blue-600 text-xs font-semibold">
                                    <Package className="h-3 w-3" />
                                    <span>Registered ({inBranch.quantity} {inBranch.unit})</span>
                                  </div>
                                )
                              ) : (
                                <IOSBadge variant="light" color="secondary">Not Registered</IOSBadge>
                              )}
                            </td>
                            <td className="p-4 px-6 text-right">
                              {inBranch ? (
                                <IOSButton size="sm" variant="secondary" onClick={() => handleAdjustStock(inBranch)} leftIcon={<Settings2 className="h-3 w-3" />}>
                                  Manage
                                </IOSButton>
                              ) : (
                                <IOSButton size="sm" onClick={() => handleAddToBranch(cItem)} leftIcon={<Plus className="h-3 w-3" />}>
                                  Register for Stock Take
                                </IOSButton>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Integration Modals */}
        <StockAdjustmentModal
          isOpen={isAdjustmentModalOpen}
          onClose={() => setIsAdjustmentModalOpen(false)}
          item={selectedStockItem ? {
            sku: selectedStockItem.sku,
            name: selectedStockItem.name,
            quantity: selectedStockItem.quantity,
            unit: selectedStockItem.unit,
            reorder_level: selectedStockItem.reorder_level
          } : null}
          initialType={initialAdjustmentType}
          onSuccess={() => {
            fetchStock();
            if (activeTab === 'catalog') fetchCatalog();
          }}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
