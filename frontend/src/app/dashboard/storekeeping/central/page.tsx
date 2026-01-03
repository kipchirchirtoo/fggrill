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
  const [dispatchLoading, setDispatchLoading] = useState<{[key: string]: boolean}>({});
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
    items: [] as {item_sku: string; quantity: number}[],
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
        () => {}
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
        notes: '',
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
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Warehouse className="h-8 w-8 text-[#3C3C43]" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Central Warehouse</h1>
                  <p className="text-gray-600">Manage inventory dispatch to all branches</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <IOSButton variant="outline" onClick={fetchDashboardData} leftIcon={<RefreshCw />}>Refresh
              </IOSButton>
              <IOSButton className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={openAddItemModal} leftIcon={<Plus />}>Add to Master Catalog
              </IOSButton>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                  <p className="text-sm font-medium text-[#000000]">In Transit</p>
                  <p className="text-3xl font-bold text-[#000000]">{stats.inTransit}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-6 bg-[#F2F2F7] border-[rgba(60,60,67,0.12)]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#F2F2F7] rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#3C3C43]">Low Stock Branches</p>
                  <p className="text-3xl font-bold text-[#3C3C43]">{stats.lowStockBranches}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-6 bg-[#F2F2F7] border-[rgba(60,60,67,0.12)]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#F2F2F7]0 rounded-xl">
                  <Send className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#000000]">Weekly Dispatches</p>
                  <p className="text-3xl font-bold text-[#000000]">{stats.weeklyDispatches}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Tabs */}
          <div className="border-b border-[#E5E5EA]">
            <nav className="-mb-px flex gap-6">
              {[
                { id: 'overview', label: 'Overview', icon: Warehouse },
                { id: 'inventory', label: `Inventory (${masterItems.length})`, icon: Package },
                { id: 'requests', label: `Stock Requests (${pendingRequests.length})`, icon: ClipboardList },
                { id: 'dispatches', label: `Dispatches (${dispatchHistory.length})`, icon: Truck },
                { id: 'transfers', label: `Transfers (${transfers.length})`, icon: ArrowLeftRight },
                { id: 'branches', label: 'All Branches', icon: Building2 }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-4 px-1 flex items-center gap-2 ${
                    activeTab === tab.id
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
            
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pending Requests Preview */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold font-sf-pro-display text-gray-900">Recent Requests</h3>
                      <IOSButton variant="ghost" size="sm" onClick={() => setActiveTab('requests')}>
                        View All <ChevronRight className="h-4 w-4 ml-1" />
                      </IOSButton>
                    </div>
                    <div className="space-y-3">
                      {pendingRequests.slice(0, 5).map((request) => (
                        <div key={request.id} className="p-4 border rounded-ios-lg hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{request.request_number}</p>
                              <p className="text-sm text-gray-500">{request.branch.name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <IOSBadge className={getPriorityColor(request.priority)}>
                                {request.priority}
                              </IOSBadge>
                              <IOSButton size="sm" onClick={() => openReviewModal(request)}>
                                Review
                              </IOSButton>
                            </div>
                          </div>
                        </div>
                      ))}
                      {pendingRequests.length === 0 && (
                        <p className="text-gray-500 text-center py-8">No pending requests</p>
                      )}
                    </div>
                  </div>

                  {/* Low Stock Items */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold font-sf-pro-display text-gray-900">Low Stock Items</h3>
                    </div>
                    <div className="space-y-3">
                      {masterItems
                        .filter(item => (item.quantity || 0) <= (item.reorder_level || 10))
                        .slice(0, 5)
                        .map((item) => (
                          <div key={item.sku} className="p-4 border rounded-ios-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{item.item_name || item.description}</p>
                                <p className="text-sm text-gray-500 font-mono">{item.sku}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-[#3C3C43]">{item.quantity || 0}</p>
                                <p className="text-xs text-gray-500">Reorder: {item.reorder_level || 10}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Inventory Tab */}
            {activeTab === 'inventory' && (
              <div className="p-6">
                {/* Search and Filter */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                    <Input
                      placeholder="Search items by name, SKU, or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-4 py-2 border rounded-ios-lg text-sm"
                  >
                    <option value="">All Categories</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <IOSButton onClick={openAddItemModal} leftIcon={<Plus />}>Add Item
                  </IOSButton>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reorder</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredItems.map((item) => (
                        <tr key={item.sku} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div>
                              <p className="font-medium">{item.item_name}</p>
                              <p className="text-xs text-gray-500">{item.description || '-'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 font-mono text-sm">{item.sku}</td>
                          <td className="px-4 py-4">
                            <IOSBadge variant="light" color="secondary">{item.category}</IOSBadge>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`font-bold ${
                              (item.quantity || 0) <= (item.reorder_level || 10) ? 'text-[#3C3C43]' : 'text-[#3C3C43]'
                            }`}>
                              {item.quantity || 0}
                            </span>
                            <span className="text-gray-400 text-sm ml-1">{item.unit_of_measure}</span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500">{item.reorder_level || 10}</td>
                          <td className="px-4 py-4">
                            <div className="text-sm">
                              <p>KES {(item.retail_price || 0).toLocaleString()}</p>
                              <p className="text-xs text-gray-400">Cost: KES {(item.cost_price || 0).toLocaleString()}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <IOSButton size="sm" variant="outline" onClick={() => openEditItemModal(item)}>
                                <Edit className="h-4 w-4" />
                              </IOSButton>
                              <IOSButton size="sm" variant="outline" className="text-[#3C3C43] hover:bg-[#F2F2F7]" onClick={() => openDeleteConfirm(item)}>
                                <Trash2 className="h-4 w-4" />
                              </IOSButton>
                            </div>
                          </td>
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
              </div>
            )}

            {/* Requests Tab */}
            {activeTab === 'requests' && (
              <div className="p-6">
                <div className="mb-4">
                  <h3 className="font-semibold font-sf-pro-display text-gray-900">Pending Stock Requests</h3>
                  <p className="text-sm text-gray-500">Review and approve requests from branches</p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pendingRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 font-mono text-sm">{request.request_number}</td>
                          <td className="px-4 py-4">
                            <div>
                              <p className="font-medium">{request.branch.name}</p>
                              <p className="text-xs text-gray-500">{request.branch.location}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4">{request.request_type}</td>
                          <td className="px-4 py-4">
                            <IOSBadge className={getPriorityColor(request.priority)}>{request.priority}</IOSBadge>
                          </td>
                          <td className="px-4 py-4">{request.items.length} items</td>
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {formatDate(request.created_at)}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex gap-2">
                              {(request.status === 'APPROVED' || request.status === 'PARTIALLY_APPROVED') ? (
                                <IOSButton size="sm" className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={() => openCreateDispatchModal(request)} leftIcon={<Truck />}>
                                  Dispatch
                                </IOSButton>
                              ) : (
                                <IOSButton size="sm" onClick={() => openReviewModal(request)} leftIcon={<Eye />}>
                                  Review
                                </IOSButton>
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
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold font-sf-pro-display text-gray-900">Dispatch Notes</h3>
                  <p className="text-sm text-gray-500">Dispatches are created from approved stock requests</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dispatch #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {dispatchHistory.map((dispatch) => (
                        <tr key={dispatch.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 font-mono text-sm">{dispatch.dispatch_number}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-gray-400" />
                              <span>{dispatch.to_branch?.name || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <IOSBadge className={getStatusColor(dispatch.status)}>
                              {dispatch.status}
                            </IOSBadge>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1">
                              <Package className="h-4 w-4 text-gray-400" />
                              <span>{dispatch.items_count || dispatch.items?.length || 0}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {formatDate(dispatch.created_at)}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {dispatch.vehicle_number || '-'}
                          </td>
                          <td className="px-4 py-4">
                            {dispatch.status === 'PENDING' && (
                              <IOSButton 
                                size="sm" 
                                className="bg-[#3C3C43] hover:bg-[#3C3C43]" 
                                onClick={() => handleDispatchItem(dispatch.id)} 
                                leftIcon={<Send />}
                                disabled={dispatchLoading[dispatch.id]}
                              >
                                {dispatchLoading[dispatch.id] ? 'Sending...' : 'Send'}
                              </IOSButton>
                            )}
                            {dispatch.status === 'IN_TRANSIT' && (
                              <IOSBadge className="bg-[#F2F2F7]">In Transit</IOSBadge>
                            )}
                            {dispatch.status === 'DELIVERED' && (
                              <IOSBadge className="bg-[#3C3C43]"><CheckCircle className="h-3 w-3 mr-1" /> Delivered</IOSBadge>
                            )}
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
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold font-sf-pro-display text-gray-900">Branch-to-Branch Transfers</h3>
                  <IOSButton className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={openCreateTransferModal} leftIcon={<Plus />}>New Transfer
                  </IOSButton>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transfer #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {transfers.map((transfer) => (
                        <tr key={transfer.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 font-mono text-sm">{transfer.transfer_number || transfer.id}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-gray-400" />
                              <span>{transfer.from_branch?.name || 'Central'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <ArrowRight className="h-4 w-4 text-[#3C3C43]" />
                              <span>{transfer.to_branch?.name || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <IOSBadge className={getStatusColor(transfer.status)}>
                              {transfer.status}
                            </IOSBadge>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1">
                              <Package className="h-4 w-4 text-gray-400" />
                              <span>{transfer.items?.length || 0}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500">
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Create Dispatch Note
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="bg-[#F2F2F7] p-4 rounded-ios-lg">
                <p className="text-sm text-[#000000] mb-2">Dispatching for Request: <strong>{selectedRequest?.request_number}</strong></p>
                <p className="text-sm text-[#000000]">To: <strong>{selectedRequest?.branch.name}</strong></p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Vehicle Number</label>
                  <Input 
                    value={dispatchForm.vehicle_number}
                    onChange={(e) => setDispatchForm({...dispatchForm, vehicle_number: e.target.value})}
                    placeholder="KAA 123B"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Driver Name</label>
                  <Input 
                    value={dispatchForm.driver_name}
                    onChange={(e) => setDispatchForm({...dispatchForm, driver_name: e.target.value})}
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Driver Phone</label>
                  <Input 
                    value={dispatchForm.driver_phone}
                    onChange={(e) => setDispatchForm({...dispatchForm, driver_phone: e.target.value})}
                    placeholder="07..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Est. Delivery</label>
                  <Input 
                    type="datetime-local"
                    value={dispatchForm.estimated_delivery}
                    onChange={(e) => setDispatchForm({...dispatchForm, estimated_delivery: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Notes</label>
                <Input 
                  value={dispatchForm.notes}
                  onChange={(e) => setDispatchForm({...dispatchForm, notes: e.target.value})}
                  placeholder="Delivery instructions..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <IOSButton variant="outline" onClick={() => setIsCreateDispatchOpen(false)}>
                  Cancel
                </IOSButton>
                <IOSButton className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={handleCreateDispatch} leftIcon={<Send />}>Create Dispatch
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Review Request Modal */}
        <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Review Stock Request
              </DialogTitle>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-6">
                {/* Request Info */}
                <div className="bg-gray-50 p-4 rounded-ios-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Request Number</p>
                      <p className="font-mono font-medium">{selectedRequest.request_number}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Branch</p>
                      <p className="font-medium">{selectedRequest.branch.name}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Priority</p>
                      <IOSBadge className={getPriorityColor(selectedRequest.priority)}>
                        {selectedRequest.priority}
                      </IOSBadge>
                    </div>
                    <div>
                      <p className="text-gray-500">Type</p>
                      <p className="font-medium">{selectedRequest.request_type}</p>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <h4 className="font-medium mb-3">Items</h4>
                  <div className="border rounded-ios-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Item</th>
                          <th className="px-4 py-2 text-center">Requested</th>
                          <th className="px-4 py-2 text-center">Approved</th>
                          <th className="px-4 py-2 text-center">Status</th>
                          <th className="px-4 py-2 text-left">Reason (if rejected)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {reviewItems.map((item, index) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <p className="font-medium">{item.item?.item_name}</p>
                              <p className="text-xs text-gray-500">{item.item_sku}</p>
                            </td>
                            <td className="px-4 py-3 text-center font-medium">
                              {item.requested_quantity}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Input 
                                type="number"
                                min="0"
                                max={item.requested_quantity}
                                value={item.approved_quantity}
                                onChange={(e) => {
                                  const newItems = [...reviewItems];
                                  newItems[index].approved_quantity = parseInt(e.target.value) || 0;
                                  setReviewItems(newItems);
                                }}
                                className="w-20 mx-auto h-8"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <select
                                value={item.status}
                                onChange={(e) => {
                                  const newItems = [...reviewItems];
                                  newItems[index].status = e.target.value;
                                  setReviewItems(newItems);
                                }}
                                className="border rounded px-2 py-1 text-xs"
                              >
                                <option value="APPROVED">Approve</option>
                                <option value="REJECTED">Reject</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              {item.status === 'REJECTED' && (
                                <Input 
                                  value={item.rejection_reason || ''}
                                  onChange={(e) => {
                                    const newItems = [...reviewItems];
                                    newItems[index].rejection_reason = e.target.value;
                                    setReviewItems(newItems);
                                  }}
                                  placeholder="Reason..."
                                  className="h-8"
                                />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <IOSButton variant="outline" onClick={() => setIsReviewModalOpen(false)}>
                    Cancel
                  </IOSButton>
                  <IOSButton className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={handleApproveRequest} leftIcon={<Check />}>Submit Review
                  </IOSButton>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Item Modal */}
        <Dialog open={isAddItemModalOpen} onOpenChange={(open) => { if (!open) stopCameraScanner(); setIsAddItemModalOpen(open); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Scan className="h-5 w-5 text-[#3C3C43]" />
                Add Master Item
              </DialogTitle>
            </DialogHeader>

            {/* Camera Scanner Overlay */}
            {isScannerActive && (
              <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
                <div className="bg-[#FFFFFF] rounded-2xl p-6 w-full max-w-lg relative">
                  <IOSButton 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-3 top-3 z-10 bg-[#FFFFFF]/80 hover:bg-[#FFFFFF]"
                    onClick={stopCameraScanner}
                  >
                    <X className="h-6 w-6" />
                  </IOSButton>
                  
                  <div className="text-center mb-4">
                    <Camera className="h-8 w-8 mx-auto mb-2 text-[#3C3C43]" />
                    <h3 className="text-lg font-semibold font-sf-pro-display">Scan Barcode</h3>
                    <p className="text-sm text-gray-500">Point camera at product barcode</p>
                  </div>
                  
                  <div id="add-item-barcode-reader" className="w-full overflow-hidden rounded-xl border-2 border-[rgba(60,60,67,0.12)]"></div>
                  
                  <p className="text-center text-xs text-gray-400 mt-4">
                    Supports: UPC, EAN, Code 128, Code 39
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* Barcode Scanner Section */}
              <div className="bg-[#F2F2F7] p-4 rounded-xl border border-[rgba(60,60,67,0.12)]">
                <div className="flex items-center gap-2 mb-3">
                  <Scan className="h-4 w-4 text-[#3C3C43]" />
                  <label className="text-sm font-semibold font-sf-pro-display text-[#3C3C43]">
                    Scan Barcode or Enter SKU
                  </label>
                </div>
                
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      ref={barcodeInputRef}
                      value={itemForm.barcode || ''}
                      onChange={(e) => setItemForm({...itemForm, barcode: e.target.value})}
                      onKeyDown={handleBarcodeKeyDown}
                      placeholder="Scan barcode or type SKU..."
                      className="h-11 font-mono bg-[#FFFFFF] border-2 border-[rgba(60,60,67,0.12)] focus:border-[rgba(60,60,67,0.12)]"
                      autoComplete="off"
                    />
                  </div>
                  <IOSButton 
                    type="button" 
                    size="icon"
                    className="h-11 w-11 bg-[#3C3C43] hover:bg-[#3C3C43]"
                    onClick={() => lookupBarcode(itemForm.barcode || '')}
                  >
                    <Search className="h-5 w-5" />
                  </IOSButton>
                  <IOSButton 
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-11 w-11 border-2"
                    onClick={startCameraScanner}
                  >
                    <Camera className="h-5 w-5" />
                  </IOSButton>
                </div>
                
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Keyboard className="h-3 w-3" />
                    Hardware scanner supported
                  </span>
                  <span>•</span>
                  <span>Press Enter to search</span>
                </div>
              </div>

              {/* Item Details Form */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Item Name *</label>
                  <Input 
                    value={itemForm.item_name}
                    onChange={(e) => setItemForm({...itemForm, item_name: e.target.value})}
                    placeholder="e.g., Tusker Lager 500ml"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">SKU (auto if empty)</label>
                  <Input 
                    value={itemForm.sku}
                    onChange={(e) => setItemForm({...itemForm, sku: e.target.value})}
                    placeholder="Auto-generated"
                    className="font-mono"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select 
                    value={itemForm.category}
                    onChange={(e) => setItemForm({...itemForm, category: e.target.value})}
                    className="w-full px-3 py-2 border rounded-ios-lg"
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Unit</label>
                  <select 
                    value={itemForm.unit_of_measure}
                    onChange={(e) => setItemForm({...itemForm, unit_of_measure: e.target.value})}
                    className="w-full px-3 py-2 border rounded-ios-lg"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Initial Stock</label>
                  <Input 
                    type="number"
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm({...itemForm, quantity: parseInt(e.target.value) || 0})}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Cost Price</label>
                  <Input 
                    type="number"
                    value={itemForm.cost_price}
                    onChange={(e) => setItemForm({...itemForm, cost_price: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Retail Price</label>
                  <Input 
                    type="number"
                    value={itemForm.retail_price}
                    onChange={(e) => setItemForm({...itemForm, retail_price: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <IOSButton variant="outline" onClick={() => setIsAddItemModalOpen(false)}>
                  Cancel
                </IOSButton>
                <IOSButton onClick={handleAddItem} leftIcon={<Save />}>Save Item
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Item Modal */}
        <Dialog open={isEditItemModalOpen} onOpenChange={setIsEditItemModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-[#3C3C43]" />
                Edit Master Item
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* SKU and Barcode Info */}
              <div className="bg-gray-50 p-3 rounded-ios-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">SKU:</span>
                    <span className="ml-2 font-mono font-medium">{itemForm.sku}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Barcode:</span>
                    <span className="ml-2 font-mono">{itemForm.barcode || 'Not set'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Item Name *</label>
                  <Input 
                    value={itemForm.item_name}
                    onChange={(e) => setItemForm({...itemForm, item_name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Barcode</label>
                  <Input 
                    value={itemForm.barcode || ''}
                    onChange={(e) => setItemForm({...itemForm, barcode: e.target.value})}
                    placeholder="Scan or enter barcode"
                    className="font-mono"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select 
                    value={itemForm.category}
                    onChange={(e) => setItemForm({...itemForm, category: e.target.value})}
                    className="w-full px-3 py-2 border rounded-ios-lg"
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Unit</label>
                  <select 
                    value={itemForm.unit_of_measure}
                    onChange={(e) => setItemForm({...itemForm, unit_of_measure: e.target.value})}
                    className="w-full px-3 py-2 border rounded-ios-lg"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Central Stock</label>
                  <Input 
                    type="number"
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm({...itemForm, quantity: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Cost Price</label>
                  <Input 
                    type="number"
                    value={itemForm.cost_price}
                    onChange={(e) => setItemForm({...itemForm, cost_price: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Retail Price</label>
                  <Input 
                    type="number"
                    value={itemForm.retail_price}
                    onChange={(e) => setItemForm({...itemForm, retail_price: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <IOSButton variant="outline" onClick={() => setIsEditItemModalOpen(false)}>
                  Cancel
                </IOSButton>
                <IOSButton onClick={handleUpdateItem} leftIcon={<Save />}>Update Item
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm Modal */}
        <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-[#3C3C43] flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Confirm Deletion
              </DialogTitle>
            </DialogHeader>
            <p>Are you sure you want to delete <strong>{selectedItem?.item_name}</strong>?</p>
            <p className="text-sm text-gray-500 mt-2">This action cannot be undone and will remove the item from the master catalog.</p>
            <div className="flex justify-end gap-3 pt-4">
              <IOSButton variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>
                Cancel
              </IOSButton>
              <IOSButton className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={handleDeleteItem} leftIcon={<Trash2 />}>Delete
              </IOSButton>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Transfer Modal */}
        <Dialog open={isCreateTransferOpen} onOpenChange={setIsCreateTransferOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5" />
                Create Branch Transfer
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">From Branch *</label>
                  <select 
                    value={transferForm.from_branch_id}
                    onChange={(e) => setTransferForm({...transferForm, from_branch_id: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-ios-lg"
                  >
                    <option value={0}>Select source branch...</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} {b.is_central_warehouse ? '(Central)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">To Branch *</label>
                  <select 
                    value={transferForm.to_branch_id}
                    onChange={(e) => setTransferForm({...transferForm, to_branch_id: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-ios-lg"
                  >
                    <option value={0}>Select destination branch...</option>
                    {branches.filter(b => b.id !== transferForm.from_branch_id).map(b => (
                      <option key={b.id} value={b.id}>{b.name} {b.is_central_warehouse ? '(Central)' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Items to Transfer</label>
                  <IOSButton size="sm" variant="outline" onClick={addTransferItem} leftIcon={<Plus />}>Add Item</IOSButton>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {transferItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <select 
                        value={item.item_sku}
                        onChange={(e) => updateTransferItem(index, 'item_sku', e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-ios-lg text-sm"
                      >
                        <option value="">Select item...</option>
                        {masterItems.map(mi => (
                          <option key={mi.sku} value={mi.sku}>{mi.item_name} ({mi.sku})</option>
                        ))}
                      </select>
                      <Input 
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateTransferItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-24"
                        placeholder="Qty"
                      />
                      {transferItems.length > 1 && (
                        <IOSButton size="sm" variant="ghost" onClick={() => removeTransferItem(index)}>
                          <X className="h-4 w-4 text-[#8E8E93]0" />
                        </IOSButton>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Notes</label>
                <Input 
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({...transferForm, notes: e.target.value})}
                  placeholder="Transfer notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <IOSButton variant="outline" onClick={() => setIsCreateTransferOpen(false)}>
                  Cancel
                </IOSButton>
                <IOSButton className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={handleCreateTransfer} leftIcon={<Send />}>Create Transfer
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
