'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { storeAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
  Package, Barcode, Search, Plus, Save, ArrowLeft, Printer, Loader2, CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface ReceivingItem {
  id: string;
  item_id?: string;
  item_name: string;
  category: string;
  unit: string;
  quantity: number;
  barcode?: string;
  isNew: boolean;
}

export default function ReceivingBarcodePage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [items, setItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // New item form
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('pcs');
  const [newItemQuantity, setNewItemQuantity] = useState('');

  // Barcode
  const [barcode, setBarcode] = useState('');
  const [isGeneratingBarcode, setIsGeneratingBarcode] = useState(false);
  const [barcodeGenerated, setBarcodeGenerated] = useState(false);

  // Loading
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [receivedItem, setReceivedItem] = useState<any>(null);

  useEffect(() => {
    if (mode === 'select') {
      loadItems();
    }
  }, [mode]);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getItems({ limit: 100 });
      if (res.success) {
        setItems(res.data || []);
      }
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await storeAPI.getItems({ search: searchQuery });
      if (res.success) {
        setItems(res.data || []);
      }
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerateBarcode = async () => {
    setIsGeneratingBarcode(true);
    try {
      const res = await storeAPI.generateBarcode({});
      if (res.success && res.data?.barcode) {
        setBarcode(res.data.barcode);
        setBarcodeGenerated(true);
        toast.success('Barcode generated successfully');
      } else {
        throw new Error(res.message || 'Failed to generate barcode');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate barcode');
    } finally {
      setIsGeneratingBarcode(false);
    }
  };

  const handlePrintLabel = () => {
    if (!barcode) return;
    const itemName = mode === 'create' ? newItemName : selectedItem?.item_name || 'Item';
    
    const printWindow = window.open('', '_blank', 'width=420,height=640');
    if (!printWindow) {
      toast.error('Enable pop-ups to print barcode labels');
      return;
    }

    printWindow.document.write(`
      <html>
        <head><title>${itemName} Barcode</title></head>
        <body style="font-family: Arial, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0;">
          <div style="border:1px solid #d6d3d1; border-radius:12px; padding:24px; text-align:center; width:320px;">
            <div style="font-size:18px; font-weight:700; margin-bottom:12px;">${itemName}</div>
            <div style="font-size:48px; font-weight:700; letter-spacing:0.1em; margin:20px 0;">${barcode}</div>
            <div style="font-size:12px; color:#78716c; margin-top:12px;">Scan to identify</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const handleSubmit = async () => {
    if (mode === 'create') {
      if (!newItemName || !newItemCategory || !newItemUnit || !newItemQuantity) {
        toast.error('Please fill in all required fields');
        return;
      }
      if (!barcode) {
        toast.error('Please generate a barcode');
        return;
      }
    } else {
      if (!selectedItem) {
        toast.error('Please select an item');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = mode === 'create' ? {
        item_name: newItemName,
        category: newItemCategory,
        unit: newItemUnit,
        quantity: parseFloat(newItemQuantity),
        barcode: barcode,
        branch_id: user?.branch_id?.toString() || 'central',
      } : {
        item_id: selectedItem.id || selectedItem.sku,
        quantity: 1,
        unit: selectedItem.unit || selectedItem.unit_of_measure,
        barcode: barcode || selectedItem.barcode,
        branch_id: user?.branch_id?.toString() || 'central',
      };

      const res = await storeAPI.receiveItemWithBarcode(payload);
      if (res.success) {
        setReceivedItem(res.data);
        setShowSuccessModal(true);
        toast.success('Item received successfully');
      } else {
        throw new Error(res.message || 'Failed to receive item');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to receive item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedItem(null);
    setNewItemName('');
    setNewItemCategory('');
    setNewItemUnit('pcs');
    setNewItemQuantity('');
    setBarcode('');
    setBarcodeGenerated(false);
    setShowSuccessModal(false);
    setReceivedItem(null);
  };

  const filteredItems = items.filter(item =>
    item.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Receive Items</h1>
              <p className="text-stone-500 mt-0.5">Scan or generate barcodes for inventory items</p>
            </div>
            <Link href="/dashboard/central-store">
              <button className="btn-secondary">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </button>
            </Link>
          </div>

          {/* Mode Selection */}
          <div className="card-elevated p-6">
            <h2 className="text-lg font-semibold mb-4">Receiving Mode</h2>
            <div className="flex gap-3">
              <button
                onClick={() => setMode('select')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  mode === 'select'
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                }`}
              >
                <Package className="h-5 w-5 mx-auto mb-2" />
                <span className="text-sm font-medium">Select Existing Item</span>
              </button>
              <button
                onClick={() => setMode('create')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  mode === 'create'
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                }`}
              >
                <Plus className="h-5 w-5 mx-auto mb-2" />
                <span className="text-sm font-medium">Create New Item</span>
              </button>
            </div>
          </div>

          {/* Select Existing Item */}
          {mode === 'select' && (
            <div className="card-elevated p-6">
              <h2 className="text-lg font-semibold mb-4">Select Item</h2>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search items..."
                  className="input-field flex-1"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="btn-secondary"
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-stone-400">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Loading items...</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredItems.slice(0, 10).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        selectedItem?.id === item.id
                          ? 'border-stone-900 bg-stone-50'
                          : 'border-stone-100 hover:border-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-stone-900">{item.item_name}</p>
                          <p className="text-sm text-stone-500">
                            {item.category} • {item.unit || item.unit_of_measure}
                          </p>
                        </div>
                        {selectedItem?.id === item.id && (
                          <CheckCircle2 className="h-5 w-5 text-stone-900" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create New Item */}
          {mode === 'create' && (
            <div className="card-elevated p-6">
              <h2 className="text-lg font-semibold mb-4">New Item Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Item Name *</label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="input-field"
                    placeholder="e.g., Tomatoes"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Category *</label>
                    <input
                      type="text"
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="input-field"
                      placeholder="e.g., Vegetables"
                    />
                  </div>
                  <div>
                    <label className="label">Unit *</label>
                    <select
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                      className="input-field"
                    >
                      <option value="pcs">Pieces</option>
                      <option value="kg">Kilograms</option>
                      <option value="liters">Liters</option>
                      <option value="boxes">Boxes</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Initial Quantity *</label>
                  <input
                    type="number"
                    value={newItemQuantity}
                    onChange={(e) => setNewItemQuantity(e.target.value)}
                    className="input-field"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Barcode Section */}
          <div className="card-elevated p-6">
            <h2 className="text-lg font-semibold mb-4">Barcode</h2>
            {barcode ? (
              <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-6 text-center">
                <Barcode className="h-12 w-12 mx-auto mb-3 text-stone-400" />
                <p className="text-2xl font-bold text-stone-900 tracking-wider mb-2">{barcode}</p>
                {barcodeGenerated && (
                  <p className="text-sm text-green-600 font-medium">✓ Generated</p>
                )}
              </div>
            ) : (
              <div className="bg-stone-50 border-2 border-dashed border-stone-300 rounded-lg p-12 text-center">
                <Barcode className="h-12 w-12 mx-auto mb-3 text-stone-300" />
                <p className="text-stone-400">No barcode assigned</p>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleGenerateBarcode}
                disabled={isGeneratingBarcode}
                className="btn-secondary flex-1"
              >
                {isGeneratingBarcode ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Barcode className="h-4 w-4 mr-2" />
                )}
                Generate Barcode
              </button>
              {barcode && (
                <button
                  onClick={handlePrintLabel}
                  className="btn-secondary"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Label
                </button>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !barcode || (mode === 'select' && !selectedItem)}
            className="btn-primary w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Receiving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Receive Item
              </>
            )}
          </button>
        </div>

        {/* Success Modal */}
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Item Received Successfully
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-stone-600 mb-4">
                {receivedItem?.item_name || 'Item'} has been added to inventory with barcode {receivedItem?.barcode || barcode}.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    resetForm();
                    setShowSuccessModal(false);
                  }}
                  className="btn-primary flex-1"
                >
                  Receive Another
                </button>
                <Link href="/dashboard/central-store/inventory" className="flex-1">
                  <button className="btn-secondary w-full">
                    View Inventory
                  </button>
                </Link>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
