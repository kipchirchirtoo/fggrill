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
      case 'APPROVED': return 'bg-[#F2F2F7]0';
      case 'REJECTED': return 'bg-[#F2F2F7]0';
      case 'DISPATCHED': return 'bg-[#F2F2F7]0';
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
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER, UserRole.RESTAURANT, UserRole.HOUSEKEEPING]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Store className="h-8 w-8 text-[#3C3C43]" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Branch Inventory</h1>
                  <p className="text-gray-600">Manage your branch stock and request from central</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <IOSButton variant="outline" onClick={() => setIsStockOutModalOpen(true)} leftIcon={<Minus />}>
                Stock Out
              </IOSButton>
              <IOSButton className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={() => setIsRequestModalOpen(true)} leftIcon={<Send />}>
                Request Stock
              </IOSButton>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <IOSCard className="p-6 bg-[#F2F2F7] border-[rgba(60,60,67,0.12)]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#F2F2F7]0 rounded-xl">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#000000]">Total Items</p>
                  <p className="text-3xl font-bold text-[#000000]">{stats.totalItems}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-6 bg-[#F2F2F7] border-[rgba(60,60,67,0.12)]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#F2F2F7] rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#3C3C43]">Low Stock</p>
                  <p className="text-3xl font-bold text-[#3C3C43]">{stats.lowStock}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-6 bg-[#F2F2F7] border-[rgba(60,60,67,0.12)]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#F2F2F7] rounded-xl">
                  <ClipboardList className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#3C3C43]">Pending Requests</p>
                  <p className="text-3xl font-bold text-[#3C3C43]">{stats.pendingRequests}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-6 bg-[#F2F2F7] border-[rgba(60,60,67,0.12)]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#F2F2F7]0 rounded-xl">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#000000]">Incoming</p>
                  <p className="text-3xl font-bold text-[#000000]">{stats.incomingDispatches}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Tabs */}
          <div className="border-b border-[#E5E5EA]">
            <nav className="-mb-px flex gap-6">
              {[
                { id: 'stock', label: 'Current Stock', icon: Box },
                { id: 'requests', label: `My Requests (${myRequests.length})`, icon: ClipboardList },
                { id: 'incoming', label: `Incoming (${incomingDispatches.length})`, icon: ArrowDownToLine },
                { id: 'movements', label: 'History', icon: History }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-4 px-1 flex items-center gap-2 ${activeTab === tab.id
                    ? 'border-b-2 border-[rgba(60,60,67,0.12)] text-[#3C3C43]'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="bg-[#FFFFFF] rounded-xl shadow-none 0_1px_3px_rgba(0,0,0,0.04)] border">

            {/* Current Stock Tab */}
            {activeTab === 'stock' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                    <Input
                      placeholder="Search items..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <IOSButton
                    variant="outline"
                    onClick={() => {
                      const initialUpdates: Record<string, number> = {};
                      branchStock.forEach(item => {
                        initialUpdates[item.item_sku] = item.quantity;
                      });
                      setStockUpdates(initialUpdates);
                      setIsStockUpdateModalOpen(true);
                    }}
                    leftIcon={<PackageSearch />}
                  >
                    Morning Stock Count
                  </IOSButton>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reorder Level</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredStock.map((stock) => {
                        const isLow = stock.quantity <= stock.reorder_level;
                        return (
                          <tr key={stock.id} className={`hover:bg-gray-50 ${isLow ? 'bg-[#F2F2F7]' : ''}`}>
                            <td className="px-4 py-4 font-mono text-sm">{stock.item_sku}</td>
                            <td className="px-4 py-4 font-medium">{stock.item?.item_name || '-'}</td>
                            <td className="px-4 py-4 text-sm text-gray-500">{stock.item?.category || '-'}</td>
                            <td className="px-4 py-4">
                              <span className={`text-lg font-bold ${isLow ? 'text-[#3C3C43]' : 'text-gray-900'}`}>
                                {stock.quantity}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-500">{stock.reorder_level}</td>
                            <td className="px-4 py-4">
                              {isLow ? (
                                <IOSBadge className="bg-[#F2F2F7]">Low Stock</IOSBadge>
                              ) : (
                                <IOSBadge className="bg-[#F2F2F7]0">OK</IOSBadge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredStock.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No stock items found</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* My Requests Tab */}
            {activeTab === 'requests' && (
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {myRequests.map((request: any) => (
                        <tr key={request.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 font-mono text-sm">{request.request_number}</td>
                          <td className="px-4 py-4">{request.request_type}</td>
                          <td className="px-4 py-4">
                            <IOSBadge className={
                              request.priority === 'URGENT' ? 'bg-[#F2F2F7]0' :
                                request.priority === 'HIGH' ? 'bg-[#F2F2F7]' :
                                  'bg-[#F2F2F7]0'
                            }>{request.priority}</IOSBadge>
                          </td>
                          <td className="px-4 py-4">{request.items?.length || 0} items</td>
                          <td className="px-4 py-4">
                            <IOSBadge className={getStatusColor(request.status)}>{request.status}</IOSBadge>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {new Date(request.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {myRequests.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No requests yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Incoming Dispatches Tab */}
            {activeTab === 'incoming' && (
              <div className="p-6">
                <div className="space-y-4">
                  {incomingDispatches.map((dispatch: IncomingDispatch) => (
                    <IOSCard key={dispatch.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono font-medium">{dispatch.dispatch_number}</p>
                          <p className="text-sm text-gray-500">From: {dispatch.from_branch?.name || 'Central'}</p>
                          <p className="text-sm text-gray-500">{dispatch.items?.length || 0} items</p>
                        </div>
                        <div className="text-right">
                          <IOSBadge className={getStatusColor(dispatch.status)}>{dispatch.status}</IOSBadge>
                          {dispatch.status === 'IN_TRANSIT' && (
                            <IOSButton
                              className="mt-2 bg-[#3C3C43] hover:bg-[#3C3C43]"
                              size="sm"
                              onClick={() => {
                                setSelectedDispatch(dispatch);
                                setIsReceiveModalOpen(true);
                              }}
                              leftIcon={<Check />}
                            >
                              Receive
                            </IOSButton>
                          )}
                        </div>
                      </div>
                    </IOSCard>
                  ))}
                  {incomingDispatches.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No incoming dispatches</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Kitchen Usage Tab */}
            {activeTab === 'usage' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold">Kitchen Usage Tracking</h3>
                    <p className="text-sm text-gray-500">Track items issued to the kitchen and record consumption.</p>
                  </div>
                  <IOSButton
                    size="sm"
                    leftIcon={<Plus />}
                    className="bg-[#3C3C43] hover:bg-[#3C3C43]"
                    onClick={() => setIsUsageModalOpen(true)}
                  >
                    Issue to Kitchen
                  </IOSButton>
                </div>

                {usageRecords.length > 0 ? (
                  usageRecords.map((record: any) => (
                    <IOSCard key={record.id} className="p-4 border-[rgba(60,60,67,0.12)]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-gray-50 rounded-xl">
                            <Utensils className="h-6 w-6 text-[#3C3C43]" />
                          </div>
                          <div>
                            <p className="font-bold">{record.item?.item_name || record.item_sku}</p>
                            <div className="flex gap-4 mt-1">
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Package className="h-3 w-3" /> Issued: {record.received_quantity}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <User className="h-3 w-3" /> Staff: {record.responsible_staff_name || 'Not assigned'}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Date: {new Date(record.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <IOSBadge className={record.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                            {record.status}
                          </IOSBadge>
                          <div className="mt-2">
                            <IOSButton variant="ghost" size="sm" onClick={() => router.push(`/dashboard/storekeeping/branch/usage/${record.id}`)}>
                              View Details
                            </IOSButton>
                          </div>
                        </div>
                      </div>
                    </IOSCard>
                  ))
                ) : (
                  <div className="text-center py-20 border-2 border-dashed rounded-xl">
                    <Utensils className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500">No active kitchen usage records.</p>
                    <p className="text-sm text-gray-400 mt-1">Issue items to the kitchen to begin tracking.</p>
                    <IOSButton
                      variant="ghost"
                      className="mt-4"
                      onClick={() => setIsUsageModalOpen(true)}
                    >
                      Issue Now
                    </IOSButton>
                  </div>
                )}
              </div>
            )}

            {/* Movements Tab */}
            {activeTab === 'movements' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold font-sf-pro-display text-gray-900">Stock Movement History</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stockMovements.map((movement) => (
                        <tr key={movement.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {new Date(movement.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-medium">{movement.item?.item_name || movement.item_sku}</p>
                            <p className="text-xs text-gray-500 font-mono">{movement.item_sku}</p>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              {movement.movement_type === 'IN' || movement.movement_type === 'RECEIVED' ? (
                                <ArrowDownLeft className="h-4 w-4 text-[#8E8E93]0" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4 text-[#8E8E93]0" />
                              )}
                              <span className={movement.movement_type === 'IN' || movement.movement_type === 'RECEIVED' ? 'text-[#3C3C43]' : 'text-[#3C3C43]'}>
                                {movement.movement_type}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`font-bold ${movement.quantity > 0 ? 'text-[#3C3C43]' : 'text-[#3C3C43]'}`}>
                              {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {movement.reference || movement.reason || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {stockMovements.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No stock movements recorded yet</p>
                      <p className="text-sm mt-2">Stock in/out and transfers will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Reports Tab */}
            {activeTab === 'reports' && (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <IOSCard className="p-6">
                    <h3 className="font-bold flex items-center gap-2 mb-4">
                      <BarChart3 className="h-5 w-5" /> Stock Value Summary
                    </h3>
                    <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl border border-dashed">
                      <p className="text-gray-400">Stock value chart coming soon...</p>
                    </div>
                  </IOSCard>

                  <IOSCard className="p-6">
                    <h3 className="font-bold flex items-center gap-2 mb-4">
                      <TrendingUp className="h-5 w-5" /> Usage Patterns
                    </h3>
                    <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl border border-dashed">
                      <p className="text-gray-400">Usage trends chart coming soon...</p>
                    </div>
                  </IOSCard>
                </div>

                <div className="mt-6">
                  <h3 className="font-bold mb-4">Recent Stock Movements Summary</h3>
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Received (30d)</p>
                        <p className="text-2xl font-bold text-green-600">0</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Consumed (30d)</p>
                        <p className="text-2xl font-bold text-blue-600">0</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Wastage (30d)</p>
                        <p className="text-2xl font-bold text-red-600">0</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Kitchen Issue Modal */}
        <Dialog open={isUsageModalOpen} onOpenChange={setIsUsageModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Utensils className="h-5 w-5" />
                Issue to Kitchen
              </DialogTitle>
              <DialogDescription>
                Transfer items from store to kitchen for tracking.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-4">
              <div>
                <Label>Select Item</Label>
                <Select
                  value={usageDetails.item_sku}
                  onValueChange={(val) => setUsageDetails({ ...usageDetails, item_sku: val })}
                >
                  <SelectTrigger><SelectValue placeholder="Choose item..." /></SelectTrigger>
                  <SelectContent>
                    {branchStock.map((item) => (
                      <SelectItem key={item.item_sku} value={item.item_sku}>
                        {item.item?.item_name || item.item_sku} ({item.quantity} in stock)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantity to Issue</Label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={usageDetails.quantity || ''}
                  onChange={(e) => setUsageDetails({ ...usageDetails, quantity: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g. 10.5"
                />
              </div>

              <div>
                <Label>Accountable Staff</Label>
                <Select
                  value={usageDetails.staff_id}
                  onValueChange={(val) => setUsageDetails({ ...usageDetails, staff_id: val })}
                >
                  <SelectTrigger><SelectValue placeholder="Select staff member..." /></SelectTrigger>
                  <SelectContent>
                    {branchStaff.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.first_name} {staff.last_name} ({staff.role})
                        {staff.first_name} {staff.last_name} ({staff.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Notes</Label>
                <Input
                  value={usageDetails.notes}
                  onChange={(e) => setUsageDetails({ ...usageDetails, notes: e.target.value })}
                  placeholder="Specific instructions or notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t">
                <IOSButton variant="outline" onClick={() => setIsUsageModalOpen(false)}>
                  Cancel
                </IOSButton>
                <IOSButton
                  className="bg-[#3C3C43] hover:bg-[#3C3C43]"
                  onClick={handleIssueToKitchen}
                  disabled={!usageDetails.item_sku || usageDetails.quantity <= 0}
                  leftIcon={<Check />}
                >
                  Issue Items
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Request Modal */}
        <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Create Stock Request
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Request Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Request Type</Label>
                  <Select value={requestType} onValueChange={setRequestType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ROUTINE">Routine Restock</SelectItem>
                      <SelectItem value="EMERGENCY">Emergency</SelectItem>
                      <SelectItem value="EVENT">Event/Special</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={requestPriority} onValueChange={setRequestPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Reason (optional)</Label>
                <Input
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="Reason for request..."
                />
              </div>

              {/* Add Items */}
              <div>
                <Label className="mb-2 block">Add Items from Catalog</Label>
                <div className="border rounded-ios-lg max-h-48 overflow-y-auto">
                  {masterCatalog.slice(0, 20).map((item) => (
                    <div
                      key={item.sku}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 border-b cursor-pointer"
                      onClick={() => addItemToRequest(item)}
                    >
                      <div>
                        <p className="font-medium">{item.item_name || item.description}</p>
                        <p className="text-xs text-gray-500 font-mono">{item.sku}</p>
                      </div>
                      <Plus className="h-4 w-4 text-[#3C3C43]" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Items */}
              {requestItems.length > 0 && (
                <div>
                  <Label className="mb-2 block">Request Items ({requestItems.length})</Label>
                  <div className="space-y-2">
                    {requestItems.map((item, idx) => {
                      const catalogItem = masterCatalog.find(c => c.sku === item.item_sku);
                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-[#F2F2F7] rounded-ios-lg">
                          <div>
                            <p className="font-medium">{catalogItem?.item_name || item.item_sku}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              value={item.requested_quantity}
                              onChange={(e) => {
                                const newItems = [...requestItems];
                                newItems[idx].requested_quantity = parseInt(e.target.value) || 1;
                                setRequestItems(newItems);
                              }}
                              className="w-20"
                            />
                            <IOSButton
                              variant="ghost"
                              size="sm"
                              onClick={() => setRequestItems(requestItems.filter((_, i) => i !== idx))}
                            >
                              <X className="h-4 w-4 text-[#8E8E93]0" />
                            </IOSButton>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <IOSButton variant="outline" onClick={() => setIsRequestModalOpen(false)}>
                  Cancel
                </IOSButton>
                <IOSButton
                  className="bg-[#3C3C43] hover:bg-[#3C3C43]"
                  onClick={handleCreateRequest}
                  disabled={requestItems.length === 0}
                  leftIcon={<Send />}>Submit Request
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Stock Out Modal */}
        <Dialog open={isStockOutModalOpen} onOpenChange={setIsStockOutModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Minus className="h-5 w-5" />
                Record Stock Out
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Item</Label>
                <Select value={stockOutSku} onValueChange={setStockOutSku}>
                  <SelectTrigger><SelectValue placeholder="Select item..." /></SelectTrigger>
                  <SelectContent>
                    {branchStock.map((stock) => (
                      <SelectItem key={stock.item_sku} value={stock.item_sku}>
                        {stock.item?.item_name || stock.item_sku} ({stock.quantity} available)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={stockOutQuantity || ''}
                  onChange={(e) => setStockOutQuantity(parseInt(e.target.value) || 0)}
                />
              </div>

              <div>
                <Label>Type</Label>
                <Select value={stockOutType} onValueChange={setStockOutType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USAGE">Normal Usage</SelectItem>
                    <SelectItem value="KITCHEN_USE">Kitchen Use</SelectItem>
                    <SelectItem value="HOUSEKEEPING_USE">Housekeeping Use</SelectItem>
                    <SelectItem value="DAMAGE">Damage</SelectItem>
                    <SelectItem value="LOSS">Loss</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Reason/Notes</Label>
                <Input
                  value={stockOutReason}
                  onChange={(e) => setStockOutReason(e.target.value)}
                  placeholder="Optional notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <IOSButton variant="outline" onClick={() => setIsStockOutModalOpen(false)}>
                  Cancel
                </IOSButton>
                <IOSButton className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={handleStockOut} leftIcon={<Minus />}>Record Stock Out
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Morning Stock Count Modal */}
        <Dialog open={isStockUpdateModalOpen} onOpenChange={setIsStockUpdateModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PackageSearch className="h-5 w-5" />
                Morning Stock Count
              </DialogTitle>
              <DialogDescription>
                Record the actual physical count of items in the store this morning.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              <div className="grid grid-cols-12 gap-4 px-2 text-xs font-bold uppercase text-gray-500">
                <div className="col-span-6">Item</div>
                <div className="col-span-3 text-center">System Qty</div>
                <div className="col-span-3 text-center">Actual Count</div>
              </div>
              <div className="space-y-2">
                {branchStock.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-4 items-center p-3 bg-gray-50 rounded-ios-lg">
                    <div className="col-span-6">
                      <p className="font-medium text-sm">{item.item?.item_name || item.item_sku}</p>
                      <p className="text-xs text-gray-500 font-mono">{item.item_sku}</p>
                    </div>
                    <div className="col-span-3 text-center">
                      <span className="text-sm font-sf-pro-display text-[#3A3A3C]">{item.quantity}</span>
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        className="text-center font-bold"
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

              <div className="pt-4 px-2">
                <Label>Notes</Label>
                <textarea
                  className="w-full mt-1 p-3 border rounded-ios-lg focus:ring-1 focus:ring-black outline-none"
                  rows={2}
                  placeholder="Any discrepancies or notes..."
                  value={updateNotes}
                  onChange={(e) => setUpdateNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
              <IOSButton variant="outline" onClick={() => setIsStockUpdateModalOpen(false)}>
                Cancel
              </IOSButton>
              <IOSButton className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={handleStockUpdate} leftIcon={<Check />}>
                Save Counts
              </IOSButton>
            </div>
          </DialogContent>
        </Dialog>

        {/* Receive Delivery Modal (Detailed) */}
        <Dialog open={isReceiveModalOpen} onOpenChange={setIsReceiveModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5" />
                Confirm Incoming Delivery
              </DialogTitle>
              <DialogDescription>
                Verify each item received against the dispatch note. Report any damages or missing items.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-4 space-y-6">
              {selectedDispatch && (
                <>
                  <div className="bg-[#F2F2F7] p-4 rounded-ios-lg space-y-1">
                    <p className="font-mono font-bold text-[#3C3C43]">{selectedDispatch.dispatch_number}</p>
                    <p className="text-sm text-gray-600">From: {selectedDispatch.from_branch?.name || 'Central Warehouse'}</p>
                    <p className="text-sm text-gray-600">Sent: {new Date(selectedDispatch.dispatched_at).toLocaleString()}</p>
                  </div>

                  <div className="space-y-4">
                    {selectedDispatch.items?.map((item: any) => {
                      const details = receivedItems[item.id] || { quantity: item.dispatched_quantity, damaged: 0, missing: 0, note: '' };
                      return (
                        <div key={item.id} className="border rounded-ios-lg overflow-hidden shadow-sm">
                          <div className="bg-gray-50 p-3 border-b flex justify-between items-center">
                            <div>
                              <p className="font-bold text-sm">{item.item?.item_name || item.item_sku}</p>
                              <p className="text-xs text-gray-500">{item.item_sku}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500 uppercase font-bold">Dispatched</p>
                              <p className="text-lg font-bold">{item.dispatched_quantity}</p>
                            </div>
                          </div>

                          <div className="p-4 grid grid-cols-3 gap-4">
                            <div>
                              <Label className="text-[10px] uppercase text-gray-400">Received OK</Label>
                              <Input
                                type="number"
                                value={details.quantity}
                                onChange={(e) => setReceivedItems({
                                  ...receivedItems,
                                  [item.id]: { ...details, quantity: parseInt(e.target.value) || 0 }
                                })}
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] uppercase text-gray-400">Damaged</Label>
                              <Input
                                type="number"
                                className="border-red-100 bg-red-50/10"
                                value={details.damaged}
                                onChange={(e) => setReceivedItems({
                                  ...receivedItems,
                                  [item.id]: { ...details, damaged: parseInt(e.target.value) || 0 }
                                })}
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] uppercase text-gray-400">Missing</Label>
                              <Input
                                type="number"
                                className="border-amber-100 bg-amber-50/10"
                                value={details.missing}
                                onChange={(e) => setReceivedItems({
                                  ...receivedItems,
                                  [item.id]: { ...details, missing: parseInt(e.target.value) || 0 }
                                })}
                              />
                            </div>
                          </div>

                          {(details.damaged > 0 || details.missing > 0) && (
                            <div className="px-4 pb-4">
                              <Input
                                placeholder="Discrepancy reason..."
                                className="text-sm bg-[#F2F2F7] border-0"
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

                  <div className="px-2">
                    <Label>General Delivery Notes</Label>
                    <textarea
                      className="w-full mt-1 p-3 border rounded-ios-lg focus:ring-1 focus:ring-black outline-none"
                      rows={2}
                      placeholder="Comment on condition, delivery person, etc."
                      value={deliveryNotes}
                      onChange={(e: any) => setDeliveryNotes(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
              <IOSButton variant="outline" onClick={() => setIsReceiveModalOpen(false)}>
                Cancel
              </IOSButton>
              <IOSButton className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={handleConfirmDelivery} leftIcon={<Check />}>
                Confirm & Add to Stock
              </IOSButton>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
