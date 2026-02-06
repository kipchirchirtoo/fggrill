'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from "@/components/ui/minimal/button";
import { Input } from '@/components/ui/input';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Package, Warehouse, Truck, ClipboardList, AlertTriangle,
  Building2, Search, Plus, Check, X, Eye, Send, RefreshCw,
  ChevronRight, Clock, MapPin, ArrowRight, Edit, Trash2, Save,
  BarChart3, Box, Filter, ArrowLeftRight, CheckCircle, XCircle,
  Camera, Scan, Keyboard
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { storeAPI } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface StockRequest {
  id: string;
  request_number: string;
  request_type: string;
  priority: string;
  status: string;
  reason?: string;
  needed_by_date?: string;
  created_at: string;
  branch: {
    id: number;
    name: string;
    code: string;
    location: string;
  };
  items: {
    id: string;
    item_sku: string;
    requested_quantity: number;
    approved_quantity?: number;
    status: string;
    item?: {
      sku: string;
      item_name: string;
      description: string;
      category: string;
      unit_of_measure: string;
    };
  }[];
}

interface Branch {
  id: number;
  name: string;
  code: string;
  location: string;
  is_central_warehouse: boolean;
  totalItems?: number;
  lowStockItems?: number;
}

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

const CATEGORIES = ['Beverages', 'Food', 'Cleaning', 'Amenities', 'Kitchen', 'Office', 'Other'];
const UNITS = ['piece', 'kg', 'liter', 'bottle', 'packet', 'box', 'tray', 'roll', 'carton'];

