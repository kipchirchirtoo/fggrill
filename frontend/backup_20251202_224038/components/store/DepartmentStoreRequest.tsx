'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Search, Plus, Minus, X, Send, ShoppingCart,
  Clock, CheckCircle, AlertCircle, Loader2, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { storeAPI } from '@/lib/api';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface StoreItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  min_level: number;
  status: 'sufficient' | 'low' | 'critical';
}

interface RequestItem {
  item_sku: string;
  item_name: string;
  quantity: number;
  unit: string;
  current_stock?: number;
}

interface StoreRequest {
  id: string;
  request_number: string;
  status: string;
  priority: string;
  created_at: string;
  items_count: number;
  notes?: string;
}

interface DepartmentStoreRequestProps {
  department: 'receptionist' | 'housekeeping' | 'bar' | 'restaurant' | 'kitchen';
  branchId?: number;
  onRequestCreated?: () => void;
}

const DEPARTMENT_CATEGORIES: Record<string, string[]> = {
  receptionist: ['Amenities', 'Office', 'Stationery', 'Guest Supplies'],
  housekeeping: ['Cleaning', 'Linen', 'Toiletries', 'Amenities'],
  bar: ['Beverages', 'Bar Supplies', 'Glassware'],
  restaurant: ['Food', 'Kitchen', 'Tableware', 'Disposables'],
  kitchen: ['Food', 'Kitchen', 'Ingredients', 'Packaging']
};

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low', color: 'bg-gray-100 text-gray-700' },
  { value: 'NORMAL', label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'URGENT', label: 'Urgent', color: 'bg-red-100 text-red-700' }
];

