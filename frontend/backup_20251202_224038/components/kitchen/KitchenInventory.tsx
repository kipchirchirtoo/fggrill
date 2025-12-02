'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Search, Plus, Minus, AlertTriangle, Clock, CheckCircle,
  Loader2, Filter, RefreshCw, TrendingDown, TrendingUp, Calendar,
  Trash2, Edit, Eye, ShoppingCart, FileText, BarChart3, X, Check,
  ChefHat, Thermometer, Scale, Timer, AlertCircle, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { restaurantAPI, storeAPI } from '@/lib/api';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/lib/date-utils';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  min_level: number;
  max_level: number;
  cost_per_unit: number;
  expiry_date?: string;
  batch_number?: string;
  location?: string;
  supplier?: string;
  last_restocked?: string;
  status: 'sufficient' | 'low' | 'critical' | 'expired';
}

interface ConsumptionRecord {
  id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  reason: string;
  recorded_by: string;
  recorded_at: string;
}

interface WastageRecord {
  id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  reason: string;
  cost: number;
  recorded_at: string;
}

interface KitchenInventoryProps {
  branchId?: number;
  compact?: boolean;
}

const CATEGORIES = [
  'Proteins', 'Vegetables', 'Fruits', 'Dairy', 'Grains', 
  'Spices', 'Oils', 'Beverages', 'Frozen', 'Dry Goods', 'Other'
];

const WASTAGE_REASONS = [
  'Expired', 'Spoiled', 'Damaged', 'Overproduction', 'Quality Issue', 'Other'
];

