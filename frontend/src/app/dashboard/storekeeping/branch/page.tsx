'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Package, Store, Truck, ClipboardList, AlertTriangle,
  Search, Plus, Check, X, Send, RefreshCw, Minus,
  ChevronRight, Clock, ArrowDownToLine, History, Box,
  ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown
} from 'lucide-react';
import { toast } from 'sonner';

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
  const [activeTab, setActiveTab] = useState<'stock' | 'requests' | 'incoming' | 'movements'>('stock');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
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
  const [isStockOutModalOpen, setIsStockOutModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState<IncomingDispatch | null>(null);
  
  // Request form
  const [requestItems, setRequestItems] = useState<{item_sku: string; requested_quantity: number}[]>([]);
  const [requestType, setRequestType] = useState('ROUTINE');
  const [requestPriority, setRequestPriority] = useState('NORMAL');
  const [requestReason, setRequestReason] = useState('');

  // Stock out form
  const [stockOutSku, setStockOutSku] = useState('');
  const [stockOutQuantity, setStockOutQuantity] = useState(0);
  const [stockOutType, setStockOutType] = useState('USAGE');
  const [stockOutReason, setStockOutReason] = useState('');

  useEffect(() => {
    if (!authLoading && user) {
      fetchDashboardData();
    }
  }, [authLoading, user]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Add branch_id if available in user context
      const queryParams = user?.branch_id ? `?branch_id=${user.branch_id}` : '';

      const [dashboardRes, stockRes, requestsRes, incomingRes, catalogRes, movementsRes] = await Promise.all([
        fetch(`${API_URL}/api/store/dashboard/branch${queryParams}`, { headers }),
        fetch(`${API_URL}/api/store/branch-stock${queryParams}`, { headers }),
        fetch(`${API_URL}/api/store/stock-requests${queryParams}`, { headers }),
        fetch(`${API_URL}/api/store/incoming-dispatches${queryParams}`, { headers }),
        fetch(`${API_URL}/api/store/master-catalog`, { headers }),
        fetch(`${API_URL}/api/store/stock-movements${queryParams}`, { headers }).catch(() => ({ ok: false }))
      ]);

      if (dashboardRes.ok) {
        const data = await dashboardRes.json();
        setStats(data.data?.stats || stats);
      }

      if (stockRes.ok) {
        const data = await stockRes.json();
        setBranchStock(data.data || []);
      }

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setMyRequests(data.data || []);
      }

      if (incomingRes.ok) {
        const data = await incomingRes.json();
        setIncomingDispatches(data.data || []);
      }

      if (catalogRes.ok) {
        const data = await catalogRes.json();
        setMasterCatalog(data.data || []);
      }

      if (movementsRes.ok) {
        const data = await movementsRes.json();
        setStockMovements(data.data || []);
      }

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
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/stock-requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: requestItems,
          request_type: requestType,
          priority: requestPriority,
          reason: requestReason
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Request ${data.data.request_number} created`);
        setIsRequestModalOpen(false);
        setRequestItems([]);
        setRequestReason('');
        fetchDashboardData();
      } else {
        throw new Error('Failed to create request');
      }
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
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/branch-stock/out`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          item_sku: stockOutSku,
          quantity: stockOutQuantity,
          movement_type: stockOutType,
          reason: stockOutReason
        })
      });

      if (response.ok) {
        toast.success('Stock out recorded');
        setIsStockOutModalOpen(false);
        setStockOutSku('');
        setStockOutQuantity(0);
        setStockOutReason('');
        fetchDashboardData();
      } else {
        throw new Error('Failed to record stock out');
      }
    } catch (error) {
      toast.error('Failed to record stock out');
    }
  };

  const handleConfirmDelivery = async () => {
    if (!selectedDispatch) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/dispatch-notes/${selectedDispatch.id}/confirm`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          received_items: selectedDispatch.items.map(item => ({
            id: item.id,
            received_quantity: item.dispatched_quantity,
            damaged_quantity: 0,
            missing_quantity: 0
          })),
          delivery_notes: ''
        })
      });

      if (response.ok) {
        toast.success('Delivery confirmed');
        setIsReceiveModalOpen(false);
        setSelectedDispatch(null);
        fetchDashboardData();
      } else {
        throw new Error('Failed to confirm delivery');
      }
    } catch (error) {
      toast.error('Failed to confirm delivery');
    }
  };

  const addItemToRequest = (item: any) => {
    const existing = requestItems.find(i => i.item_sku === item.sku);
    if (existing) {
      setRequestItems(requestItems.map(i => 
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
      case 'PENDING': return 'bg-yellow-500';
      case 'APPROVED': return 'bg-green-500';
      case 'REJECTED': return 'bg-red-500';
      case 'DISPATCHED': return 'bg-blue-500';
      case 'IN_TRANSIT': return 'bg-purple-500';
      case 'DELIVERED': return 'bg-green-600';
      default: return 'bg-gray-500';
    }
  };

  const filteredStock = branchStock.filter(stock => 
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
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
                <Store className="h-8 w-8 text-green-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Branch Inventory</h1>
                  <p className="text-gray-600">Manage your branch stock and request from central</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsStockOutModalOpen(true)}>
                <Minus className="h-4 w-4 mr-2" />
                Stock Out
              </Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => setIsRequestModalOpen(true)}>
                <Send className="h-4 w-4 mr-2" />
                Request Stock
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500 rounded-xl">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700">Total Items</p>
                  <p className="text-3xl font-bold text-blue-900">{stats.totalItems}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-700">Low Stock</p>
                  <p className="text-3xl font-bold text-amber-900">{stats.lowStock}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500 rounded-xl">
                  <ClipboardList className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-700">Pending Requests</p>
                  <p className="text-3xl font-bold text-purple-900">{stats.pendingRequests}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500 rounded-xl">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-700">Incoming</p>
                  <p className="text-3xl font-bold text-green-900">{stats.incomingDispatches}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
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
                  className={`pb-4 px-1 flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-b-2 border-green-600 text-green-600'
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
          <div className="bg-white rounded-xl shadow-sm border">
            
            {/* Current Stock Tab */}
            {activeTab === 'stock' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search items..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
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
                          <tr key={stock.id} className={`hover:bg-gray-50 ${isLow ? 'bg-amber-50' : ''}`}>
                            <td className="px-4 py-4 font-mono text-sm">{stock.item_sku}</td>
                            <td className="px-4 py-4 font-medium">{stock.item?.item_name || '-'}</td>
                            <td className="px-4 py-4 text-sm text-gray-500">{stock.item?.category || '-'}</td>
                            <td className="px-4 py-4">
                              <span className={`text-lg font-bold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                                {stock.quantity}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-500">{stock.reorder_level}</td>
                            <td className="px-4 py-4">
                              {isLow ? (
                                <Badge className="bg-amber-500">Low Stock</Badge>
                              ) : (
                                <Badge className="bg-green-500">OK</Badge>
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
                      {myRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 font-mono text-sm">{request.request_number}</td>
                          <td className="px-4 py-4">{request.request_type}</td>
                          <td className="px-4 py-4">
                            <Badge className={
                              request.priority === 'URGENT' ? 'bg-red-500' :
                              request.priority === 'HIGH' ? 'bg-orange-500' :
                              'bg-blue-500'
                            }>{request.priority}</Badge>
                          </td>
                          <td className="px-4 py-4">{request.items?.length || 0} items</td>
                          <td className="px-4 py-4">
                            <Badge className={getStatusColor(request.status)}>{request.status}</Badge>
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
                  {incomingDispatches.map((dispatch) => (
                    <Card key={dispatch.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono font-medium">{dispatch.dispatch_number}</p>
                          <p className="text-sm text-gray-500">From: {dispatch.from_branch?.name || 'Central'}</p>
                          <p className="text-sm text-gray-500">{dispatch.items?.length || 0} items</p>
                        </div>
                        <div className="text-right">
                          <Badge className={getStatusColor(dispatch.status)}>{dispatch.status}</Badge>
                          {dispatch.status === 'IN_TRANSIT' && (
                            <Button 
                              className="mt-2 bg-green-600 hover:bg-green-700" 
                              size="sm"
                              onClick={() => {
                                setSelectedDispatch(dispatch);
                                setIsReceiveModalOpen(true);
                              }}
                            >
                              <Check className="h-4 w-4 mr-1" /> Receive
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
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

            {/* Movements Tab */}
            {activeTab === 'movements' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Stock Movement History</h3>
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
                                <ArrowDownLeft className="h-4 w-4 text-green-500" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4 text-red-500" />
                              )}
                              <span className={movement.movement_type === 'IN' || movement.movement_type === 'RECEIVED' ? 'text-green-600' : 'text-red-600'}>
                                {movement.movement_type}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`font-bold ${movement.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
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
          </div>
        </div>

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
                <div className="border rounded-lg max-h-48 overflow-y-auto">
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
                      <Plus className="h-4 w-4 text-green-600" />
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
                        <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
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
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setRequestItems(requestItems.filter((_, i) => i !== idx))}
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsRequestModalOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700" 
                  onClick={handleCreateRequest}
                  disabled={requestItems.length === 0}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Submit Request
                </Button>
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
                <Button variant="outline" onClick={() => setIsStockOutModalOpen(false)}>
                  Cancel
                </Button>
                <Button className="bg-red-600 hover:bg-red-700" onClick={handleStockOut}>
                  <Minus className="h-4 w-4 mr-2" />
                  Record Stock Out
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Receive Delivery Modal */}
        <Dialog open={isReceiveModalOpen} onOpenChange={setIsReceiveModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5" />
                Confirm Delivery
              </DialogTitle>
            </DialogHeader>

            {selectedDispatch && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-mono font-medium">{selectedDispatch.dispatch_number}</p>
                  <p className="text-sm text-gray-500">{selectedDispatch.items?.length || 0} items</p>
                </div>

                <div className="space-y-2">
                  {selectedDispatch.items?.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{item.item?.item_name || item.item_sku}</p>
                        <p className="text-xs text-gray-500 font-mono">{item.item_sku}</p>
                      </div>
                      <p className="font-bold">{item.dispatched_quantity}</p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsReceiveModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button className="bg-green-600 hover:bg-green-700" onClick={handleConfirmDelivery}>
                    <Check className="h-4 w-4 mr-2" />
                    Confirm All Received
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
