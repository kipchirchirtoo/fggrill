'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from "@/components/ui/minimal/button";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Package, Store, Truck, ClipboardList, AlertTriangle,
  Search, Plus, Check, X, Send, RefreshCw, Minus,
  ChevronRight, Clock, ArrowDownToLine, History, Box,
  ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown,
  ChevronDown, Filter, FileText, CheckCircle2,
  PackageSearch, BarChart3, User, Calendar, Utensils
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { storeAPI } from '@/lib/api';
import { format } from 'date-fns';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface BranchStock {
  id: string;
  item_sku: string;
  quantity: number;
  reorder_level: number;
  item?: {
    sku: string;
    item_name: string;
    description: string;
    category: string;
    unit_of_measure: string;
    retail_price: number;
  };
}

interface StockRequest {
  id: string;
  request_number: string;
  request_type: string;
  priority: string;
  status: string;
  created_at: string;
  items: any[];
}

interface IncomingDispatch {
  id: string;
  dispatch_number: string;
  status: string;
  dispatched_at: string;
  estimated_delivery: string;
  from_branch: {
    name: string;
  };
  items: any[];
}

export default function BranchStorekeeperPage() {
  const { user, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'overview' | 'stock' | 'requests' | 'receive' | 'usage' | 'history' | 'reports'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Tab handling from URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'stock', 'requests', 'receive', 'usage', 'history', 'reports'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as any);
    router.push(`/dashboard/storekeeping/branch?tab=${tab}`);
  };

  // Data
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStock: 0,
    pendingRequests: 0,
    incomingDispatches: 0
  });
  const [branchStock, setBranchStock] = useState<BranchStock[]>([]);
  const [myRequests, setMyRequests] = useState<StockRequest[]>([]);
  const [incomingDispatches, setIncomingDispatches] = useState<IncomingDispatch[]>([]);
  const [masterCatalog, setMasterCatalog] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);

  // Modal states
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isStockUpdateModalOpen, setIsStockUpdateModalOpen] = useState(false);
  const [isStockOutModalOpen, setIsStockOutModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState<IncomingDispatch | null>(null);

  // Form states
  const [requestItems, setRequestItems] = useState<{ item_sku: string; requested_quantity: number }[]>([]);
  const [requestReason, setRequestReason] = useState('');
  const [requestType, setRequestType] = useState('ROUTINE');
  const [requestPriority, setRequestPriority] = useState('NORMAL');

  const [stockOutSku, setStockOutSku] = useState('');
  const [stockOutQuantity, setStockOutQuantity] = useState(0);
  const [stockOutType, setStockOutType] = useState('USAGE');
  const [stockOutReason, setStockOutReason] = useState('');

  const [stockUpdates, setStockUpdates] = useState<Record<string, number>>({});
  const [updateNotes, setUpdateNotes] = useState('');

  const [receivedItems, setReceivedItems] = useState<Record<string, {
    quantity: number,
    damaged: number,
    missing: number,
    note: string
  }>>({});
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Kitchen Usage states
  const [usageRecords, setUsageRecords] = useState<any[]>([]);
  const [trackableItems, setTrackableItems] = useState<any[]>([]);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [usageDetails, setUsageDetails] = useState({
    item_sku: '',
    quantity: 0,
    staff_id: '',
    notes: ''
  });
  const [branchStaff, setBranchStaff] = useState<any[]>([]);


  useEffect(() => {
    if (!authLoading && user) {
      fetchDashboardData();
    }
  }, [authLoading, user]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Use storeAPI instead of raw fetch
      const [stockData, requestsData, incomingData, catalogData, movementsData] = await Promise.all([
        storeAPI.getBranchStock(),
        storeAPI.getBranchRequests(),
        storeAPI.getIncomingDispatches(),
        storeAPI.getMasterCatalog(),
        storeAPI.getStockMovements().catch(() => ({ data: [] }))
      ]);

      setBranchStock(stockData.data || []);
      setMyRequests(requestsData.data || []);
      setIncomingDispatches(incomingData.data || []);
      setMasterCatalog(catalogData.data || []);
      setStockMovements(movementsData.data || []);

      if (activeTab === 'usage') {
        const [usageData, trackableData, staffData] = await Promise.all([
          storeAPI.getKitchenUsageRecords(),
          storeAPI.getTrackableItems(),
          storeAPI.getKitchenUsageStaff()
        ]);
        setUsageRecords(usageData.data || []);
        setTrackableItems(trackableData.data || []);
        setBranchStaff(staffData.data || []);
      }

      // Calculate stats locally if dashboard endpoint isn't available or to ensure consistency
      const lowStock = (stockData.data || []).filter((s: BranchStock) => s.quantity <= (s.reorder_level || 10)).length;
      setStats({
        totalItems: stockData.data?.length || 0,
        lowStock,
        pendingRequests: (requestsData.data || []).filter((r: any) => r.status === 'PENDING').length,
        incomingDispatches: (incomingData.data || []).filter((d: any) => d.status === 'IN_TRANSIT').length
      });

    } catch (error) {
      console.error('Error fetching dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (requestItems.length === 0) {
      toast.error('Add at least one item to request');
      return;
    }

    try {
      const response = await storeAPI.createStockRequest({
        items: requestItems,
        request_type: requestType,
        priority: requestPriority,
        reason: requestReason
      });

      toast.success(`Request ${response.data.request_number} created`);
      setIsRequestModalOpen(false);
      setRequestItems([]);
      setRequestReason('');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to create stock request');
    }
  };

  const handleStockOut = async () => {
    if (!stockOutSku || stockOutQuantity <= 0) {
      toast.error('Select item and quantity');
      return;
    }

    try {
      setIsLoading(true);
      await storeAPI.recordStockOut({
        item_sku: stockOutSku,
        quantity: stockOutQuantity,
        reason: stockOutType,
        notes: stockOutReason
      });

      toast.success('Stock out recorded');
      setIsStockOutModalOpen(false);
      setStockOutSku('');
      setStockOutQuantity(0);
      setStockOutReason('');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to record stock out');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStockUpdate = async () => {
    const itemsToUpdate = Object.entries(stockUpdates).filter(([_, qty]) => qty !== undefined);

    if (itemsToUpdate.length === 0) {
      toast.error('No updates to save');
      return;
    }

    try {
      setIsLoading(true);
      for (const [sku, quantity] of itemsToUpdate) {
        const item = branchStock.find(s => s.item_sku === sku);
        if (item) {
          const theoreticalStock = item.quantity || 0;
          const adjustment = Number(quantity) - theoreticalStock;

          if (adjustment !== 0) {
            await storeAPI.updateBranchStock({
              item_sku: sku,
              quantity: adjustment,
              movement_type: 'MORNING_COUNT',
              notes: updateNotes || 'Morning stock count'
            });
          }
        }
      }

      toast.success('Stock levels updated');
      setIsStockUpdateModalOpen(false);
      setStockUpdates({});
      setUpdateNotes('');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to update stock levels');
    } finally {
      setIsLoading(false);
    }
  };

  const handleIssueToKitchen = async () => {
    if (!usageDetails.item_sku || usageDetails.quantity <= 0) {
      toast.error('Select item and quantity');
      return;
    }

    try {
      setIsLoading(true);
      await storeAPI.createKitchenUsageRecord({
        item_sku: usageDetails.item_sku,
        received_quantity: usageDetails.quantity,
        accountability_id: usageDetails.staff_id,
        notes: usageDetails.notes
      } as any);

      toast.success('Items issued to kitchen');
      setIsUsageModalOpen(false);
      setUsageDetails({ item_sku: '', quantity: 0, staff_id: '', notes: '' });
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to issue items');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!selectedDispatch) return;

    try {
      const payload = {
        received_items: selectedDispatch.items.map(item => {
          const verification = receivedItems[item.id] || { quantity: item.dispatched_quantity, damaged: 0, missing: 0, note: '' };
          return {
            id: item.id,
            received_quantity: verification.quantity,
            damaged_quantity: verification.damaged,
            missing_quantity: verification.missing,
            discrepancy_reason: verification.note
          };
        }),
        delivery_notes: deliveryNotes
      };

      await storeAPI.confirmDelivery(selectedDispatch.id, payload);

      toast.success('Delivery confirmed and stock updated');
      setIsReceiveModalOpen(false);
      setSelectedDispatch(null);
      setReceivedItems({});
      setDeliveryNotes('');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to confirm delivery');
    }
  };

  const addItemToRequest = (item: any) => {
    const existing = requestItems.find((i: any) => i.item_sku === item.sku);
    if (existing) {
      setRequestItems(requestItems.map((i: any) =>
        i.item_sku === item.sku
          ? { ...i, requested_quantity: i.requested_quantity + 1 }
          : i
      ));
    } else {
      setRequestItems([...requestItems, { item_sku: item.sku, requested_quantity: 1 }]);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-[#F2F2F7]';
      case 'APPROVED': return 'bg-emerald-50';
      case 'REJECTED': return 'bg-red-50';
      case 'DISPATCHED': return 'bg-blue-50';
      case 'IN_TRANSIT': return 'bg-[#F2F2F7]';
      case 'DELIVERED': return 'bg-[#3C3C43]';
      default: return 'bg-[#8E8E93]';
    }
  };

  const filteredStock = branchStock.filter((stock: BranchStock) =>
    searchTerm === '' ||
    stock.item_sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stock.item?.item_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER, UserRole.RESTAURANT, UserRole.HOUSEKEEPING]}>
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgba(60,60,67,0.12)] mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading branch inventory...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute
      allowedRoles={[
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER,
        UserRole.CENTRAL_STOREKEEPER,
        UserRole.BRANCH_STOREKEEPER,
        UserRole.RESTAURANT,
        UserRole.HOUSEKEEPING
      ]}
    >
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-stone-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Store className="h-6 w-6 text-stone-900" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-stone-900 leading-tight">Branch Inventory</h1>
                <p className="text-stone-500 text-xs sm:text-sm">Manage stock and requested items</p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setIsStockOutModalOpen(true)}
                className="flex-1 sm:flex-none h-11 px-4 bg-stone-100 text-stone-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Minus className="h-4 w-4" />
                <span>Stock Out</span>
              </button>
              <button
                onClick={() => setIsRequestModalOpen(true)}
                className="flex-[1.5] sm:flex-none h-11 px-6 bg-stone-900 text-white rounded-xl text-sm font-bold shadow-stone-200 shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Send className="h-4 w-4" />
                <span>Request Stock</span>
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <div className="p-4 sm:p-6 bg-white rounded-2xl border border-stone-100 shadow-sm">
              <div className="flex flex-col gap-3">
                <div className="h-10 w-10 bg-stone-50 rounded-xl flex items-center justify-center">
                  <Package className="h-5 w-5 text-stone-600" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-stone-400 uppercase tracking-wider">Total Items</p>
                  <p className="text-xl sm:text-2xl font-black text-stone-900 leading-none mt-1">{stats.totalItems}</p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 bg-white rounded-2xl border border-stone-100 shadow-sm">
              <div className="flex flex-col gap-3">
                <div className="h-10 w-10 bg-red-50 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-stone-400 uppercase tracking-wider">Low Stock</p>
                  <p className="text-xl sm:text-2xl font-black text-stone-900 leading-none mt-1">{stats.lowStock}</p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 bg-white rounded-2xl border border-stone-100 shadow-sm">
              <div className="flex flex-col gap-3">
                <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-stone-400 uppercase tracking-wider">Pending</p>
                  <p className="text-xl sm:text-2xl font-black text-stone-900 leading-none mt-1">{stats.pendingRequests}</p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 bg-white rounded-2xl border border-stone-100 shadow-sm">
              <div className="flex flex-col gap-3">
                <div className="h-10 w-10 bg-orange-50 rounded-xl flex items-center justify-center">
                  <Truck className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-stone-400 uppercase tracking-wider">Incoming</p>
                  <p className="text-xl sm:text-2xl font-black text-stone-900 leading-none mt-1">{stats.incomingDispatches}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="relative -mx-4">
            <div className="flex overflow-x-auto no-scrollbar border-b border-stone-100 bg-white sticky top-0 z-10 px-4 pt-2">
              {[
                { id: 'stock', label: 'Stock', icon: Package },
                { id: 'requests', label: 'Requests', icon: Send, count: stats.pendingRequests },
                { id: 'receive', label: 'Inbound', icon: Truck, count: stats.incomingDispatches },
                { id: 'usage', label: 'Kitchen', icon: Utensils },
                { id: 'history', label: 'History', icon: History },
                { id: 'reports', label: 'Reports', icon: BarChart3 }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-400 hover:text-stone-600'
                    }`}
                >
                  <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'text-stone-900' : 'text-stone-400'}`} />
                  <span className="text-xs font-black uppercase tracking-widest">{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <IOSBadge size="xs" className={`${activeTab === tab.id ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'
                      }`}>
                      {tab.count}
                    </IOSBadge>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-[#FFFFFF] rounded-xl shadow-none border">

            {/* Current Stock Tab */}
            {activeTab === 'stock' && (
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <input
                      placeholder="Search items..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const initialUpdates: Record<string, number> = {};
                      branchStock.forEach(item => {
                        initialUpdates[item.item_sku] = item.quantity;
                      });
                      setStockUpdates(initialUpdates);
                      setIsStockUpdateModalOpen(true);
                    }}
                    className="h-11 px-4 bg-white border border-stone-200 text-stone-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-stone-50 active:scale-95 transition-all shadow-sm"
                  >
                    <PackageSearch className="h-4 w-4" />
                    <span>Morning Count</span>
                  </button>
                </div>

                <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-stone-100 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Item Details</th>
                        <th className="px-4 py-3 text-left">Category</th>
                        <th className="px-4 py-3 text-center">In Stock</th>
                        <th className="px-4 py-3 text-center">Min Level</th>
                        <th className="px-4 py-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {filteredStock.map((stock) => {
                        const isLow = stock.quantity <= stock.reorder_level;
                        return (
                          <tr key={stock.id} className="group hover:bg-stone-50/50 transition-colors">
                            <td className="px-4 py-4">
                              <p className="text-[13px] font-bold text-stone-900 leading-tight">{stock.item?.item_name || 'Unnamed Item'}</p>
                              <code className="text-[10px] font-bold text-stone-400 mt-1 block uppercase tracking-tight">{stock.item_sku}</code>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-[11px] font-bold text-stone-500 bg-stone-100 px-2 py-1 rounded-md uppercase tracking-wider">
                                {stock.item?.category || 'General'}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`text-base font-black ${isLow ? 'text-red-600' : 'text-stone-900'}`}>
                                {stock.quantity}
                              </span>
                              <span className="text-[10px] font-bold text-stone-400 ml-1 uppercase">{stock.item?.unit_of_measure}</span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-sm font-bold text-stone-400">{stock.reorder_level}</span>
                            </td>
                            <td className="px-4 py-4">
                              <IOSBadge size="sm" className={`text-[10px] font-black ${isLow ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'
                                }`}>
                                {isLow ? 'REORDER' : 'HEALTHY'}
                              </IOSBadge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredStock.length === 0 && (
                    <div className="text-center py-20 bg-stone-50/50 rounded-2xl border border-dashed border-stone-200 m-4">
                      <Package className="h-12 w-12 mx-auto mb-3 text-stone-200" />
                      <p className="text-stone-400 font-bold text-sm">No items found matching search</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* My Requests Tab */}
            {activeTab === 'requests' && (
              <div className="p-4 sm:p-6">
                <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b border-stone-100 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Ticket</th>
                        <th className="px-4 py-3 text-left">Type / Priority</th>
                        <th className="px-4 py-3 text-center">Items</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Requested On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {myRequests.map((request: any) => (
                        <tr key={request.id} className="group hover:bg-stone-50/50 transition-colors">
                          <td className="px-4 py-4">
                            <span className="text-[13px] font-black text-stone-900 font-mono tracking-wider">{request.request_number}</span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col">
                              <span className="text-[12px] font-bold text-stone-900 uppercase tracking-tight">{request.request_type}</span>
                              <IOSBadge size="xs" className={`text-[9px] font-black mt-1 ${request.priority === 'URGENT' ? 'bg-red-50 text-red-600 border-red-100' :
                                request.priority === 'HIGH' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                  'bg-blue-50 text-blue-600 border-blue-100'
                                }`}>{request.priority}</IOSBadge>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="text-sm font-bold text-stone-900">{request.items?.length || 0}</span>
                            <span className="text-[10px] font-bold text-stone-400 ml-1 uppercase">Products</span>
                          </td>
                          <td className="px-4 py-4">
                            <IOSBadge size="sm" className={`text-[10px] font-black ${request.status === 'PENDING' ? 'bg-stone-100 text-stone-600' :
                              request.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                                request.status === 'DISPATCHED' ? 'bg-blue-50 text-blue-600' :
                                  request.status === 'REJECTED' ? 'bg-red-50 text-red-600' :
                                    'bg-stone-900 text-white'
                              }`}>{request.status}</IOSBadge>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-[11px] font-bold text-stone-400">{format(new Date(request.created_at), 'MMM d, yyyy')}</p>
                            <p className="text-[10px] text-stone-300 font-medium">{format(new Date(request.created_at), 'hh:mm a')}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {myRequests.length === 0 && (
                    <div className="text-center py-20 bg-stone-50/50 rounded-2xl border border-dashed border-stone-200 m-4">
                      <ClipboardList className="h-12 w-12 mx-auto mb-3 text-stone-200" />
                      <p className="text-stone-400 font-bold text-sm">You haven't made any requests yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Incoming Dispatches Tab */}
            {activeTab === 'receive' && (
              <div className="p-4 sm:p-6 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-stone-900">Inbound Shipments</h3>
                  <div className="flex items-center gap-2">
                    <IOSBadge size="sm" className="bg-amber-50 text-amber-600 border-amber-100">
                      {incomingDispatches.length} EN ROUTE
                    </IOSBadge>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {incomingDispatches.length > 0 ? (
                    incomingDispatches.map((dispatch: any) => (
                      <div key={dispatch.id} className="p-4 bg-white rounded-2xl border border-stone-100 shadow-sm flex flex-col gap-4">
                        <div className="flex items-start justify-between">
                          <div className="h-12 w-12 bg-stone-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <Truck className="h-6 w-6 text-stone-900" />
                          </div>
                          <IOSBadge size="xs" className="bg-stone-900 text-white border-stone-900 font-black">
                            {dispatch.status}
                          </IOSBadge>
                        </div>

                        <div>
                          <p className="text-[12px] font-black text-stone-400 uppercase tracking-tighter mb-1 font-mono">{dispatch.dispatch_number}</p>
                          <p className="text-[15px] font-black text-stone-900 leading-tight">From: {dispatch.from_branch?.name || 'Central Warehouse'}</p>
                          <p className="text-xs font-bold text-stone-500 mt-2">{dispatch.items?.length || 0} items in shipment</p>
                        </div>

                        <button
                          onClick={() => { setSelectedDispatch(dispatch); setIsReceiveModalOpen(true); }}
                          className="w-full h-11 bg-stone-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-stone-200 transition-all"
                        >
                          <ArrowDownToLine className="h-4 w-4" />
                          <span>Receive & Verify Delivery</span>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-20 bg-stone-50/50 rounded-2xl border border-dashed border-stone-200 m-4">
                      <Truck className="h-12 w-12 mx-auto mb-3 text-stone-200" />
                      <p className="text-stone-400 font-bold text-sm">No incoming dispatches found</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Kitchen Usage Tab */}
            {activeTab === 'usage' && (
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-stone-900 leading-tight">Kitchen Usage Tracking</h3>
                    <p className="text-xs sm:text-sm text-stone-500">Track items issued and consumed in the kitchen</p>
                  </div>
                  <button
                    onClick={() => setIsUsageModalOpen(true)}
                    className="h-11 px-4 sm:px-6 bg-stone-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-stone-200 flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Issue to Kitchen</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {usageRecords.length > 0 ? (
                    usageRecords.map((record: any) => (
                      <div key={record.id} className="p-4 bg-white rounded-2xl border border-stone-100 shadow-sm flex flex-col gap-4">
                        <div className="flex items-start justify-between">
                          <div className="h-12 w-12 bg-stone-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <Utensils className="h-6 w-6 text-stone-900" />
                          </div>
                          <IOSBadge size="xs" className={`text-[10px] font-black ${record.status === 'OPEN' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-stone-50 text-stone-400 border-stone-100'
                            }`}>
                            {record.status}
                          </IOSBadge>
                        </div>

                        <div>
                          <p className="text-[14px] font-black text-stone-900 leading-tight">{record.item?.item_name || record.item_sku}</p>
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Issued Qty</p>
                              <p className="text-[13px] font-black text-stone-900">{record.received_quantity} <span className="text-[10px] font-bold text-stone-400">{record.item?.unit_of_measure}</span></p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Responsible</p>
                              <p className="text-[13px] font-bold text-stone-900 truncate">{record.responsible_staff_name || 'Kitchen Staff'}</p>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => router.push(`/dashboard/storekeeping/branch/usage/${record.id}`)}
                          className="w-full h-10 bg-stone-50 text-stone-600 hover:bg-stone-100 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 transition-all"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>Track Consumption</span>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-20 bg-stone-50/50 rounded-2xl border border-dashed border-stone-200 m-4">
                      <Utensils className="h-12 w-12 mx-auto mb-3 text-stone-200" />
                      <p className="text-stone-400 font-bold text-sm">No active kitchen tracking records</p>
                      <button
                        onClick={() => setIsUsageModalOpen(true)}
                        className="mt-4 text-stone-900 font-black text-xs uppercase tracking-widest underline decoration-stone-200 decoration-2 underline-offset-4"
                      >
                        Issue items now
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stock Movement History Tab */}
            {activeTab === 'history' && (
              <div className="p-0 flex flex-col">
                <div className="p-4 sm:p-6 border-b border-stone-100 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-stone-900">Movement History</h3>
                  <button className="flex items-center gap-2 text-[10px] font-black text-stone-400 uppercase tracking-widest hover:text-stone-900 transition-colors">
                    <Filter className="h-3 w-3" /> Filter Log
                  </button>
                </div>
                
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-stone-100 bg-stone-50/50">
                        <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Timestamp</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Product</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Event</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest text-center">Qty</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Ref</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {stockMovements.map((movement: any) => (
                        <tr key={movement.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-[12px] font-black text-stone-900 tracking-tighter">
                              {format(new Date(movement.created_at), 'MMM d, HH:mm')}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-[13px] font-black text-stone-900 leading-tight">
                              {movement.item?.item_name || movement.item_sku}
                            </p>
                            <code className="text-[9px] font-bold text-stone-400 uppercase">{movement.item_sku}</code>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                                movement.quantity > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                              }`}>
                                {movement.quantity > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                              </div>
                              <span className="text-[11px] font-black text-stone-900 uppercase tracking-tighter">
                                {movement.movement_type}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`text-base font-black ${
                              movement.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wide truncate max-w-[150px]">
                              {movement.reference || movement.reason || 'S-Internal'}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {stockMovements.length === 0 && (
                    <div className="text-center py-20 bg-stone-50/50 rounded-2xl border border-dashed border-stone-200 m-4">
                      <History className="h-12 w-12 mx-auto mb-3 text-stone-200" />
                      <p className="text-stone-400 font-bold text-sm">No movement records found</p>
                    </div>
                  )}
                            Stock Value Distribution
                          </h3>
                          <div className="h-56 flex flex-col items-center justify-center bg-stone-50/50 rounded-2xl border border-dashed border-stone-200">
                            <TrendingUp className="h-8 w-8 text-stone-200 mb-2" />
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Analytics Generating...</p>
                          </div>
                        </div>

                        <div className="p-6 bg-white rounded-2xl border border-stone-100 shadow-sm">
                          <h3 className="text-sm font-black text-stone-900 uppercase tracking-wider flex items-center gap-2 mb-6">
                            <TrendingUp className="h-4 w-4 text-stone-400" />
                            Usage & Consumption Trends
                          </h3>
                          <div className="h-56 flex flex-col items-center justify-center bg-stone-50/50 rounded-2xl border border-dashed border-stone-200">
                            <Box className="h-8 w-8 text-stone-200 mb-2" />
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Mapping Trends...</p>
                          </div>
                        </div>
                      </div>

          <div className="p-6 bg-white rounded-2xl border border-stone-100 shadow-sm">
            <h3 className="text-sm font-black text-stone-900 uppercase tracking-wider mb-6">Monthly Activity Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Stock Inflow</p>
                <p className="text-2xl font-black text-stone-900 leading-none">0 <span className="text-[10px] font-bold text-stone-400">Total</span></p>
              </div>
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Stock Outflow</p>
                <p className="text-2xl font-black text-stone-900 leading-none">0 <span className="text-[10px] font-bold text-stone-400">Total</span></p>
              </div>
              <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100">
                <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1">Damages/Loss</p>
                <p className="text-2xl font-black text-stone-900 leading-none">0 <span className="text-[10px] font-bold text-stone-400">Total</span></p>
              </div>
            </div>
          </div>
        </div>
                  )}
      </div>
    </div>

        {/* Kitchen Issue Modal */ }
  <Dialog open={isUsageModalOpen} onOpenChange={setIsUsageModalOpen}>
    <DialogContent className="max-w-lg p-0 overflow-hidden border-none rounded-3xl shadow-2xl bg-white">
      <div className="bg-stone-900 px-6 py-8 text-white relative">
        <button
          onClick={() => setIsUsageModalOpen(false)}
          className="absolute right-6 top-8 text-stone-400 hover:text-white transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
        <h2 className="text-2xl font-black tracking-tight">Issue to Kitchen</h2>
        <p className="text-stone-400 text-sm mt-1 font-medium">Transfer products for production tracking</p>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Select Product</p>
            <select
              value={usageDetails.item_sku}
              onChange={(e) => setUsageDetails({ ...usageDetails, item_sku: e.target.value })}
              className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-stone-900/5 outline-none appearance-none cursor-pointer"
            >
              <option value="">Choose item...</option>
              {branchStock.map((item) => (
                <option key={item.item_sku} value={item.item_sku}>
                  {item.item?.item_name || item.item_sku} ({item.quantity} In Store)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Issue Quantity</p>
            <div className="relative">
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={usageDetails.quantity || ''}
                onChange={(e) => setUsageDetails({ ...usageDetails, quantity: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-sm font-black focus:ring-2 focus:ring-stone-900/5 outline-none"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-400 uppercase">
                Units
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Accountable Staff</p>
          <select
            value={usageDetails.staff_id}
            onChange={(e) => setUsageDetails({ ...usageDetails, staff_id: e.target.value })}
            className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-stone-900/5 outline-none appearance-none cursor-pointer"
          >
            <option value="">Select recipient...</option>
            {branchStaff.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.first_name} {staff.last_name} ({staff.role})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Usage Notes</p>
          <textarea
            value={usageDetails.notes}
            onChange={(e) => setUsageDetails({ ...usageDetails, notes: e.target.value })}
            placeholder="Special instructions..."
            rows={2}
            className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-stone-900/5 outline-none resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setIsUsageModalOpen(false)}
            className="flex-1 h-12 bg-stone-100 text-stone-600 rounded-xl text-sm font-bold active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleIssueToKitchen}
            disabled={!usageDetails.item_sku || usageDetails.quantity <= 0 || isLoading}
            className="flex-[2] h-12 bg-stone-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-stone-200 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            <span>Confirm Issue</span>
          </button>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  {/* Create Request Modal */ }
  <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
    <DialogContent className="max-w-2xl p-0 overflow-hidden border-none rounded-3xl shadow-2xl bg-white flex flex-col max-h-[90vh]">
      <div className="bg-stone-900 px-6 py-8 text-white relative">
        <button
          onClick={() => setIsRequestModalOpen(false)}
          className="absolute right-6 top-8 text-stone-400 hover:text-white transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
        <h2 className="text-2xl font-black tracking-tight">Request Stock</h2>
        <p className="text-stone-400 text-sm mt-1 font-medium">Create a new restock ticket for Central</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Restock Type</p>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-stone-900/5 outline-none"
            >
              <option value="ROUTINE">Routine Restock</option>
              <option value="EMERGENCY">Emergency</option>
              <option value="EVENT">Event/Special</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Urgency</p>
            <select
              value={requestPriority}
              onChange={(e) => setRequestPriority(e.target.value)}
              className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-stone-900/5 outline-none"
            >
              <option value="LOW">Low Priority</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Request Reason</p>
          <input
            value={requestReason}
            onChange={(e) => setRequestReason(e.target.value)}
            placeholder="Why is this stock needed?"
            className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-stone-900/5 outline-none"
          />
        </div>

        <div>
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1 mb-2">Service Catalog</p>
          <div className="border border-stone-100 rounded-2xl overflow-hidden divide-y divide-stone-50 max-h-48 overflow-y-auto no-scrollbar">
            {masterCatalog.slice(0, 30).map((item) => (
              <button
                key={item.sku}
                onClick={() => addItemToRequest(item)}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-stone-50 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-bold text-stone-900 leading-tight">{item.item_name || item.description}</p>
                  <code className="text-[10px] font-bold text-stone-300 uppercase mt-0.5 block">{item.sku}</code>
                </div>
                <div className="h-8 w-8 bg-stone-50 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-900 transition-colors">
                  <Plus className="h-4 w-4" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {requestItems.length > 0 && (
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Selected Draft ({requestItems.length})</p>
            <div className="space-y-2">
              {requestItems.map((item, idx) => {
                const catalogItem = masterCatalog.find(c => c.sku === item.item_sku);
                return (
                  <div key={idx} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-200/50 hover:border-stone-200 transition-all">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black text-stone-900 truncate pr-4">{catalogItem?.item_name || item.item_sku}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          value={item.requested_quantity}
                          onChange={(e) => {
                            const newItems = [...requestItems];
                            newItems[idx].requested_quantity = parseInt(e.target.value) || 1;
                            setRequestItems(newItems);
                          }}
                          className="w-20 h-9 bg-white border border-stone-200 rounded-lg text-center text-sm font-black focus:ring-2 focus:ring-stone-900/5 outline-none"
                        />
                      </div>
                      <button
                        onClick={() => setRequestItems(requestItems.filter((_, i) => i !== idx))}
                        className="h-9 w-9 bg-red-50 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-100 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="p-6 bg-white border-t border-stone-100 flex gap-3">
        <button
          onClick={() => setIsRequestModalOpen(false)}
          className="flex-1 h-12 bg-stone-100 text-stone-600 rounded-xl text-sm font-bold active:scale-95 transition-all"
        >
          Discard
        </button>
        <button
          onClick={handleCreateRequest}
          disabled={requestItems.length === 0 || isLoading}
          className="flex-[2] h-12 bg-stone-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-stone-200 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
        >
          {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span>Transmit Request</span>
        </button>
      </div>
    </DialogContent>
  </Dialog>

  {/* Stock Out Modal */ }
  <Dialog open={isStockOutModalOpen} onOpenChange={setIsStockOutModalOpen}>
    <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-3xl shadow-2xl bg-white">
      <div className="bg-stone-900 px-6 py-8 text-white relative">
        <button
          onClick={() => setIsStockOutModalOpen(false)}
          className="absolute right-6 top-8 text-stone-400 hover:text-white transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
        <h2 className="text-2xl font-black tracking-tight">Record Stock Out</h2>
        <p className="text-stone-400 text-sm mt-1 font-medium">Standard usage or damage recording</p>
      </div>

      <div className="p-6 space-y-6">
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Select Item</p>
          <select
            value={stockOutSku}
            onChange={(e) => setStockOutSku(e.target.value)}
            className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-stone-900/5 outline-none appearance-none cursor-pointer"
          >
            <option value="">Choose item...</option>
            {branchStock.map((stock) => (
              <option key={stock.item_sku} value={stock.item_sku}>
                {stock.item?.item_name || stock.item_sku} ({stock.quantity} On Hand)
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Quantity</p>
            <input
              type="number"
              min="1"
              value={stockOutQuantity || ''}
              onChange={(e) => setStockOutQuantity(parseInt(e.target.value) || 0)}
              className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-sm font-black focus:ring-2 focus:ring-stone-900/5 outline-none"
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Reason Type</p>
            <select
              value={stockOutType}
              onChange={(e) => setStockOutType(e.target.value)}
              className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-stone-900/5 outline-none appearance-none cursor-pointer"
            >
              <option value="USAGE">Normal Usage</option>
              <option value="KITCHEN_USE">Kitchen Use</option>
              <option value="HOUSEKEEPING_USE">Housekeeping Use</option>
              <option value="DAMAGE">Damage</option>
              <option value="LOSS">Loss</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Notes</p>
          <input
            value={stockOutReason}
            onChange={(e) => setStockOutReason(e.target.value)}
            placeholder="Optional detail..."
            className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-stone-900/5 outline-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setIsStockOutModalOpen(false)}
            className="flex-1 h-12 bg-stone-100 text-stone-600 rounded-xl text-sm font-bold active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleStockOut}
            disabled={!stockOutSku || stockOutQuantity <= 0 || isLoading}
            className="flex-[2] h-12 bg-[#3C3C43] text-white rounded-xl text-sm font-bold shadow-lg shadow-stone-200 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Minus className="h-4 w-4" />}
            <span>Deduct Stock</span>
          </button>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  {/* Morning Stock Count Modal */ }
  <Dialog open={isStockUpdateModalOpen} onOpenChange={setIsStockUpdateModalOpen}>
    <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-3xl shadow-2xl bg-white flex flex-col max-h-[85vh]">
      <div className="bg-stone-900 px-6 py-8 text-white relative flex-shrink-0">
        <button
          onClick={() => setIsStockUpdateModalOpen(false)}
          className="absolute right-6 top-8 text-stone-400 hover:text-white transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
        <h2 className="text-2xl font-black tracking-tight">Morning Count</h2>
        <p className="text-stone-400 text-sm mt-1 font-medium">Verify physical store levels</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
        <div className="grid grid-cols-12 gap-2 px-3 text-[10px] font-bold uppercase text-stone-400 tracking-widest mb-2">
          <div className="col-span-6">Product</div>
          <div className="col-span-3 text-center">System</div>
          <div className="col-span-3 text-center">Actual</div>
        </div>

        <div className="space-y-2">
          {branchStock.map((item) => (
            <div key={item.id} className="grid grid-cols-12 gap-2 items-center p-3 bg-stone-50 rounded-2xl border border-stone-100 hover:border-stone-200 transition-colors">
              <div className="col-span-6 min-w-0">
                <p className="font-black text-[13px] text-stone-900 truncate leading-tight">{item.item?.item_name || item.item_sku}</p>
                <code className="text-[10px] font-bold text-stone-400 uppercase mt-0.5 block">{item.item_sku}</code>
              </div>
              <div className="col-span-3 text-center">
                <span className="text-[13px] font-black text-stone-500">{item.quantity}</span>
              </div>
              <div className="col-span-3">
                <input
                  type="number"
                  className="w-full h-9 bg-white border border-stone-200 rounded-lg text-center text-sm font-black focus:ring-2 focus:ring-stone-900/5 outline-none"
                  value={stockUpdates[item.item_sku] ?? ''}
                  onChange={(e) => setStockUpdates({
                    ...stockUpdates,
                    [item.item_sku]: parseInt(e.target.value) || 0
                  })}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 px-1">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2 ml-1">Discrepancy Notes</p>
          <textarea
            className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-stone-900/5 outline-none resize-none"
            rows={2}
            placeholder="Explain any differences..."
            value={updateNotes}
            onChange={(e) => setUpdateNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="p-6 bg-white border-t border-stone-100 flex gap-3">
        <button
          onClick={() => setIsStockUpdateModalOpen(false)}
          className="flex-1 h-12 bg-stone-100 text-stone-600 rounded-xl text-sm font-bold active:scale-95 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleStockUpdate}
          disabled={isLoading}
          className="flex-[2] h-12 bg-stone-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-stone-200 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
        >
          {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          <span>Sync Stock Levels</span>
        </button>
      </div>
    </DialogContent>
  </Dialog>

  {/* Receive Delivery Modal (Detailed) */ }
  <Dialog open={isReceiveModalOpen} onOpenChange={setIsReceiveModalOpen}>
    <DialogContent className="max-w-3xl p-0 overflow-hidden border-none rounded-3xl shadow-2xl bg-white flex flex-col max-h-[90vh]">
      <div className="bg-stone-900 px-6 py-8 text-white relative flex-shrink-0">
        <button
          onClick={() => setIsReceiveModalOpen(false)}
          className="absolute right-6 top-8 text-stone-400 hover:text-white transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center">
            <ArrowDownToLine className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">Confirm Inbound</h2>
            <p className="text-stone-400 text-sm mt-0.5 font-medium">Verify products on delivery</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        {selectedDispatch && (
          <>
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="font-black text-stone-900 font-mono tracking-wider">{selectedDispatch.dispatch_number}</p>
                <IOSBadge size="xs" className="bg-stone-900 text-white border-stone-900">{selectedDispatch.status}</IOSBadge>
              </div>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">From: {selectedDispatch.from_branch?.name || 'Central Warehouse'}</p>
              <p className="text-[11px] font-bold text-stone-500">Scheduled: {format(new Date(selectedDispatch.dispatched_at), 'MMM d, hh:mm a')}</p>
            </div>

            <div className="space-y-4">
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Products to Verify</p>
              {selectedDispatch.items?.map((item: any) => {
                const details = receivedItems[item.id] || { quantity: item.dispatched_quantity, damaged: 0, missing: 0, note: '' };
                return (
                  <div key={item.id} className="bg-white border border-stone-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-black text-[13px] text-stone-900 truncate leading-tight">{item.item?.item_name || item.item_sku}</p>
                        <code className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter block mt-0.5">{item.item_sku}</code>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-wider leading-none">Manifest</p>
                        <p className="text-lg font-black text-stone-900">{item.dispatched_quantity}</p>
                        <p className="text-[10px] font-bold text-stone-400 uppercase mt-0.5">{item.item?.unit_of_measure}</p>
                      </div>
                    </div>

                    <div className="p-4 grid grid-cols-3 gap-3">
                      <div className="space-y-1.5 text-center">
                        <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Received</p>
                        <input
                          type="number"
                          value={details.quantity}
                          onChange={(e) => setReceivedItems({
                            ...receivedItems,
                            [item.id]: { ...details, quantity: parseInt(e.target.value) || 0 }
                          })}
                          className="w-full h-10 bg-stone-50 border border-stone-200 rounded-xl text-center text-[13px] font-black focus:ring-2 focus:ring-stone-900/5 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5 text-center">
                        <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest">Damaged</p>
                        <input
                          type="number"
                          value={details.damaged}
                          onChange={(e) => setReceivedItems({
                            ...receivedItems,
                            [item.id]: { ...details, damaged: parseInt(e.target.value) || 0 }
                          })}
                          className="w-full h-10 bg-red-50/50 border border-red-100 rounded-xl text-center text-[13px] font-black text-red-600 focus:ring-2 focus:ring-red-900/5 outline-none font-mono"
                        />
                      </div>
                      <div className="space-y-1.5 text-center">
                        <p className="text-[9px] font-bold text-orange-400 uppercase tracking-widest">Missing</p>
                        <input
                          type="number"
                          value={details.missing}
                          onChange={(e) => setReceivedItems({
                            ...receivedItems,
                            [item.id]: { ...details, missing: parseInt(e.target.value) || 0 }
                          })}
                          className="w-full h-10 bg-orange-50/50 border border-orange-100 rounded-xl text-center text-[13px] font-black text-orange-600 focus:ring-2 focus:ring-orange-900/5 outline-none font-mono"
                        />
                      </div>
                    </div>

                    {(details.damaged > 0 || details.missing > 0) && (
                      <div className="px-4 pb-4">
                        <input
                          placeholder="State reason for discrepancy..."
                          className="w-full h-10 px-4 bg-stone-900/5 border-none rounded-xl text-[12px] font-medium focus:ring-2 focus:ring-stone-900/5 outline-none text-stone-600"
                          value={details.note}
                          onChange={(e) => setReceivedItems({
                            ...receivedItems,
                            [item.id]: { ...details, note: e.target.value }
                          })}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Overall Delivery Notes</p>
              <textarea
                className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-stone-900/5 outline-none resize-none"
                rows={2}
                placeholder="Mention delivery agent name, vehicle condition, etc."
                value={deliveryNotes}
                onChange={(e: any) => setDeliveryNotes(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <div className="p-6 bg-white border-t border-stone-100 flex gap-3">
        <button
          onClick={() => setIsReceiveModalOpen(false)}
          className="flex-1 h-12 bg-stone-100 text-stone-600 rounded-xl text-sm font-bold active:scale-95 transition-all"
        >
          Defer
        </button>
        <button
          onClick={handleConfirmDelivery}
          disabled={isLoading}
          className="flex-[2] h-12 bg-stone-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-stone-200 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
        >
          {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          <span>Finalize Inbound</span>
        </button>
      </div>
    </DashboardLayout>
  </ProtectedRoute>
      );
}