export function KitchenInventory({ branchId, compact = false }: KitchenInventoryProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'expiry' | 'status'>('status');
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isConsumeModalOpen, setIsConsumeModalOpen] = useState(false);
  const [isWastageModalOpen, setIsWastageModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  
  // Form states
  const [consumeQuantity, setConsumeQuantity] = useState(1);
  const [consumeReason, setConsumeReason] = useState('');
  const [wastageQuantity, setWastageQuantity] = useState(1);
  const [wastageReason, setWastageReason] = useState('');
  
  // Request cart
  const [requestItems, setRequestItems] = useState<{ item: InventoryItem; quantity: number }[]>([]);
  
  // Stats
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStock: 0,
    critical: 0,
    expiringSoon: 0,
    totalValue: 0
  });

  useEffect(() => {
    fetchInventory();
  }, [branchId]);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      // Try restaurant inventory first, fallback to store API
      let inventoryData: any[] = [];
      
      try {
        const response = await restaurantAPI.getMenuItems();
        const menuItems = response.data || response || [];
        // Get inventory items linked to menu
        inventoryData = menuItems.filter((item: any) => item.track_inventory);
      } catch {
        // Fallback to branch stock
        const response = await storeAPI.getBranchStock(branchId);
        inventoryData = response.data || response || [];
      }

      const processedItems: InventoryItem[] = inventoryData.map((item: any) => {
        const quantity = item.quantity || item.stock_quantity || 0;
        const minLevel = item.min_level || item.reorder_level || 10;
        const expiryDate = item.expiry_date;
        const isExpired = expiryDate && new Date(expiryDate) < new Date();
        const isExpiringSoon = expiryDate && !isExpired && 
          new Date(expiryDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        let status: InventoryItem['status'] = 'sufficient';
        if (isExpired) status = 'expired';
        else if (quantity <= 0) status = 'critical';
        else if (quantity <= minLevel) status = 'low';

        return {
          id: item.id,
          sku: item.sku || item.item_sku || item.id,
          name: item.name || item.item_name,
          category: item.category || 'Other',
          quantity,
          unit: item.unit || item.unit_of_measure || 'pcs',
          min_level: minLevel,
          max_level: item.max_level || minLevel * 3,
          cost_per_unit: item.cost_price || item.cost_per_unit || 0,
          expiry_date: expiryDate,
          batch_number: item.batch_number,
          location: item.location || 'Kitchen',
          supplier: item.supplier,
          last_restocked: item.last_restocked || item.updated_at,
          status
        };
      });

      setItems(processedItems);

      // Calculate stats
      const lowStock = processedItems.filter(i => i.status === 'low').length;
      const critical = processedItems.filter(i => i.status === 'critical' || i.status === 'expired').length;
      const expiringSoon = processedItems.filter(i => {
        if (!i.expiry_date) return false;
        const expiry = new Date(i.expiry_date);
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return expiry > now && expiry <= weekFromNow;
      }).length;
      const totalValue = processedItems.reduce((sum, i) => sum + (i.quantity * i.cost_per_unit), 0);

      setStats({
        totalItems: processedItems.length,
        lowStock,
        critical,
        expiringSoon,
        totalValue
      });
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    let result = [...items];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(i => 
        i.name.toLowerCase().includes(term) ||
        i.sku.toLowerCase().includes(term)
      );
    }

    if (categoryFilter) {
      result = result.filter(i => i.category === categoryFilter);
    }

    if (statusFilter) {
      result = result.filter(i => i.status === statusFilter);
    }

    // Sort
    switch (sortBy) {
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'quantity':
        result.sort((a, b) => a.quantity - b.quantity);
        break;
      case 'expiry':
        result.sort((a, b) => {
          if (!a.expiry_date) return 1;
          if (!b.expiry_date) return -1;
          return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
        });
        break;
      case 'status':
        const statusOrder = { expired: 0, critical: 1, low: 2, sufficient: 3 };
        result.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
        break;
    }

    return result;
  }, [items, searchTerm, categoryFilter, statusFilter, sortBy]);

  const handleConsume = async () => {
    if (!selectedItem || consumeQuantity <= 0) return;

    try {
      // Record consumption
      await storeAPI.recordStockOut({
        item_sku: selectedItem.sku,
        quantity: consumeQuantity,
        reason: consumeReason || 'Kitchen usage',
        notes: `Consumed for kitchen operations`
      });

      toast.success(`Recorded ${consumeQuantity} ${selectedItem.unit} of ${selectedItem.name}`);
      setIsConsumeModalOpen(false);
      setConsumeQuantity(1);
      setConsumeReason('');
      fetchInventory();
    } catch (error) {
      toast.error('Failed to record consumption');
    }
  };

  const handleWastage = async () => {
    if (!selectedItem || wastageQuantity <= 0 || !wastageReason) return;

    try {
      await storeAPI.recordStockOut({
        item_sku: selectedItem.sku,
        quantity: wastageQuantity,
        reason: `Wastage: ${wastageReason}`,
        notes: `Wastage recorded - Cost: KES ${(wastageQuantity * selectedItem.cost_per_unit).toLocaleString()}`
      });

      toast.success('Wastage recorded');
      setIsWastageModalOpen(false);
      setWastageQuantity(1);
      setWastageReason('');
      fetchInventory();
    } catch (error) {
      toast.error('Failed to record wastage');
    }
  };

  const addToRequest = (item: InventoryItem) => {
    const existing = requestItems.find(r => r.item.id === item.id);
    if (existing) {
      setRequestItems(prev => prev.map(r =>
        r.item.id === item.id ? { ...r, quantity: r.quantity + 1 } : r
      ));
    } else {
      setRequestItems(prev => [...prev, { item, quantity: Math.max(1, item.min_level - item.quantity) }]);
    }
  };

  const submitRequest = async () => {
    if (requestItems.length === 0) return;

    try {
      await storeAPI.createStockRequest({
        items: requestItems.map(r => ({
          item_sku: r.item.sku,
          requested_quantity: r.quantity,
          current_branch_stock: r.item.quantity
        })),
        request_type: 'REPLENISHMENT',
        priority: 'HIGH',
        notes: 'Kitchen inventory replenishment request',
        reason: 'Low stock items'
      });

      toast.success('Stock request submitted');
      setRequestItems([]);
      setIsRequestModalOpen(false);
    } catch (error) {
      toast.error('Failed to submit request');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'expired': return 'bg-red-100 text-red-700 border-red-200';
      case 'critical': return 'bg-red-50 text-red-600 border-red-200';
      case 'low': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default: return 'bg-green-50 text-green-700 border-green-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'expired': return <IOSBadge className="bg-red-100 text-red-700">Expired</IOSBadge>;
      case 'critical': return <IOSBadge className="bg-red-100 text-red-700">Critical</IOSBadge>;
      case 'low': return <IOSBadge className="bg-yellow-100 text-yellow-700">Low Stock</IOSBadge>;
      default: return <IOSBadge className="bg-green-100 text-green-700">OK</IOSBadge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ChefHat className="h-6 w-6" />
            Kitchen Inventory
          </h2>
          <p className="text-sm text-gray-500">{stats.totalItems} items tracked</p>
        </div>
        <div className="flex items-center gap-3">
          <IOSButton variant="outline" onClick={fetchInventory}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </IOSButton>
          <IOSButton 
            variant="outline"
            onClick={() => setIsRequestModalOpen(true)}
            className="relative"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Request Stock
            {requestItems.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                {requestItems.length}
              </span>
            )}
          </IOSButton>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <IOSCard className="p-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-[#3C3C43]" />
            <div>
              <p className="text-2xl font-bold">{stats.totalItems}</p>
              <p className="text-xs text-gray-500">Total Items</p>
            </div>
          </div>
        </IOSCard>
        <IOSCard className="p-3 bg-yellow-50">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-700">{stats.lowStock}</p>
              <p className="text-xs text-yellow-600">Low Stock</p>
            </div>
          </div>
        </IOSCard>
        <IOSCard className="p-3 bg-red-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-700">{stats.critical}</p>
              <p className="text-xs text-red-600">Critical</p>
            </div>
          </div>
        </IOSCard>
        <IOSCard className="p-3 bg-orange-50">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-600" />
            <div>
              <p className="text-2xl font-bold text-orange-700">{stats.expiringSoon}</p>
              <p className="text-xs text-orange-600">Expiring Soon</p>
            </div>
          </div>
        </IOSCard>
        <IOSCard className="p-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#3C3C43]" />
            <div>
              <p className="text-lg font-bold">KES {(stats.totalValue / 1000).toFixed(0)}K</p>
              <p className="text-xs text-gray-500">Total Value</p>
            </div>
          </div>
        </IOSCard>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Status</option>
          <option value="critical">Critical</option>
          <option value="low">Low Stock</option>
          <option value="sufficient">Sufficient</option>
          <option value="expired">Expired</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="status">Sort by Status</option>
          <option value="name">Sort by Name</option>
          <option value="quantity">Sort by Quantity</option>
          <option value="expiry">Sort by Expiry</option>
        </select>
      </div>

      {/* Inventory List */}
      <IOSCard className="divide-y max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No items found</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`p-4 hover:bg-gray-50 transition-colors ${
                item.status === 'expired' || item.status === 'critical' ? 'bg-red-50' :
                item.status === 'low' ? 'bg-yellow-50' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getStatusColor(item.status)}`}>
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{item.name}</h3>
                      {getStatusBadge(item.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      <span>{item.category}</span>
                      <span>•</span>
                      <span>{item.sku}</span>
                      {item.expiry_date && (
                        <>
                          <span>•</span>
                          <span className={new Date(item.expiry_date) < new Date() ? 'text-red-600' : ''}>
                            Exp: {formatDate(item.expiry_date)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-lg font-bold">{item.quantity} {item.unit}</p>
                    <p className="text-xs text-gray-500">Min: {item.min_level}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <IOSButton
                      size="sm"
                      variant="ghost"
                      onClick={() => { setSelectedItem(item); setIsConsumeModalOpen(true); }}
                      title="Record Usage"
                    >
                      <Minus className="h-4 w-4" />
                    </IOSButton>
                    <IOSButton
                      size="sm"
                      variant="ghost"
                      onClick={() => { setSelectedItem(item); setIsWastageModalOpen(true); }}
                      title="Record Wastage"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </IOSButton>
                    <IOSButton
                      size="sm"
                      variant="ghost"
                      onClick={() => addToRequest(item)}
                      title="Add to Request"
                    >
                      <Plus className="h-4 w-4 text-green-600" />
                    </IOSButton>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </IOSCard>

      {/* Consume Modal */}
      <Dialog open={isConsumeModalOpen} onOpenChange={setIsConsumeModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Usage</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-3 bg-[#F2F2F7] rounded-lg">
                <p className="font-medium">{selectedItem.name}</p>
                <p className="text-sm text-gray-500">Available: {selectedItem.quantity} {selectedItem.unit}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Quantity Used</label>
                <div className="flex items-center gap-3">
                  <IOSButton variant="outline" onClick={() => setConsumeQuantity(Math.max(1, consumeQuantity - 1))}>
                    <Minus className="h-4 w-4" />
                  </IOSButton>
                  <Input
                    type="number"
                    value={consumeQuantity}
                    onChange={(e) => setConsumeQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="text-center"
                  />
                  <IOSButton variant="outline" onClick={() => setConsumeQuantity(consumeQuantity + 1)}>
                    <Plus className="h-4 w-4" />
                  </IOSButton>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Reason (optional)</label>
                <Input
                  value={consumeReason}
                  onChange={(e) => setConsumeReason(e.target.value)}
                  placeholder="e.g., Lunch service"
                />
              </div>
              <div className="flex gap-3">
                <IOSButton variant="outline" className="flex-1" onClick={() => setIsConsumeModalOpen(false)}>
                  Cancel
                </IOSButton>
                <IOSButton className="flex-1 bg-[#3C3C43]" onClick={handleConsume}>
                  <Check className="h-4 w-4 mr-2" /> Record
                </IOSButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Wastage Modal */}
      <Dialog open={isWastageModalOpen} onOpenChange={setIsWastageModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Wastage</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="font-medium">{selectedItem.name}</p>
                <p className="text-sm text-gray-500">Available: {selectedItem.quantity} {selectedItem.unit}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Quantity Wasted</label>
                <Input
                  type="number"
                  value={wastageQuantity}
                  onChange={(e) => setWastageQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Reason *</label>
                <select
                  value={wastageReason}
                  onChange={(e) => setWastageReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select reason...</option>
                  {WASTAGE_REASONS.map(reason => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Estimated Loss</p>
                <p className="text-lg font-bold text-red-600">
                  KES {(wastageQuantity * selectedItem.cost_per_unit).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-3">
                <IOSButton variant="outline" className="flex-1" onClick={() => setIsWastageModalOpen(false)}>
                  Cancel
                </IOSButton>
                <IOSButton className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleWastage} disabled={!wastageReason}>
                  <Trash2 className="h-4 w-4 mr-2" /> Record Wastage
                </IOSButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Request Modal */}
      <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Stock Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {requestItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No items in request</p>
                <p className="text-sm">Click + on items to add them</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {requestItems.map(({ item, quantity }) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-gray-500">Current: {item.quantity} {item.unit}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <IOSButton
                        size="sm"
                        variant="outline"
                        onClick={() => setRequestItems(prev => prev.map(r =>
                          r.item.id === item.id ? { ...r, quantity: Math.max(1, r.quantity - 1) } : r
                        ))}
                      >
                        <Minus className="h-3 w-3" />
                      </IOSButton>
                      <span className="w-12 text-center font-medium">{quantity}</span>
                      <IOSButton
                        size="sm"
                        variant="outline"
                        onClick={() => setRequestItems(prev => prev.map(r =>
                          r.item.id === item.id ? { ...r, quantity: r.quantity + 1 } : r
                        ))}
                      >
                        <Plus className="h-3 w-3" />
                      </IOSButton>
                      <IOSButton
                        size="sm"
                        variant="ghost"
                        onClick={() => setRequestItems(prev => prev.filter(r => r.item.id !== item.id))}
                      >
                        <X className="h-3 w-3 text-red-500" />
                      </IOSButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-3 pt-4 border-t">
              <IOSButton variant="outline" className="flex-1" onClick={() => setIsRequestModalOpen(false)}>
                Cancel
              </IOSButton>
              <IOSButton 
                className="flex-1 bg-[#3C3C43]" 
                onClick={submitRequest}
                disabled={requestItems.length === 0}
              >
                <Send className="h-4 w-4 mr-2" /> Submit Request
              </IOSButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