export function DepartmentStoreRequest({ 
  department, 
  branchId,
  onRequestCreated 
}: DepartmentStoreRequestProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [items, setItems] = useState<StoreItem[]>([]);
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [priority, setPriority] = useState('NORMAL');
  const [notes, setNotes] = useState('');
  const [myRequests, setMyRequests] = useState<StoreRequest[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const departmentCategories = DEPARTMENT_CATEGORIES[department] || [];

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen, categoryFilter]);

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getBranchStock(branchId);
      const stockItems = response.data || response.items || response || [];
      
      // Filter by department categories
      const filteredItems = stockItems
        .filter((item: any) => {
          const matchesCategory = !categoryFilter || 
            item.category?.toLowerCase().includes(categoryFilter.toLowerCase());
          const matchesDepartment = departmentCategories.length === 0 ||
            departmentCategories.some(cat => 
              item.category?.toLowerCase().includes(cat.toLowerCase())
            );
          return matchesCategory && matchesDepartment;
        })
        .map((item: any) => ({
          id: item.id,
          sku: item.item_sku || item.sku,
          name: item.item_name || item.name,
          category: item.category || 'General',
          unit: item.unit_of_measure || item.unit || 'pcs',
          quantity: item.quantity || 0,
          min_level: item.reorder_level || item.min_level || 10,
          status: item.quantity <= 0 ? 'critical' : 
                  item.quantity <= (item.reorder_level || 10) ? 'low' : 'sufficient'
        }));

      setItems(filteredItems);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Failed to load inventory items');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyRequests = async () => {
    try {
      const response = await storeAPI.getStockRequests({ status: 'all' });
      const requests = response.data || response.requests || response || [];
      setMyRequests(Array.isArray(requests) ? requests.slice(0, 5) : []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const addToRequest = (item: StoreItem) => {
    const existing = requestItems.find(r => r.item_sku === item.sku);
    if (existing) {
      setRequestItems(prev => prev.map(r =>
        r.item_sku === item.sku ? { ...r, quantity: r.quantity + 1 } : r
      ));
    } else {
      setRequestItems(prev => [...prev, {
        item_sku: item.sku,
        item_name: item.name,
        quantity: 1,
        unit: item.unit,
        current_stock: item.quantity
      }]);
    }
    toast.success(`Added ${item.name} to request`);
  };

  const updateQuantity = (sku: string, delta: number) => {
    setRequestItems(prev => prev.map(item => {
      if (item.item_sku === sku) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromRequest = (sku: string) => {
    setRequestItems(prev => prev.filter(item => item.item_sku !== sku));
  };

  const submitRequest = async () => {
    if (requestItems.length === 0) {
      toast.error('Please add items to your request');
      return;
    }

    setIsSubmitting(true);
    try {
      await storeAPI.createStockRequest({
        items: requestItems.map(item => ({
          item_sku: item.item_sku,
          requested_quantity: item.quantity,
          current_branch_stock: item.current_stock || 0
        })),
        request_type: 'REPLENISHMENT',
        priority: priority,
        notes: notes || `${department.charAt(0).toUpperCase() + department.slice(1)} department request`,
        reason: `Department: ${department}`
      });

      toast.success('Stock request submitted successfully!');
      setRequestItems([]);
      setNotes('');
      setPriority('NORMAL');
      setIsOpen(false);
      fetchMyRequests();
      onRequestCreated?.();
    } catch (error: any) {
      console.error('Error submitting request:', error);
      toast.error(error.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'dispatched': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <>
      {/* Request Button */}
      <IOSButton 
        onClick={() => setIsOpen(true)}
        className="bg-[#3C3C43] hover:bg-[#000000] text-white"
      >
        <ShoppingCart className="h-4 w-4 mr-2" />
        Request Supplies
        {requestItems.length > 0 && (
          <span className="ml-2 bg-white text-[#3C3C43] rounded-full px-2 py-0.5 text-xs font-bold">
            {requestItems.length}
          </span>
        )}
      </IOSButton>

      {/* Recent Requests Summary */}
      {myRequests.length > 0 && (
        <IOSCard className="mt-4 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Recent Requests</h3>
            <IOSButton variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? 'Hide' : 'Show All'}
            </IOSButton>
          </div>
          <AnimatePresence>
            {(showHistory ? myRequests : myRequests.slice(0, 2)).map(request => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{request.request_number}</p>
                  <p className="text-xs text-gray-500">{request.items_count} items</p>
                </div>
                <IOSBadge className={getStatusColor(request.status)}>
                  {request.status}
                </IOSBadge>
              </motion.div>
            ))}
          </AnimatePresence>
        </IOSCard>
      )}

      {/* Request Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Request Supplies - {department.charAt(0).toUpperCase() + department.slice(1)}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Items List */}
            <div className="flex flex-col h-full">
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
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
                  {departmentCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
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
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                        item.status === 'critical' ? 'border-red-200 bg-red-50' :
                        item.status === 'low' ? 'border-yellow-200 bg-yellow-50' :
                        'border-gray-200 bg-white'
                      }`}
                      onClick={() => addToRequest(item)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.sku} • {item.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{item.quantity} {item.unit}</p>
                          {item.status !== 'sufficient' && (
                            <IOSBadge className={
                              item.status === 'critical' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                            }>
                              {item.status === 'critical' ? 'Critical' : 'Low Stock'}
                            </IOSBadge>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Request Cart */}
            <div className="flex flex-col h-full bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Your Request ({requestItems.length} items)
              </h3>

              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {requestItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Click items to add to request</p>
                  </div>
                ) : (
                  requestItems.map(item => (
                    <div key={item.item_sku} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.item_name}</p>
                        <p className="text-xs text-gray-500">{item.unit}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <IOSButton
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          onClick={() => updateQuantity(item.item_sku, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </IOSButton>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <IOSButton
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          onClick={() => updateQuantity(item.item_sku, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </IOSButton>
                        <IOSButton
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                          onClick={() => removeFromRequest(item.item_sku)}
                        >
                          <X className="h-3 w-3" />
                        </IOSButton>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Priority & Notes */}
              <div className="space-y-3 border-t pt-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Priority</label>
                  <div className="flex gap-2">
                    {PRIORITY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setPriority(opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          priority === opt.value ? opt.color + ' ring-2 ring-offset-1 ring-gray-400' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any special instructions..."
                    className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                    rows={2}
                  />
                </div>

                <div className="flex gap-3">
                  <IOSButton
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setRequestItems([]);
                      setIsOpen(false);
                    }}
                  >
                    Cancel
                  </IOSButton>
                  <IOSButton
                    className="flex-1 bg-[#3C3C43] hover:bg-[#000000]"
                    disabled={requestItems.length === 0 || isSubmitting}
                    onClick={submitRequest}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Submit Request
                  </IOSButton>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
