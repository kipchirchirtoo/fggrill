'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { centralOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import {
  Package, Search, Filter, RefreshCw, PlusCircle,
  Truck, AlertTriangle, Check, ShoppingCart, Camera, X, Keyboard, Scan, Barcode, Eye, Building2
} from 'lucide-react';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// SKU Category codes mapping - matches backend sku.service.ts
const CATEGORY_CODES: Record<string, string> = {
  'Bar & Beverages': 'BAR',
  'beverages': 'BAR',
  'Kitchen': 'KIT',
  'food': 'KIT',
  'Housekeeping': 'HK',
  'housekeeping': 'HK',
  'Maintenance': 'MNT',
  'Laundry': 'LDR',
  'Office': 'OFF',
  'General': 'GEN'
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

// Generate SKU preview (matches backend logic)
function generateSKUPreview(category: string, itemName: string): string {
  const categoryCode = CATEGORY_CODES[category] || 'GEN';
  const productCode = itemName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .substring(0, 6) || 'ITEM';
  return `FGH-${categoryCode}-${productCode}-XXXX`;
}

// Item type
interface InventoryItem {
  sku: string;
  name: string;
  category: string;
  unit: string;
  central_stock: number;
  reorder_level: number;
  value: number;
  branch_allocations: Record<string, number>;
}

interface Branch {
  id: number;
  name: string;
  code?: string;
  location?: string;
  status?: string;
}

function CentralWarehouseInventoryContent() {
  const { user } = useAuth();
  const { branches: contextBranches } = useBranch();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showLowStock, setShowLowStock] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [branchList, setBranchList] = useState<Branch[]>([]);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for adding/editing items
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Bar & Beverages');
  const [formUnit, setFormUnit] = useState('piece');
  const [formStock, setFormStock] = useState(0);
  const [formReorderLevel, setFormReorderLevel] = useState(10);
  const [formValue, setFormValue] = useState(0);
  const [formCostPrice, setFormCostPrice] = useState(0);
  const [skuPreview, setSkuPreview] = useState('FGH-BAR-ITEM-XXXX');
  const [useAutoSku, setUseAutoSku] = useState(true);

  // States for dispatch
  const [dispatchBranch, setDispatchBranch] = useState('');
  const [dispatchQuantity, setDispatchQuantity] = useState(0);
  const [dispatchNotes, setDispatchNotes] = useState('');

  // Barcode scanner states
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [formBarcode, setFormBarcode] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const scanTimeout = useRef<NodeJS.Timeout | null>(null);


  // Sync context branches to branchList whenever context updates
  useEffect(() => {
    if (Array.isArray(contextBranches) && contextBranches.length > 0 && branchList.length === 0) {
      setBranchList(contextBranches as Branch[]);
    }
  }, [contextBranches, branchList.length]);

  // Fetch branches and inventory on mount
  useEffect(() => {
    fetchBranches();
    fetchInventory();
  }, []);

  // Refetch inventory when branch changes
  useEffect(() => {
    fetchInventory();
  }, [selectedBranch]);

  const fetchBranches = async () => {
    // First, try to use context branches if available
    if (Array.isArray(contextBranches) && contextBranches.length > 0) {
      setBranchList(contextBranches as Branch[]);
      return; // Context branches are sufficient
    }

    // Otherwise, fetch from API
    try {
      const response = await centralOperationsAPI.getAllBranches();
      if (response.success && Array.isArray(response.data) && response.data.length > 0) {
        setBranchList(response.data);
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  // Update SKU preview when name or category changes
  useEffect(() => {
    if (useAutoSku) {
      setSkuPreview(generateSKUPreview(formCategory || 'General', formName || ''));
    }
  }, [formName, formCategory, useAutoSku]);

  // Filter items when filters change
  useEffect(() => {
    filterItems();
  }, [items, searchQuery, selectedCategory, showLowStock, selectedBranch]);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      // Build query params
      const params: Record<string, string> = {};
      if (selectedBranch && selectedBranch !== 'all') {
        params.branch_id = selectedBranch;
      }

      const response = await centralOperationsAPI.getMasterInventory(params);

      if (response.success) {
        setItems(response.data || []);
      } else {
        setItems([]);
        toast.error(response.message || 'Failed to fetch inventory');
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Failed to load inventory data');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    // Reset form fields with proper defaults
    setFormSku('');
    setFormName('');
    setFormCategory('Bar & Beverages');
    setFormUnit('piece');
    setFormStock(0);
    setFormReorderLevel(10);
    setFormValue(0);
    setFormCostPrice(0);
    setFormBarcode('');
    setUseAutoSku(true);
    setSkuPreview('FGH-BAR-ITEM-XXXX');
    setIsScannerActive(false);

    setShowAddModal(true);

    // Focus barcode input after modal opens
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 150);
  };

  // ==========================================
  // BARCODE SCANNER FUNCTIONS
  // ==========================================
  const startCameraScanner = async () => {
    setIsScannerActive(true);
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      const html5QrCode = new Html5Qrcode("central-barcode-reader", {
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
          setFormBarcode(decodedText);
          setFormSku(decodedText);
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

  const lookupBarcode = useCallback(async (code: string) => {
    if (!code || code.trim().length < 2) return;

    const cleanCode = code.trim();
    try {
      // Try to find existing item by SKU/barcode
      const response = await centralOperationsAPI.getMasterInventory({ search: cleanCode });

      if (response.success && response.data && response.data.length > 0) {
        const existingItem = response.data.find((item: InventoryItem) =>
          item.sku.toLowerCase() === cleanCode.toLowerCase()
        );

        if (existingItem) {
          // Item found - pre-fill form
          setFormSku(existingItem.sku);
          setFormName(existingItem.name);
          setFormCategory(existingItem.category);
          setFormUnit(existingItem.unit);
          setFormStock(existingItem.central_stock);
          setFormReorderLevel(existingItem.reorder_level);
          setFormValue(existingItem.value);
          toast.info(`Item found: ${existingItem.name}`);
        } else {
          // New item - just set SKU
          setFormSku(cleanCode);
          toast.info('New item - enter details');
        }
      } else {
        // New item - just set SKU
        setFormSku(cleanCode);
        toast.info('New item - enter details');
      }
    } catch (error) {
      console.error('Lookup error:', error);
      setFormSku(cleanCode);
    }
  }, []);

  const handleBarcodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormBarcode(value);
    setFormSku(value);

    // Clear existing timeout
    if (scanTimeout.current) {
      clearTimeout(scanTimeout.current);
    }

    // Auto-trigger search after scanner finishes (hardware scanners type fast)
    if (value.length >= 3) {
      scanTimeout.current = setTimeout(() => {
        if (value.length >= 8 && !value.includes(' ')) {
          lookupBarcode(value);
        }
      }, 150);
    }
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = (e.target as HTMLInputElement).value;
      if (value.trim()) {
        lookupBarcode(value.trim());
      }
    }
  };

  // Cleanup scanner on unmount or modal close
  useEffect(() => {
    return () => {
      stopCameraScanner();
      if (scanTimeout.current) clearTimeout(scanTimeout.current);
    };
  }, []);

  // Stop scanner when modal closes
  useEffect(() => {
    if (!showAddModal) {
      stopCameraScanner();
    }
  }, [showAddModal]);

  const handleOpenEditModal = (item: InventoryItem) => {
    setSelectedItem(item);

    // Populate form fields
    setFormSku(item.sku);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormUnit(item.unit);
    setFormStock(item.central_stock);
    setFormReorderLevel(item.reorder_level);
    setFormValue(item.value);

    setShowEditModal(true);
  };

  const handleOpenDispatchModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setDispatchQuantity(0);
    setDispatchBranch('');
    setDispatchNotes('');
    setShowDispatchModal(true);
  };

  const handleAddItem = async () => {
    // Validate form - name is required, SKU can be auto-generated
    if (!formName?.trim()) {
      toast.error('Item name is required');
      return;
    }
    if (!formCategory) {
      toast.error('Please select a category');
      return;
    }
    if (!formUnit) {
      toast.error('Please select a unit');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');

      // Determine SKU - use form value or let backend auto-generate
      let skuToUse = formSku?.trim();
      if (useAutoSku || !skuToUse) {
        // Call backend to generate SKU
        const skuResponse = await fetch(`${API_URL}/api/store/generate-sku`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            category: formCategory,
            item_name: formName,
            barcode: formBarcode || null
          })
        });

        if (skuResponse.ok) {
          const skuData = await skuResponse.json();
          if (skuData.success && skuData.sku) {
            skuToUse = skuData.sku;
          }
        }

        // Fallback if SKU generation fails
        if (!skuToUse) {
          const categoryCode = CATEGORY_CODES[formCategory] || 'GEN';
          const productCode = formName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6) || 'ITEM';
          const timestamp = Date.now().toString().slice(-4);
          skuToUse = `FGH-${categoryCode}-${productCode}-${timestamp}`;
        }
      }

      // Calculate value from cost price and stock
      const calculatedValue = formCostPrice * formStock;

      const response = await centralOperationsAPI.createMasterItem({
        sku: skuToUse,
        name: formName.trim(),
        category: formCategory,
        unit: formUnit,
        central_stock: formStock,
        reorder_level: formReorderLevel,
        value: calculatedValue || formValue,
        branch_allocations: {}
      });

      if (response.success) {
        toast.success(`Item added successfully! SKU: ${skuToUse}`);
        setShowAddModal(false);
        fetchInventory();
      } else {
        toast.error(response.message || 'Failed to add item');
      }
    } catch (error: any) {
      console.error('Error adding item:', error);
      toast.error(error.message || 'Failed to add item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditItem = async () => {
    if (!selectedItem) return;

    // Validate form
    if (!formName || !formCategory || !formUnit) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await centralOperationsAPI.updateMasterItem(selectedItem.sku, {
        name: formName,
        category: formCategory,
        unit: formUnit,
        central_stock: formStock,
        reorder_level: formReorderLevel,
        value: formValue,
        branch_allocations: selectedItem.branch_allocations
      });

      if (response.success) {
        toast.success('Item updated successfully');
        setShowEditModal(false);
        fetchInventory();
      } else {
        toast.error(response.message || 'Failed to update item');
      }
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Failed to update item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDispatchItem = async () => {
    if (!selectedItem || !dispatchBranch || dispatchQuantity <= 0) {
      toast.error('Please select a branch and specify a valid quantity');
      return;
    }

    if (dispatchQuantity > selectedItem.central_stock) {
      toast.error(`Cannot dispatch more than available stock (${selectedItem.central_stock} ${selectedItem.unit}s)`);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await centralOperationsAPI.createDispatch({
        branch_id: parseInt(dispatchBranch),
        items: [{
          sku: selectedItem.sku,
          name: selectedItem.name,
          quantity: dispatchQuantity,
          unit: selectedItem.unit
        }],
        notes: dispatchNotes
      });

      if (response.success) {
        toast.success('Dispatch created successfully');
        setShowDispatchModal(false);
        fetchInventory();
      } else {
        toast.error(response.message || 'Failed to create dispatch');
      }
    } catch (error) {
      console.error('Error creating dispatch:', error);
      toast.error('Failed to create dispatch');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filterItems = () => {
    let filtered = [...items];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Filter by branch (show items with allocation to selected branch)
    if (selectedBranch && selectedBranch !== 'all') {
      filtered = filtered.filter(item => {
        const allocations = item.branch_allocations || {};
        return allocations[selectedBranch] !== undefined && allocations[selectedBranch] > 0;
      });
    }

    // Filter by low stock
    if (showLowStock) {
      filtered = filtered.filter(item => item.central_stock <= item.reorder_level);
    }

    setFilteredItems(filtered);
  };

  const categories = ['all', ...new Set(items.map(item => item.category))];

  const totalValue = filteredItems.reduce((sum, item) => sum + item.value, 0);
  const lowStockCount = filteredItems.filter(item => item.central_stock <= item.reorder_level).length;

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.CENTRAL_OPERATIONS_MANAGER,
      UserRole.CENTRAL_STOREKEEPER
    ]}>
      <BranchAwareDashboardLayout
        title="Master Inventory"
        subtitle="Central warehouse inventory management"
        requireBranchContext={false}
        actionButton={
          <div className="flex space-x-2">
            <IOSButton
              variant="secondary"
              onClick={fetchInventory}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </IOSButton>
            <IOSButton
              variant="primary"
              leftIcon={<PlusCircle className="h-4 w-4" />}
              onClick={handleOpenAddModal}
            >
              Add Item
            </IOSButton>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Branch Indicator */}
          {selectedBranch !== 'all' && (
            <div className="bg-gray-50 border border-gray-200 rounded-ios-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-800">
                  Viewing inventory for: <strong>{branchList.find(b => b.id.toString() === selectedBranch)?.name || 'Selected Branch'}</strong>
                </span>
              </div>
              <IOSButton
                variant="ghost"
                size="sm"
                onClick={() => setSelectedBranch('all')}
                className="text-gray-600 hover:text-gray-800"
              >
                <X className="h-4 w-4 mr-1" /> Clear Filter
              </IOSButton>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <IOSCard className="p-4 border border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Building2 className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Branches</p>
                  <p className="text-lg font-semibold text-gray-900">{branchList.length}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-4 border border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Package className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Items</p>
                  <p className="text-lg font-semibold text-gray-900">{filteredItems.length}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-4 border border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Low Stock Items</p>
                  <p className="text-lg font-semibold text-gray-900">{lowStockCount}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-4 border border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Value</p>
                  <p className="text-lg font-semibold text-gray-900">KES {(totalValue / 1000).toFixed(0)}K</p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Search and Filter */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or SKU"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-ios-lg text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                {/* Branch Selector */}
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="pl-9 pr-8 py-2 border border-gray-200 rounded-ios-lg text-sm appearance-none bg-white min-w-[160px]"
                  >
                    <option value="all">All Branches</option>
                    {branchList.map((branch) => (
                      <option key={branch.id} value={branch.id.toString()}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Filter */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="pl-9 pr-8 py-2 border border-gray-200 rounded-ios-lg text-sm appearance-none bg-white min-w-[150px]"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center space-x-2 px-3 py-2 border border-gray-200 rounded-ios-lg bg-white cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={showLowStock}
                    onChange={() => setShowLowStock(!showLowStock)}
                    className="rounded text-gray-600 focus:ring-blue-600"
                  />
                  <span className="text-sm whitespace-nowrap">Low Stock Only</span>
                </label>
              </div>
            </div>
          </IOSCard>

          {/* Inventory Table */}
          <IOSCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4 text-sm font-medium text-gray-600">SKU</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Name</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Category</th>
                    <th className="text-center p-4 text-sm font-medium text-gray-600">Unit</th>
                    <th className="text-center p-4 text-sm font-medium text-gray-600">Stock</th>
                    <th className="text-center p-4 text-sm font-medium text-gray-600">Reorder Level</th>
                    <th className="text-right p-4 text-sm font-medium text-gray-600">Value (KES)</th>
                    <th className="text-center p-4 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-center p-4 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="p-4 text-center">
                        <div className="flex justify-center items-center py-8">
                          <RefreshCw className="h-5 w-5 text-gray-400 animate-spin" />
                          <span className="ml-2 text-gray-500">Loading inventory...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-4 text-center">
                        <div className="py-8">
                          <Package className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500">No inventory items found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.sku} className="border-b hover:bg-gray-50">
                        <td className="p-4 text-sm font-medium">{item.sku}</td>
                        <td className="p-4 text-sm">{item.name}</td>
                        <td className="p-4 text-sm">{item.category}</td>
                        <td className="p-4 text-sm text-center">{item.unit}</td>
                        <td className="p-4 text-sm text-center font-medium">{item.central_stock}</td>
                        <td className="p-4 text-sm text-center">{item.reorder_level}</td>
                        <td className="p-4 text-sm text-right">{item.value.toLocaleString()}</td>
                        <td className="p-4 text-center">
                          {item.central_stock <= item.reorder_level ? (
                            <IOSBadge color="danger">Low Stock</IOSBadge>
                          ) : (
                            <IOSBadge color="success">In Stock</IOSBadge>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center space-x-2">
                            <IOSButton
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditModal(item)}
                            >
                              Edit
                            </IOSButton>
                            <IOSButton
                              variant="ghost"
                              size="sm"
                              leftIcon={<Truck className="h-3.5 w-3.5" />}
                              onClick={() => handleOpenDispatchModal(item)}
                            >
                              Dispatch
                            </IOSButton>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </IOSCard>

          {/* Add Item Modal */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-ios-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Add New Item</h2>
                    <IOSButton variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>
                      <X className="h-5 w-5" />
                    </IOSButton>
                  </div>

                  {/* Camera Scanner Overlay */}
                  {isScannerActive && (
                    <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-[60]">
                      <div className="w-full max-w-md p-4">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold text-white">Scan Barcode</h3>
                          <IOSButton
                            variant="ghost"
                            size="sm"
                            onClick={stopCameraScanner}
                            className="text-white hover:bg-white/20"
                          >
                            <X className="h-5 w-5" />
                          </IOSButton>
                        </div>
                        <div className="text-center mb-4">
                          <Camera className="h-8 w-8 mx-auto mb-2 text-white" />
                          <p className="text-sm text-gray-300">Point camera at product barcode</p>
                        </div>

                        <div id="central-barcode-reader" className="w-full overflow-hidden rounded-xl border-2 border-white/30"></div>

                        <p className="text-center text-xs text-gray-400 mt-4">
                          Supports: UPC, EAN, Code 128, Code 39
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* SKU Preview Banner */}
                    <div className="p-3 bg-gray-50 rounded-ios-lg border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-600 uppercase tracking-wide font-medium">SKU Preview</p>
                          <p className="font-mono text-lg font-bold text-gray-900">{skuPreview}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-600">Format: FGH-[CAT]-[NAME]-[SERIAL]</p>
                          <label className="flex items-center gap-2 mt-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={useAutoSku}
                              onChange={(e) => {
                                setUseAutoSku(e.target.checked);
                                if (e.target.checked) setFormSku('');
                              }}
                              className="rounded text-gray-600"
                            />
                            <span className="text-xs text-gray-700">Auto-generate SKU</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Barcode Scanner Section */}
                    <div className="bg-gray-50 p-4 rounded-ios-lg border border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Barcode className="h-4 w-4 text-gray-600" />
                        <label className="text-sm font-semibold text-gray-700">
                          Barcode (Optional)
                        </label>
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1">
                          <input
                            ref={barcodeInputRef}
                            type="text"
                            value={formBarcode}
                            onChange={handleBarcodeInputChange}
                            onKeyDown={handleBarcodeKeyDown}
                            className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Scan barcode or type manually..."
                            autoComplete="off"
                          />
                        </div>
                        <IOSButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => lookupBarcode(formBarcode)}
                        >
                          <Search className="h-4 w-4" />
                        </IOSButton>
                        <IOSButton
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={startCameraScanner}
                        >
                          <Camera className="h-4 w-4" />
                        </IOSButton>
                      </div>

                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Keyboard className="h-3 w-3" />
                          Hardware scanner supported
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          Camera scan
                        </span>
                      </div>
                    </div>

                    {/* SKU Field - only show if not auto-generating */}
                    {!useAutoSku && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">SKU (Manual)</label>
                        <input
                          type="text"
                          value={formSku}
                          onChange={(e) => setFormSku(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="e.g., FGH-BAR-TUSKER-0001"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="e.g., Tusker Lager 500ml"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                        <select
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                        >
                          {CATEGORIES.map(cat => (
                            <option key={cat.code} value={cat.name}>{cat.name} ({cat.code})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                        <select
                          value={formUnit}
                          onChange={(e) => setFormUnit(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                        >
                          {UNITS.map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Initial Stock</label>
                        <input
                          type="number"
                          value={formStock}
                          onChange={(e) => setFormStock(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          min="0"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price</label>
                        <input
                          type="number"
                          value={formCostPrice}
                          onChange={(e) => setFormCostPrice(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          min="0"
                          step="0.01"
                          placeholder="KES"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
                        <input
                          type="number"
                          value={formReorderLevel}
                          onChange={(e) => setFormReorderLevel(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          min="0"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Total Value</label>
                        <input
                          type="text"
                          value={`KES ${(formCostPrice * formStock).toLocaleString()}`}
                          disabled
                          className="w-full px-3 py-2 border border-gray-200 rounded-ios-lg text-sm bg-gray-50 text-gray-600"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t">
                      <IOSButton
                        variant="secondary"
                        onClick={() => setShowAddModal(false)}
                      >
                        Cancel
                      </IOSButton>
                      <IOSButton
                        variant="primary"
                        onClick={handleAddItem}
                        disabled={isSubmitting}
                        leftIcon={isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      >
                        {isSubmitting ? 'Adding...' : 'Add Item'}
                      </IOSButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit Item Modal */}
          {showEditModal && selectedItem && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-ios-lg w-full max-w-lg">
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Edit Item: {selectedItem.sku}</h2>
                    <IOSButton variant="ghost" size="sm" onClick={() => setShowEditModal(false)}>
                      Close
                    </IOSButton>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name*</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="e.g., Tusker Lager"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category*</label>
                        <input
                          type="text"
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="e.g., beverages"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unit*</label>
                        <input
                          type="text"
                          value={formUnit}
                          onChange={(e) => setFormUnit(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="e.g., bottle"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                        <input
                          type="number"
                          value={formStock}
                          onChange={(e) => setFormStock(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          min="0"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
                        <input
                          type="number"
                          value={formReorderLevel}
                          onChange={(e) => setFormReorderLevel(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          min="0"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Value (KES)</label>
                        <input
                          type="number"
                          value={formValue}
                          onChange={(e) => setFormValue(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <IOSButton
                        variant="secondary"
                        onClick={() => setShowEditModal(false)}
                      >
                        Cancel
                      </IOSButton>
                      <IOSButton
                        variant="primary"
                        onClick={handleEditItem}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Updating...' : 'Update Item'}
                      </IOSButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dispatch Modal */}
          {showDispatchModal && selectedItem && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-ios-lg w-full max-w-lg">
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Dispatch Item: {selectedItem.name}</h2>
                    <IOSButton variant="ghost" size="sm" onClick={() => setShowDispatchModal(false)}>
                      Close
                    </IOSButton>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">SKU</p>
                    <p className="font-medium">{selectedItem.sku}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Available Stock</p>
                    <p className="font-medium">{selectedItem.central_stock} {selectedItem.unit}s</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Branch*</label>
                      <select
                        value={dispatchBranch}
                        onChange={(e) => setDispatchBranch(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select Branch</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantity*</label>
                      <input
                        type="number"
                        value={dispatchQuantity}
                        onChange={(e) => setDispatchQuantity(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        min="1"
                        max={selectedItem.central_stock}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                      <textarea
                        value={dispatchNotes}
                        onChange={(e) => setDispatchNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        rows={3}
                      ></textarea>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <IOSButton
                        variant="secondary"
                        onClick={() => setShowDispatchModal(false)}
                      >
                        Cancel
                      </IOSButton>
                      <IOSButton
                        variant="primary"
                        onClick={handleDispatchItem}
                        disabled={isSubmitting || dispatchQuantity <= 0 || !dispatchBranch}
                        leftIcon={<Truck className="h-4 w-4" />}
                      >
                        {isSubmitting ? 'Creating Dispatch...' : 'Create Dispatch'}
                      </IOSButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

// Wrap with BranchPageWrapper to prevent hydration errors
export default function CentralWarehouseInventoryPage() {
  return (
    <BranchPageWrapper>
      <CentralWarehouseInventoryContent />
    </BranchPageWrapper>
  );
}