export default function CentralWarehousePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'requests' | 'dispatches' | 'transfers' | 'branches'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Data
  const [stats, setStats] = useState({
    pendingRequests: 0,
    inTransit: 0,
    lowStockBranches: 0,
    weeklyDispatches: 0,
    totalItems: 0,
    totalValue: 0
  });
  const [pendingRequests, setPendingRequests] = useState<StockRequest[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [masterItems, setMasterItems] = useState<Item[]>([]);

  // Modal states
  const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewItems, setReviewItems] = useState<any[]>([]);

  // Item CRUD states
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [itemForm, setItemForm] = useState<Partial<Item>>({
    sku: '',
    barcode: '',
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

  // Barcode scanner state
  const [isScannerActive, setIsScannerActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Dispatch states
  const [dispatchHistory, setDispatchHistory] = useState<any[]>([]);
  const [dispatchLoading, setDispatchLoading] = useState<{ [key: string]: boolean }>({});
  const [isCreateDispatchOpen, setIsCreateDispatchOpen] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({
    request_id: '',
    to_branch_id: 0,
    vehicle_number: '',
    driver_name: '',
    driver_phone: '',
    estimated_delivery: '',
    notes: ''
  });

  // Transfer states
  const [transfers, setTransfers] = useState<any[]>([]);
  const [isCreateTransferOpen, setIsCreateTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    from_branch_id: 0,
    to_branch_id: 0,
    items: [] as { item_sku: string; quantity: number }[],
    notes: ''
  });
  const [transferItems, setTransferItems] = useState<any[]>([]);

  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const canEdit = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER || user?.role === UserRole.CENTRAL_STOREKEEPER;

  useEffect(() => {
    // Redirect branch storekeepers to their dashboard
    if (!authLoading && user) {
      if (user.role === UserRole.BRANCH_STOREKEEPER) {
        router.push('/dashboard/branch-store');
        return;
      }
      fetchDashboardData();
    }
  }, [authLoading, user, router]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Use the storeAPI to fetch data
      const [dashboardData, pendingRequests, branchesData, itemsData, dispatchData, transfersData] = await Promise.all([
        storeAPI.getCentralDashboard(),
        storeAPI.getPendingRequests(),
        storeAPI.getBranchesWithStock(),
        storeAPI.getItems(),
        storeAPI.getDispatchHistory(),
        storeAPI.getTransferItems()
      ]);

      // Update state with the data
      setStats(dashboardData?.data?.stats || stats);
      setPendingRequests(pendingRequests?.data || []);
      setBranches(branchesData?.data || []);
      setMasterItems(itemsData?.data || []);
      setDispatchHistory(dispatchData?.data || []);
      setTransfers(transfersData?.data || []);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDispatchModal = (request: StockRequest) => {
    setDispatchForm({
      request_id: request.id,
      to_branch_id: request.branch.id,
      vehicle_number: '',
      driver_name: '',
      driver_phone: '',
      estimated_delivery: '',
      notes: ''
    });
    setSelectedRequest(request);
    setIsCreateDispatchOpen(true);
  };

  const handleCreateDispatch = async () => {
    if (!selectedRequest) return;

    try {
      // Prepare items from request
      const items = selectedRequest.items
        .filter(i => i.status === 'APPROVED' || i.status === 'PARTIALLY_APPROVED')
        .map(i => ({
          item_sku: i.item_sku,
          quantity: i.approved_quantity || i.requested_quantity
        }));

      if (items.length === 0) {
        toast.error('No approved items to dispatch');
        return;
      }

      const response = await storeAPI.createDispatch({
        request_id: dispatchForm.request_id,
        to_branch_id: dispatchForm.to_branch_id,
        items,
        vehicle_number: dispatchForm.vehicle_number,
        driver_name: dispatchForm.driver_name,
        driver_phone: dispatchForm.driver_phone,
        estimated_delivery: dispatchForm.estimated_delivery,
        notes: dispatchForm.notes
      });

      if (response.success) {
        toast.success(`Dispatch ${response.data?.dispatch_number || ''} created`);
        setIsCreateDispatchOpen(false);
        fetchDashboardData();
        setActiveTab('dispatches');
      } else {
        throw new Error(response.message || 'Failed to create dispatch');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create dispatch');
    }
  };

  // Transfer functions
  const openCreateTransferModal = () => {
    setTransferForm({
      from_branch_id: 0,
      to_branch_id: 0,
      items: [],
      notes: ''
    });
    setTransferItems([{ item_sku: '', quantity: 1 }]);
    setIsCreateTransferOpen(true);
  };

  const addTransferItem = () => {
    setTransferItems([...transferItems, { item_sku: '', quantity: 1 }]);
  };

  const removeTransferItem = (index: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== index));
  };

  const updateTransferItem = (index: number, field: string, value: any) => {
    const updated = [...transferItems];
    updated[index] = { ...updated[index], [field]: value };
    setTransferItems(updated);
  };

  const handleCreateTransfer = async () => {
    if (!transferForm.from_branch_id || !transferForm.to_branch_id) {
      toast.error('Please select source and destination branches');
      return;
    }

    const validItems = transferItems.filter(i => i.item_sku && i.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    try {
      // We need to prepare the data for transfer (use the transferItem function iteratively)
      // Since storeAPI.transferItem takes a single item at a time
      for (const item of validItems) {
        const response = await storeAPI.transferItem({
          sku: item.item_sku,
          transfer_quantity: item.quantity
        });

        if (!response.success) {
          throw new Error(`Failed to add ${item.item_sku} to transfer cart: ${response.message}`);
        }
      }

      // Now submit the entire transfer request
      const submitResponse = await storeAPI.submitTransferRequest();

      if (submitResponse.success) {
        toast.success('Transfer created successfully');
        setIsCreateTransferOpen(false);
        fetchDashboardData();
        setActiveTab('transfers');
      } else {
        throw new Error(submitResponse.message || 'Failed to create transfer');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create transfer');
    }
  };

  const handleDispatchItem = async (dispatchId: string) => {
    try {
      // Set loading state for this specific dispatch
      setDispatchLoading(prev => ({ ...prev, [dispatchId]: true }));

      // Validate the dispatchId
      if (!dispatchId) {
        toast.error('Invalid dispatch ID');
        return;
      }

      const response = await storeAPI.dispatchItems(dispatchId);

      if (response.success) {
        toast.success(`Items dispatched successfully. ${response.data?.dispatch_number || 'Dispatch'} is now in transit.`);
        fetchDashboardData();
      } else {
        throw new Error(response.message || 'Failed to dispatch items');
      }
    } catch (error: any) {
      console.error('Dispatch error:', error);
      toast.error(`Failed to dispatch items: ${error.message || 'Unknown error'}`);
    } finally {
      // Clear loading state
      setDispatchLoading(prev => ({ ...prev, [dispatchId]: false }));
    }
  };

  // ==========================================
  // BARCODE SCANNER FUNCTIONS
  // ==========================================
  const startCameraScanner = async () => {
    setIsScannerActive(true);
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      const html5QrCode = new Html5Qrcode("add-item-barcode-reader", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false
      });

      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 150 }, aspectRatio: 1.777 },
        (decodedText) => {
          stopCameraScanner();
          toast.success(`Scanned: ${decodedText}`);
          setItemForm(prev => ({ ...prev, barcode: decodedText }));
          lookupBarcode(decodedText);
        },
        () => { }
      );
    } catch (err) {
      console.error('Camera error:', err);
      toast.error('Failed to start camera. Please check permissions.');
      setIsScannerActive(false);
    }
  };

  const stopCameraScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    setIsScannerActive(false);
  };

  const lookupBarcode = async (code: string) => {
    if (!code || code.trim().length < 2) return;

    const cleanCode = code.trim();
    try {
      const response = await storeAPI.getItem(cleanCode);

      if (response.success && response.data) {
        const data = response.data;
        // Item found - pre-fill form
        setItemForm(prev => ({
          ...prev,
          sku: data.sku,
          barcode: data.barcode || cleanCode,
          item_name: data.item_name || '',
          description: data.description || '',
          category: data.category || 'Beverages',
          unit_of_measure: data.unit_of_measure || 'piece',
          cost_price: data.cost_price || 0,
          retail_price: data.retail_price || 0,
          reorder_level: data.reorder_level || 10,
          supplier: data.supplier || ''
        }));
        toast.info(`Item found: ${data.item_name}`);
      } else {
        // New item - just set barcode
        setItemForm(prev => ({ ...prev, barcode: cleanCode }));
        toast.info('New item - enter details');
      }
    } catch (error: any) {
      console.error('Lookup error:', error);
    }
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = (e.target as HTMLInputElement).value.trim();
      if (value) lookupBarcode(value);
    }
  };

  const openAddItemModal = () => {
    setItemForm({
      sku: '',
      barcode: '',
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
    setIsAddItemModalOpen(true);
    setTimeout(() => barcodeInputRef.current?.focus(), 150);
  };

  const openEditItemModal = (item: Item) => {
    setSelectedItem(item);
    setItemForm({
      sku: item.sku,
      barcode: item.barcode || '',
      item_name: item.item_name,
      description: item.description || '',
      category: item.category,
      unit_of_measure: item.unit_of_measure,
      quantity: item.quantity,
      retail_price: item.retail_price || 0,
      cost_price: item.cost_price || 0,
      reorder_level: item.reorder_level || 10,
      supplier: item.supplier || ''
    });
    setIsEditItemModalOpen(true);
  };

  const openDeleteConfirm = (item: Item) => {
    setSelectedItem(item);
    setIsDeleteConfirmOpen(true);
  };

  const handleAddItem = async () => {
    try {
      const response = await storeAPI.createItem(itemForm);

      if (response.success) {
        toast.success('Item added successfully');
        setIsAddItemModalOpen(false);
        fetchDashboardData();
      } else {
        throw new Error(response.message || 'Failed to add item');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to add item');
    }
  };

  const handleUpdateItem = async () => {
    if (!selectedItem) return;

    try {
      const response = await storeAPI.updateItem(selectedItem.sku, itemForm);

      if (response.success) {
        toast.success('Item updated successfully');
        setIsEditItemModalOpen(false);
        fetchDashboardData();
      } else {
        throw new Error(response.message || 'Failed to update item');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update item');
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;

    try {
      const response = await storeAPI.deleteItem(selectedItem.sku);

      if (response.success) {
        toast.success('Item deleted successfully');
        setIsDeleteConfirmOpen(false);
        setSelectedItem(null);
        fetchDashboardData();
      } else {
        throw new Error(response.message || 'Failed to delete item');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete item');
    }
  };

  const handleAddStock = async (sku: string, quantity: number) => {
    try {
      const response = await storeAPI.addStock(sku, { quantity, notes: 'Manual stock addition' });

      if (response.success) {
        toast.success('Stock added successfully');
        fetchDashboardData();
      } else {
        throw new Error(response.message || 'Failed to add stock');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to add stock');
    }
  };

  // Filter items
  const filteredItems = masterItems.filter(item => {
    const matchesSearch = !searchTerm ||
      item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const openReviewModal = (request: StockRequest) => {
    setSelectedRequest(request);
    setReviewItems(request.items.map(item => ({
      ...item,
      approved_quantity: item.requested_quantity,
      status: 'APPROVED',
      rejection_reason: ''
    })));
    setIsReviewModalOpen(true);
  };

  const handleApproveRequest = async () => {
    if (!selectedRequest) return;

    try {
      const response = await storeAPI.reviewStockRequest(selectedRequest.id, {
        action: 'APPROVE',
        review_notes: '',
        approved_items: reviewItems.map(item => ({
          id: item.id,
          approved_quantity: item.approved_quantity,
          status: item.status,
          rejection_reason: item.rejection_reason
        }))
      });

      if (response.success) {
        toast.success('Request reviewed successfully');
        setIsReviewModalOpen(false);
        fetchDashboardData();
      } else {
        throw new Error(response.message || 'Failed to review request');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to review request');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-[#F2F2F7]0';
      case 'HIGH': return 'bg-[#F2F2F7]';
      case 'NORMAL': return 'bg-[#F2F2F7]0';
      case 'LOW': return 'bg-[#8E8E93]';
      default: return 'bg-[#8E8E93]';
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

  if (isLoading) {
    return (
      <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER]}>
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgba(60,60,67,0.12)] mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading central warehouse...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                <Warehouse className="h-5 w-5 sm:h-6 sm:w-6 text-stone-600" />
              </div>
              <div>
                <h1 className="text-[22px] sm:text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Central Warehouse</h1>
                <p className="text-stone-500 text-sm mt-0.5">Inventory control & global dispatches</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchDashboardData}
                className="btn-secondary h-10 px-3 flex items-center justify-center shrink-0"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={openAddItemModal}
                className="flex-1 sm:flex-none btn-primary h-10 px-4 flex items-center justify-center gap-2 whitespace-nowrap text-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Add to Catalog</span>
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Requests', value: stats.pendingRequests, icon: ClipboardList, color: 'text-stone-600', bg: 'bg-stone-50' },
              { label: 'In Transit', value: stats.inTransit, icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Low Stock', value: stats.lowStockBranches, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Dispatches', value: stats.weeklyDispatches, icon: Send, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map((stat, i) => (
              <IOSCard key={i} className="p-3 sm:p-4 shadow-sm flex items-center gap-3 sm:gap-4 font-sf-pro">
                <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">{stat.label}</p>
                  <p className="text-lg sm:text-2xl font-bold text-stone-900 leading-none">{stat.value}</p>
                </div>
              </IOSCard>
            ))}
          </div>

          {/* Tabs */}
          <div className="border-b border-stone-100 overflow-x-auto no-scrollbar">
            <nav className="-mb-px flex gap-4 sm:gap-6 min-w-max px-1">
              {[
                { id: 'overview', label: 'Overview', icon: Warehouse },
                { id: 'inventory', label: `Inventory (${masterItems.length})`, icon: Package },
                { id: 'requests', label: `Requests (${pendingRequests.length})`, icon: ClipboardList },
                { id: 'dispatches', label: `Dispatches (${dispatchHistory.length})`, icon: Truck },
                { id: 'transfers', label: `Transfers (${transfers.length})`, icon: ArrowLeftRight },
                { id: 'branches', label: 'Branches', icon: Building2 }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-4 px-1 flex items-center gap-2 text-sm font-bold transition-all border-b-2 ${activeTab === tab.id
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-400 hover:text-stone-600'
                    }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="bg-[#FFFFFF] rounded-xl shadow-none 0_1px_3px_rgba(0,0,0,0.04)] border">

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Pending Requests Preview */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-stone-900 leading-tight">Recent Requests</h3>
                        <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mt-1">Awaiting approval</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('requests')}
                        className="p-2 h-9 w-9 flex items-center justify-center rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-900 hover:text-white transition-all"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {pendingRequests.slice(0, 5).map((request) => (
                        <div key={request.id} className="p-4 bg-stone-50/50 border border-stone-100 rounded-2xl hover:border-stone-200 transition-all group">
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="font-bold text-stone-900 truncate">{request.request_number}</p>
                              <p className="text-[13px] text-stone-500 font-medium truncate">{request.branch.name}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <IOSBadge size="sm" className={`text-[10px] font-bold ${getPriorityColor(request.priority)}`}>
                                {request.priority}
                              </IOSBadge>
                              <button
                                onClick={() => openReviewModal(request)}
                                className="h-8 px-3 bg-stone-900 text-white rounded-lg text-xs font-bold shadow-lg shadow-stone-200 active:scale-95 transition-all"
                              >
                                Review
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {pendingRequests.length === 0 && (
                        <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                          <ClipboardList className="h-10 w-10 mx-auto mb-3 text-stone-300 opacity-50" />
                          <p className="text-[13px] font-bold text-stone-400">No pending requests</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Low Stock Items */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-stone-900 leading-tight">Low Stock Alert</h3>
                        <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mt-1">Items below reorder level</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('inventory')}
                        className="p-2 h-9 w-9 flex items-center justify-center rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-900 hover:text-white transition-all"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {masterItems
                        .filter(item => (item.quantity || 0) <= (item.reorder_level || 10))
                        .slice(0, 5)
                        .map((item) => (
                          <div key={item.sku} className="p-4 bg-red-50/30 border border-red-100 rounded-2xl group">
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <p className="font-bold text-stone-900 truncate">{item.item_name || item.description}</p>
                                <code className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{item.sku}</code>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="flex items-baseline justify-end gap-1">
                                  <span className="text-lg font-bold text-red-600">{item.quantity || 0}</span>
                                  <span className="text-[10px] font-bold text-red-400 uppercase">{item.unit_of_measure}</span>
                                </div>
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Lvl: {item.reorder_level || 10}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      {masterItems.filter(item => (item.quantity || 0) <= (item.reorder_level || 10)).length === 0 && (
                        <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                          <PackageCheck className="h-10 w-10 mx-auto mb-3 text-stone-300 opacity-50" />
                          <p className="text-[13px] font-bold text-stone-400">All stock levels are healthy</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Inventory Tab */}
            {activeTab === 'inventory' && (
              <div className="p-6">
                {/* Search and Filter */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <input
                      placeholder="Search catalog..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-11 pl-9 pr-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="flex-1 sm:w-48 h-11 px-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 text-sm font-bold text-stone-700"
                    >
                      <option value="">All Categories</option>
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button
                      onClick={openAddItemModal}
                      className="btn-secondary h-11 px-4 flex items-center justify-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="text-sm font-bold">Add Item</span>
                    </button>
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto no-scrollbar -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full border-collapse min-w-[800px]">
                    <thead>
                      <tr className="border-b border-stone-100 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Item Details</th>
                        <th className="px-4 py-3 text-left">SKU</th>
                        <th className="px-4 py-3 text-left">Category</th>
                        <th className="px-4 py-3 text-center">Stock Level</th>
                        <th className="px-4 py-3 text-right">Unit Price</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {filteredItems.map((item) => {
                        const isLowStock = (item.quantity || 0) <= (item.reorder_level || 10);
                        return (
                          <tr key={item.sku} className="group hover:bg-stone-50/50 transition-colors">
                            <td className="px-4 py-4">
                              <p className="text-[13px] font-bold text-stone-900 leading-tight">{item.item_name}</p>
                              <p className="text-[11px] text-stone-400 mt-0.5 font-medium line-clamp-1">{item.description || '-'}</p>
                            </td>
                            <td className="px-4 py-4">
                              <code className="text-[11px] font-bold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-md">{item.sku}</code>
                            </td>
                            <td className="px-4 py-4">
                              <IOSBadge size="sm" color="secondary" className="bg-stone-50 border-stone-200 text-stone-600 text-[10px]">{item.category}</IOSBadge>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className={`inline-flex flex-col items-center ${isLowStock ? 'text-red-600' : 'text-stone-900'}`}>
                                <span className="text-[14px] font-bold">{item.quantity || 0}</span>
                                <span className="text-[10px] font-bold opacity-50 uppercase">{item.unit_of_measure}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <p className="text-[13px] font-bold text-stone-900">KES {(item.retail_price || 0).toLocaleString()}</p>
                              <p className="text-[10px] text-stone-400 font-bold">Cost: {(item.cost_price || 0).toLocaleString()}</p>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openEditItemModal(item)}
                                  className="p-2 h-9 w-9 flex items-center justify-center rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-900 hover:text-white transition-all"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => openDeleteConfirm(item)}
                                  className="p-2 h-9 w-9 flex items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
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
              </div>
            )}

            {/* Requests Tab */}
            {activeTab === 'requests' && (
              <div className="p-4 sm:p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-stone-900">Branch Stock Requests</h3>
                  <p className="text-sm text-stone-500">Review and verify stock replenishment orders</p>
                </div>

                <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b border-stone-100 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Request Info</th>
                        <th className="px-4 py-3 text-left">Branch</th>
                        <th className="px-4 py-3 text-left">Priority</th>
                        <th className="px-4 py-3 text-center">Items</th>
                        <th className="px-4 py-3 text-left">Requested On</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {pendingRequests.map((request) => (
                        <tr key={request.id} className="group hover:bg-stone-50/50 transition-colors">
                          <td className="px-4 py-4">
                            <p className="text-[13px] font-bold text-stone-900">{request.request_number}</p>
                            <p className="text-[10px] text-stone-400 font-bold uppercase">{request.request_type}</p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-[13px] font-bold text-stone-900">{request.branch.name}</p>
                            <p className="text-[11px] text-stone-400">{request.branch.location}</p>
                          </td>
                          <td className="px-4 py-4">
                            <IOSBadge size="sm" className={`text-[10px] font-bold ${getPriorityColor(request.priority)}`}>
                              {request.priority}
                            </IOSBadge>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="text-[13px] font-bold text-stone-600 bg-stone-100 px-2 py-1 rounded-lg">
                              {request.items.length}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-[12px] font-medium text-stone-500">{formatDate(request.created_at)}</p>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              {(request.status === 'APPROVED' || request.status === 'PARTIALLY_APPROVED') ? (
                                <button
                                  onClick={() => openCreateDispatchModal(request)}
                                  className="h-9 px-4 bg-stone-900 text-white rounded-xl text-xs font-bold shadow-lg shadow-stone-200 flex items-center gap-2"
                                >
                                  <Truck className="h-3.5 w-3.5" />
                                  <span>Dispatch</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => openReviewModal(request)}
                                  className="h-9 px-4 bg-stone-100 text-stone-600 hover:bg-stone-900 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                                >
                                  <Eye className="h-4 w-4" />
                                  <span>Review</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pendingRequests.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No pending requests</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dispatches Tab */}
            {activeTab === 'dispatches' && (
              <div className="p-4 sm:p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-stone-900">Dispatch Records</h3>
                  <p className="text-sm text-stone-500">Monitoring outbound stock shipments</p>
                </div>
                <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full border-collapse min-w-[800px]">
                    <thead>
                      <tr className="border-b border-stone-100 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Dispatch #</th>
                        <th className="px-4 py-3 text-left">Destination</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-center">Items</th>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Vehicle Details</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50 text-[13px]">
                      {dispatchHistory.map((dispatch) => (
                        <tr key={dispatch.id} className="group hover:bg-stone-50/50 transition-colors">
                          <td className="px-4 py-4 font-bold text-stone-900">{dispatch.dispatch_number}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2 font-medium">
                              <Building2 className="h-3.5 w-3.5 text-stone-400" />
                              <span>{dispatch.to_branch?.name || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <IOSBadge size="sm" className={`text-[10px] font-bold ${getStatusColor(dispatch.status)}`}>
                              {dispatch.status}
                            </IOSBadge>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-stone-100 rounded-lg text-stone-600">
                              <Package className="h-3.5 w-3.5 opacity-50" />
                              <span className="font-bold">{dispatch.items_count || dispatch.items?.length || 0}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 font-medium text-stone-500">
                            {formatDate(dispatch.created_at)}
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-bold text-stone-700">{dispatch.vehicle_number || '-'}</p>
                            <p className="text-[11px] text-stone-400 font-medium">{dispatch.driver_name || 'No driver assigned'}</p>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end">
                              {dispatch.status === 'PENDING' && (
                                <button
                                  onClick={() => handleDispatchItem(dispatch.id)}
                                  disabled={dispatchLoading[dispatch.id]}
                                  className="h-8 px-4 bg-stone-900 text-white rounded-lg text-xs font-bold shadow-lg shadow-stone-200 flex items-center gap-2 whitespace-nowrap active:scale-95 transition-all"
                                >
                                  {dispatchLoading[dispatch.id] ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                                  <span>{dispatchLoading[dispatch.id] ? 'Dispatching...' : 'Dispatch'}</span>
                                </button>
                              )}
                              {dispatch.status === 'IN_TRANSIT' && (
                                <IOSBadge size="sm" className="bg-blue-50 text-blue-600 border-blue-100 text-[10px] uppercase font-bold">Transit</IOSBadge>
                              )}
                              {dispatch.status === 'DELIVERED' && (
                                <IOSBadge size="sm" className="bg-stone-900 text-white text-[10px] uppercase font-bold flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" /> Delivered
                                </IOSBadge>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {dispatchHistory.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No dispatch history found</p>
                      <p className="text-sm mt-2">Go to Stock Requests tab and dispatch approved requests</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Transfers Tab */}
            {activeTab === 'transfers' && (
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-stone-900">Branch Transfers</h3>
                    <p className="text-sm text-stone-500">Inter-branch inventory movement logs</p>
                  </div>
                  <button
                    onClick={openCreateTransferModal}
                    className="btn-primary h-11 px-5 flex items-center justify-center gap-2 text-sm"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    <span>New Transfer</span>
                  </button>
                </div>
                <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full border-collapse min-w-[800px]">
                    <thead>
                      <tr className="border-b border-stone-100 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Transfer #</th>
                        <th className="px-4 py-3 text-left">Source / From</th>
                        <th className="px-4 py-3 text-left">Destination / To</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-center">Items</th>
                        <th className="px-4 py-3 text-right">Date Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50 text-[13px]">
                      {transfers.map((transfer) => (
                        <tr key={transfer.id} className="group hover:bg-stone-50/50 transition-colors">
                          <td className="px-4 py-4 font-bold text-stone-900">{transfer.transfer_number || transfer.id}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2 font-medium text-stone-600">
                              <MapPin className="h-3.5 w-3.5 opacity-40" />
                              <span>{transfer.from_branch?.name || 'Central'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2 font-bold text-stone-900">
                              <ArrowRight className="h-3.5 w-3.5 text-stone-300" />
                              <span>{transfer.to_branch?.name || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <IOSBadge size="sm" className={`text-[10px] font-bold ${getStatusColor(transfer.status)}`}>
                              {transfer.status}
                            </IOSBadge>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-stone-100 rounded-lg font-bold text-stone-600">
                              <Package className="h-3.5 w-3.5 opacity-50" />
                              {transfer.items?.length || 0}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right font-medium text-stone-500">
                            {formatDate(transfer.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {transfers.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <ArrowLeftRight className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No transfers found</p>
                      <p className="text-sm mt-2">Click "New Transfer" to create a branch-to-branch transfer</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create Dispatch Modal */}
        <Dialog open={isCreateDispatchOpen} onOpenChange={setIsCreateDispatchOpen}>
          <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-2xl sm:rounded-3xl shadow-2xl">
            <div className="bg-stone-900 p-6 text-white relative">
              <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                <Truck className="h-6 w-6 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold">New Dispatch Note</DialogTitle>
              <p className="text-white/60 text-sm mt-1">Generate shipping documents for stock movement</p>
              <button
                onClick={() => setIsCreateDispatchOpen(false)}
                className="absolute top-6 right-6 h-8 w-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-8 w-8 bg-white border border-stone-200 rounded-lg flex items-center justify-center">
                    <ClipboardList className="h-4 w-4 text-stone-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Source Request</p>
                    <p className="text-[13px] font-bold text-stone-900">{selectedRequest?.request_number}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white border border-stone-200 rounded-lg flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-stone-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Destination</p>
                    <p className="text-[13px] font-bold text-stone-900">{selectedRequest?.branch.name}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Vehicle License Plate</p>
                  <input
                    value={dispatchForm.vehicle_number}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, vehicle_number: e.target.value })}
                    placeholder="e.g. KAA 123B"
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Driver's Full Name</p>
                  <input
                    value={dispatchForm.driver_name}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, driver_name: e.target.value })}
                    placeholder="Enter name"
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Driver's Contact</p>
                  <input
                    value={dispatchForm.driver_phone}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, driver_phone: e.target.value })}
                    placeholder="07..."
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Est. Delivery Time</p>
                  <input
                    type="datetime-local"
                    value={dispatchForm.estimated_delivery}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, estimated_delivery: e.target.value })}
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Special Instructions / Notes</p>
                <textarea
                  value={dispatchForm.notes}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, notes: e.target.value })}
                  placeholder="Any additional details for the storekeeper..."
                  className="w-full h-24 p-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsCreateDispatchOpen(false)}
                  className="flex-1 h-12 text-sm font-bold text-stone-400 hover:text-stone-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDispatch}
                  className="flex-[2] h-12 bg-stone-900 text-white rounded-xl text-sm font-bold shadow-xl shadow-stone-200 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Send className="h-4 w-4" />
                  <span>Create Dispatch</span>
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
          <DialogContent className="max-w-2xl p-0 overflow-hidden border-none rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-stone-900 p-6 text-white relative flex-shrink-0">
              <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                <ClipboardList className="h-6 w-6 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold">Review Stock Request</DialogTitle>
              <p className="text-white/60 text-sm mt-1">Verify and approve requested quantities</p>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="absolute top-6 right-6 h-8 w-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar space-y-6">
              {selectedRequest && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Request #</p>
                      <p className="text-[13px] font-bold text-stone-900">{selectedRequest.request_number}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Branch</p>
                      <p className="text-[13px] font-bold text-stone-900">{selectedRequest.branch.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Priority</p>
                      <IOSBadge size="sm" className={`text-[10px] font-bold ${getPriorityColor(selectedRequest.priority)}`}>
                        {selectedRequest.priority}
                      </IOSBadge>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Type</p>
                      <p className="text-[13px] font-bold text-stone-900 uppercase">{selectedRequest.request_type}</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                    <table className="w-full border-collapse min-w-[500px]">
                      <thead>
                        <tr className="border-b border-stone-100 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                          <th className="px-3 py-2 text-left">Item Info</th>
                          <th className="px-3 py-2 text-center">Qty</th>
                          <th className="px-3 py-2 text-center">Approve</th>
                          <th className="px-3 py-2 text-left">Verdict</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50">
                        {reviewItems.map((item, index) => (
                          <tr key={item.id} className="group">
                            <td className="px-3 py-3">
                              <p className="text-[13px] font-bold text-stone-900 leading-tight">{item.item?.item_name}</p>
                              <code className="text-[10px] font-bold text-stone-400">{item.item_sku}</code>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="text-[14px] font-bold text-stone-900">{item.requested_quantity}</span>
                            </td>
                            <td className="px-3 py-3">
                              <input
                                type="number"
                                min="0"
                                max={item.requested_quantity}
                                value={item.approved_quantity}
                                onChange={(e) => {
                                  const newItems = [...reviewItems];
                                  newItems[index].approved_quantity = parseInt(e.target.value) || 0;
                                  setReviewItems(newItems);
                                }}
                                className="w-16 h-9 text-center text-sm font-bold bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <select
                                value={item.status}
                                onChange={(e) => {
                                  const newItems = [...reviewItems];
                                  newItems[index].status = e.target.value;
                                  setReviewItems(newItems);
                                }}
                                className="h-9 px-2 text-[11px] font-bold bg-white border border-stone-200 rounded-lg outline-none"
                              >
                                <option value="APPROVED">Approve</option>
                                <option value="REJECTED">Reject</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 bg-stone-50 border-t border-stone-100 flex gap-3">
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="flex-1 h-12 text-sm font-bold text-stone-400 hover:text-stone-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveRequest}
                className="flex-[2] h-12 bg-stone-900 text-white rounded-xl text-sm font-bold shadow-xl shadow-stone-200 flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Submit Review</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Item Modal */}
        <Dialog open={isAddItemModalOpen} onOpenChange={setIsAddItemModalOpen}>
          <DialogContent className="max-w-2xl p-0 overflow-hidden border-none rounded-2xl sm:rounded-3xl shadow-2xl">
            <div className="bg-stone-900 p-6 text-white relative">
              <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                <Plus className="h-6 w-6 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold">Add New Master Item</DialogTitle>
              <p className="text-white/60 text-sm mt-1">Register a new product in the central catalog</p>
              <button
                onClick={() => setIsAddItemModalOpen(false)}
                className="absolute top-6 right-6 h-8 w-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Item Name</p>
                  <input
                    value={newItem.item_name}
                    onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                    placeholder="e.g. White Sugar"
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">SKU Code</p>
                  <input
                    value={newItem.sku}
                    onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                    placeholder="e.g. SUG-001"
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Category</p>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full h-11 px-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 text-sm font-bold text-stone-700"
                  >
                    <option value="">Select Category</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Unit of Measure</p>
                  <input
                    value={newItem.unit_of_measure}
                    onChange={(e) => setNewItem({ ...newItem, unit_of_measure: e.target.value })}
                    placeholder="e.g. KG, Ltr, Pcs"
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Initial Qty</p>
                  <input
                    type="number"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Reorder Lvl</p>
                  <input
                    type="number"
                    value={newItem.reorder_level}
                    onChange={(e) => setNewItem({ ...newItem, reorder_level: parseInt(e.target.value) || 0 })}
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Cost Price</p>
                  <input
                    type="number"
                    value={newItem.cost_price}
                    onChange={(e) => setNewItem({ ...newItem, cost_price: parseFloat(e.target.value) || 0 })}
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Retail Price</p>
                  <input
                    type="number"
                    value={newItem.retail_price}
                    onChange={(e) => setNewItem({ ...newItem, retail_price: parseFloat(e.target.value) || 0 })}
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Description</p>
                <textarea
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Optional item details..."
                  className="w-full h-20 p-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium resize-none"
                />
              </div>
            </div>

            <div className="p-6 bg-stone-50 border-t border-stone-100 flex gap-3">
              <button
                onClick={() => setIsAddItemModalOpen(false)}
                className="flex-1 h-12 text-sm font-bold text-stone-400 hover:text-stone-600 transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={isSaving}
                className="flex-[2] h-12 bg-stone-900 text-white rounded-xl text-sm font-bold shadow-xl shadow-stone-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 transition-all"
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>{isSaving ? 'Registering...' : 'Register Item'}</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Item Modal */}
        <Dialog open={isEditItemModalOpen} onOpenChange={setIsEditItemModalOpen}>
          <DialogContent className="max-w-2xl p-0 overflow-hidden border-none rounded-2xl sm:rounded-3xl shadow-2xl">
            <div className="bg-stone-900 p-6 text-white relative">
              <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                <Edit className="h-6 w-6 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold">Edit Master Item</DialogTitle>
              <p className="text-white/60 text-sm mt-1">Update details for this product in the central catalog</p>
              <button
                onClick={() => setIsEditItemModalOpen(false)}
                className="absolute top-6 right-6 h-8 w-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
              {/* SKU and Barcode Info */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">SKU</p>
                    <p className="text-[13px] font-bold text-stone-900">{itemForm.sku}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Barcode</p>
                    <p className="text-[13px] font-bold text-stone-900">{itemForm.barcode || 'Not set'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Item Name</p>
                  <input
                    value={itemForm.item_name}
                    onChange={(e) => setItemForm({ ...itemForm, item_name: e.target.value })}
                    placeholder="e.g. White Sugar"
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Barcode</p>
                  <input
                    value={itemForm.barcode || ''}
                    onChange={(e) => setItemForm({ ...itemForm, barcode: e.target.value })}
                    placeholder="Scan or enter barcode"
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Category</p>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full h-11 px-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 text-sm font-bold text-stone-700"
                  >
                    <option value="">Select Category</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Unit of Measure</p>
                  <input
                    value={itemForm.unit_of_measure}
                    onChange={(e) => setItemForm({ ...itemForm, unit_of_measure: e.target.value })}
                    placeholder="e.g. KG, Ltr, Pcs"
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Central Stock</p>
                  <input
                    type="number"
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Reorder Lvl</p>
                  <input
                    type="number"
                    value={itemForm.reorder_level}
                    onChange={(e) => setItemForm({ ...itemForm, reorder_level: parseInt(e.target.value) || 0 })}
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Cost Price</p>
                  <input
                    type="number"
                    value={itemForm.cost_price}
                    onChange={(e) => setItemForm({ ...itemForm, cost_price: parseFloat(e.target.value) || 0 })}
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Retail Price</p>
                  <input
                    type="number"
                    value={itemForm.retail_price}
                    onChange={(e) => setItemForm({ ...itemForm, retail_price: parseFloat(e.target.value) || 0 })}
                    className="w-full h-11 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Description</p>
                <textarea
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  placeholder="Optional item details..."
                  className="w-full h-20 p-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium resize-none"
                />
              </div>
            </div>

            <div className="p-6 bg-stone-50 border-t border-stone-100 flex gap-3">
              <button
                onClick={() => setIsEditItemModalOpen(false)}
                className="flex-1 h-12 text-sm font-bold text-stone-400 hover:text-stone-600 transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateItem}
                disabled={isSaving}
                className="flex-[2] h-12 bg-stone-900 text-white rounded-xl text-sm font-bold shadow-xl shadow-stone-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 transition-all"
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>{isSaving ? 'Updating...' : 'Update Item'}</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <DialogContent className="max-w-sm p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
            <div className="p-8 text-center">
              <div className="h-16 w-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <DialogTitle className="text-xl font-bold text-stone-900">Confirm Deletion</DialogTitle>
              <p className="text-stone-500 text-sm mt-3 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-stone-900">{selectedItem?.item_name}</span>? This action is permanent.
              </p>

              <div className="mt-8 space-y-3">
                <button
                  onClick={handleDeleteItem}
                  className="w-full h-12 bg-red-600 text-white rounded-xl text-sm font-bold shadow-xl shadow-red-200 active:scale-95 transition-all"
                >
                  Delete Item Forever
                </button>
                <button
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="w-full h-12 text-sm font-bold text-stone-400 hover:text-stone-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isCreateTransferOpen} onOpenChange={setIsCreateTransferOpen}>
          <DialogContent className="max-w-2xl p-0 overflow-hidden border-none rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-stone-900 p-6 text-white relative flex-shrink-0">
              <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                <ArrowLeftRight className="h-6 w-6 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold">New Branch Transfer</DialogTitle>
              <p className="text-white/60 text-sm mt-1">Move inventory directly between branch locations</p>
              <button
                onClick={() => setIsCreateTransferOpen(false)}
                className="absolute top-6 right-6 h-8 w-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Source Branch</p>
                  <select
                    value={transferForm.from_branch_id}
                    onChange={(e) => setTransferForm({ ...transferForm, from_branch_id: parseInt(e.target.value) })}
                    className="w-full h-11 px-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 text-sm font-bold text-stone-700"
                  >
                    <option value={0}>Select source...</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} {b.is_central_warehouse ? '(Central)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Destination Branch</p>
                  <select
                    value={transferForm.to_branch_id}
                    onChange={(e) => setTransferForm({ ...transferForm, to_branch_id: parseInt(e.target.value) })}
                    className="w-full h-11 px-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 text-sm font-bold text-stone-700"
                  >
                    <option value={0}>Select destination...</option>
                    {branches.filter(b => b.id !== transferForm.from_branch_id).map(b => (
                      <option key={b.id} value={b.id}>{b.name} {b.is_central_warehouse ? '(Central)' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Items to Transfer</h4>
                  <button
                    onClick={addTransferItem}
                    className="h-8 px-3 bg-stone-100 text-stone-600 hover:bg-stone-900 hover:text-white rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {transferItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center p-3 bg-stone-50 rounded-2xl border border-stone-100 group">
                      <select
                        value={item.item_sku}
                        onChange={(e) => updateTransferItem(index, 'item_sku', e.target.value)}
                        className="flex-1 h-10 px-2 bg-white border border-stone-200 rounded-lg outline-none text-[13px] font-medium"
                      >
                        <option value="">Select item...</option>
                        {masterItems.map(mi => (
                          <option key={mi.sku} value={mi.sku}>{mi.item_name} ({mi.sku})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateTransferItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-20 h-10 px-2 bg-white border border-stone-200 rounded-lg outline-none text-center text-[13px] font-bold"
                        placeholder="Qty"
                      />
                      {transferItems.length > 1 && (
                        <button
                          onClick={() => removeTransferItem(index)}
                          className="h-8 w-8 flex items-center justify-center text-stone-400 hover:text-red-600 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Transfer Notes</p>
                <textarea
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  placeholder="Reasons for transfer or special instructions..."
                  className="w-full h-24 p-4 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium resize-none"
                />
              </div>
            </div>

            <div className="p-6 bg-stone-50 border-t border-stone-100 flex gap-3 flex-shrink-0">
              <button
                onClick={() => setIsCreateTransferOpen(false)}
                className="flex-1 h-12 text-sm font-bold text-stone-400 hover:text-stone-600 transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTransfer}
                disabled={isSaving}
                className="flex-[2] h-12 bg-stone-900 text-white rounded-xl text-sm font-bold shadow-xl shadow-stone-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 transition-all"
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span>{isSaving ? 'Processing...' : 'Execute Transfer'}</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
