'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  Scan, X, Search, PackagePlus, CheckCircle, Loader2, 
  AlertCircle, Package, Keyboard, Camera, Tag, Hash
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

// Flow states: SCAN -> (FOUND | CREATE)
type EntryState = 'SCAN' | 'SEARCHING' | 'FOUND' | 'CREATE';

// API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Category codes for SKU generation
const CATEGORY_OPTIONS = [
  { code: 'BAR', name: 'Bar & Beverages', label: 'Bar' },
  { code: 'KIT', name: 'Kitchen', label: 'Kitchen' },
  { code: 'HK', name: 'Housekeeping', label: 'Housekeeping' },
  { code: 'MNT', name: 'Maintenance', label: 'Maintenance' },
  { code: 'LDR', name: 'Laundry', label: 'Laundry' },
  { code: 'FNB', name: 'Food & Beverage', label: 'F&B Supplies' },
  { code: 'OFF', name: 'Office', label: 'Office' },
  { code: 'GEN', name: 'General', label: 'General' },
];

// Generate product code from name (first 6 chars, uppercase, alphanumeric)
function generateProductCode(name: string): string {
  if (!name) return 'ITEM';
  return name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6) || 'ITEM';
}

// Get category code from category name
function getCategoryCode(category: string): string {
  const found = CATEGORY_OPTIONS.find(c => 
    c.name.toLowerCase() === category.toLowerCase() || 
    c.label.toLowerCase() === category.toLowerCase() ||
    c.code.toLowerCase() === category.toLowerCase()
  );
  return found?.code || 'GEN';
}

export function AddItemModal({ isOpen, onClose, onSubmit }: AddItemModalProps) {
  // State management
  const [entryState, setEntryState] = useState<EntryState>('SCAN');
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<string | null>(null);
  
  // Refs for focus management
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  
  // Buffer for hardware scanner input (captures rapid keystrokes)
  const scanBuffer = useRef<string>('');
  const scanTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    item_name: '',
    description: '',
    category: '',
    unit_of_measure: 'piece',
    cost_price: 0,
    retail_price: 0,
    supplier: '',
    reorder_level: 10,
    quantity: 0,
    notes: '',
  });

  // Existing item data (for FOUND mode display)
  const [existingItem, setExistingItem] = useState<any>(null);

  // Auto-generate SKU preview based on category and item name
  const skuPreview = useMemo(() => {
    if (formData.sku && !formData.sku.startsWith('FGH-')) {
      // User manually entered SKU
      return formData.sku;
    }
    
    const catCode = getCategoryCode(formData.category || 'General');
    const prodCode = generateProductCode(formData.item_name);
    return `FGH-${catCode}-${prodCode}-XXXX`;
  }, [formData.category, formData.item_name, formData.sku]);

  // Reset everything when modal opens
  useEffect(() => {
    if (isOpen) {
      resetToScanMode();
      // Focus the barcode input after a short delay to ensure DOM is ready
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 150);
    } else {
      // Cleanup when closing
      stopCameraScanner();
    }
  }, [isOpen]);

  // Focus quantity input when entering FOUND mode
  useEffect(() => {
    if (entryState === 'FOUND') {
      setTimeout(() => {
        quantityInputRef.current?.focus();
        quantityInputRef.current?.select();
      }, 100);
    }
  }, [entryState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCameraScanner();
      if (scanTimeout.current) clearTimeout(scanTimeout.current);
    };
  }, []);

  const resetToScanMode = () => {
    setEntryState('SCAN');
    setExistingItem(null);
    setFormData({
      sku: '',
      barcode: '',
      item_name: '',
      description: '',
      category: '',
      unit_of_measure: 'piece',
      cost_price: 0,
      retail_price: 0,
      supplier: '',
      reorder_level: 10,
      quantity: 0,
      notes: '',
    });
    scanBuffer.current = '';
  };

  // ==========================================
  // BARCODE LOOKUP FUNCTION
  // ==========================================
  const lookupBarcode = useCallback(async (code: string) => {
    if (!code || code.trim().length < 2) {
      toast.error('Please enter a valid barcode or SKU');
      return;
    }

    const cleanCode = code.trim();
    setEntryState('SEARCHING');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/items/${encodeURIComponent(cleanCode)}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const { data } = await response.json();
        
        // FOUND: Item exists - auto-fill and go to quantity entry
        setExistingItem(data);
        setFormData(prev => ({
          ...prev,
          sku: data.sku,
          barcode: data.barcode || cleanCode,
          item_name: data.item_name || data.description || '',
          description: data.description || '',
          category: data.category || '',
          unit_of_measure: data.unit_of_measure || 'piece',
          cost_price: data.cost_price || 0,
          retail_price: data.retail_price || 0,
          supplier: data.supplier || '',
          reorder_level: data.reorder_level || 10,
          quantity: 0, // Reset for new stock entry
          notes: '',
        }));
        setEntryState('FOUND');
        toast.success(`✓ Item found: ${data.item_name || data.description}`);
        
      } else {
        // NOT FOUND: Go to create mode with barcode pre-filled
        setFormData(prev => ({
          ...prev,
          sku: cleanCode,
          barcode: cleanCode,
          item_name: '',
          quantity: 0,
        }));
        setEntryState('CREATE');
        toast.info('Item not found. Please enter details to create new item.');
      }
    } catch (error) {
      console.error('Lookup error:', error);
      toast.error('Error looking up item. Please try again.');
      setEntryState('SCAN');
    }
  }, []);

  // ==========================================
  // HARDWARE SCANNER SUPPORT
  // ==========================================
  // Hardware scanners type rapidly and end with Enter
  const handleBarcodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, barcode: value, sku: value }));
    
    // Clear existing timeout
    if (scanTimeout.current) {
      clearTimeout(scanTimeout.current);
    }
    
    // Set new timeout - if no more input in 100ms, consider scan complete
    // Hardware scanners type much faster than humans
    if (value.length >= 3) {
      scanTimeout.current = setTimeout(() => {
        // Auto-trigger search after scanner finishes
        // Only if value looks like a scanned barcode (no spaces, reasonable length)
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

  // ==========================================
  // CAMERA SCANNER SUPPORT
  // ==========================================
  const startCameraScanner = async () => {
    setIsScanning(true);
    setScannerActive(true);
    
    // Wait for the reader div to be rendered
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
      const html5QrCode = new Html5Qrcode("barcode-reader", {
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
        {
          fps: 10,
          qrbox: { width: 280, height: 150 },
          aspectRatio: 1.777
        },
        (decodedText) => {
          // Success! Stop scanner and lookup
          stopCameraScanner();
          toast.success(`Scanned: ${decodedText}`);
          setFormData(prev => ({ ...prev, barcode: decodedText, sku: decodedText }));
          lookupBarcode(decodedText);
        },
        () => {} // Ignore errors during scanning
      );
    } catch (err) {
      console.error('Camera error:', err);
      toast.error('Failed to start camera. Please check permissions.');
      setIsScanning(false);
      setScannerActive(false);
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
    setIsScanning(false);
    setScannerActive(false);
  };

  // ==========================================
  // FORM SUBMISSION
  // ==========================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.quantity <= 0) {
      toast.error('Please enter a quantity greater than 0');
      quantityInputRef.current?.focus();
      return;
    }

    if (entryState === 'CREATE' && !formData.item_name.trim()) {
      toast.error('Please enter an item name');
      return;
    }

    setIsLoading(true);
    const token = localStorage.getItem('token');

    try {
      if (entryState === 'FOUND' && existingItem) {
        // FOUND MODE: Use dedicated add-stock endpoint
        const response = await fetch(`${API_URL}/api/store/items/${encodeURIComponent(existingItem.sku)}/add-stock`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            quantity: formData.quantity,
            notes: formData.notes,
            reference: formData.notes
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.message || 'Failed to add stock');
        }

        const result = await response.json();
        const orderNum = result.orderNumber || result.data?.orderNumber;
        
        toast.success(
          <div className="space-y-1">
            <p className="font-semibold font-sf-pro-display">✓ Stock Added Successfully</p>
            <p className="text-sm">+{formData.quantity} units to "{formData.item_name}"</p>
            {orderNum && <p className="text-xs font-mono text-green-600">Order: {orderNum}</p>}
          </div>,
          { duration: 5000 }
        );
        
        setLastOrderNumber(orderNum);
      } else {
        // CREATE MODE: Use create item endpoint (SKU will be auto-generated)
        // Don't send SKU - let backend generate it
        const { sku: _sku, ...dataWithoutSku } = formData;
        
        const response = await fetch(`${API_URL}/api/store/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...dataWithoutSku,
            description: formData.description || formData.item_name
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.message || 'Failed to create item');
        }

        const result = await response.json();
        const newSku = result.data?.sku;
        const orderNum = result.data?.orderNumber;
        
        toast.success(
          <div className="space-y-1">
            <p className="font-semibold font-sf-pro-display">✓ Item Created Successfully</p>
            <p className="text-sm">"{formData.item_name}" with {formData.quantity} units</p>
            {newSku && <p className="text-xs font-mono text-blue-600">SKU: {newSku}</p>}
            {orderNum && <p className="text-xs font-mono text-green-600">Order: {orderNum}</p>}
          </div>,
          { duration: 5000 }
        );
        
        setLastOrderNumber(orderNum);
      }

      // Notify parent to refresh data
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(error instanceof Error ? error.message : 'Operation failed');
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // ROLE CHECK
  // ==========================================
  const isManager = true; // TODO: Get from auth context if needed

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto p-0">
        
        {/* CAMERA SCANNER OVERLAY */}
        {scannerActive && (
          <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg relative">
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                className="absolute right-3 top-3 z-10 bg-white/80 hover:bg-white"
                onClick={stopCameraScanner}
              >
                <X className="h-6 w-6" />
              </Button>
              
              <div className="text-center mb-4">
                <Camera className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
                <h3 className="text-lg font-semibold font-sf-pro-display">Scan Barcode</h3>
                <p className="text-sm text-gray-500">Point camera at product barcode</p>
              </div>
              
              <div id="barcode-reader" className="w-full overflow-hidden rounded-xl border-2 border-indigo-200"></div>
              
              <p className="text-center text-xs text-gray-400 mt-4">
                Supports: UPC, EAN, Code 128, Code 39
              </p>
            </div>
          </div>
        )}

        {/* HEADER */}
        <DialogHeader className="px-5 py-3 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
          <DialogTitle className="flex items-center gap-2 text-lg">
            {entryState === 'SCAN' && (
              <>
                <Scan className="h-6 w-6 text-indigo-600" />
                <span>Scan or Enter Item</span>
              </>
            )}
            {entryState === 'SEARCHING' && (
              <>
                <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
                <span>Searching...</span>
              </>
            )}
            {entryState === 'FOUND' && (
              <>
                <CheckCircle className="h-6 w-6 text-green-600" />
                <span>Add Stock to Existing Item</span>
              </>
            )}
            {entryState === 'CREATE' && (
              <>
                <PackagePlus className="h-6 w-6 text-orange-600" />
                <span>Create New Item</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          
          {/* ==========================================
              STEP 1: SCAN/SEARCH MODE
          ========================================== */}
          {(entryState === 'SCAN' || entryState === 'SEARCHING') && (
            <div className="space-y-4">
              {/* Main barcode input */}
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-4 rounded-xl border border-indigo-100">
                <div className="flex items-center gap-2 mb-3">
                  <Keyboard className="h-4 w-4 text-indigo-600" />
                  <Label className="text-sm font-semibold font-sf-pro-display text-indigo-900">
                    Scan Barcode or Enter SKU
                  </Label>
                </div>
                
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      ref={barcodeInputRef}
                      value={formData.barcode}
                      onChange={handleBarcodeInputChange}
                      onKeyDown={handleBarcodeKeyDown}
                      placeholder="Scan barcode or type SKU..."
                      className="h-11 text-base font-mono pl-3 pr-10 bg-white border-2 border-indigo-200 focus:border-indigo-500"
                      autoFocus
                      autoComplete="off"
                      disabled={entryState === 'SEARCHING'}
                    />
                    {entryState === 'SEARCHING' && (
                      <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 text-indigo-600 animate-spin" />
                    )}
                  </div>
                  
                  <Button 
                    type="button" 
                    size="icon"
                    className="h-14 w-14 bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => lookupBarcode(formData.barcode)}
                    disabled={entryState === 'SEARCHING' || !formData.barcode}
                  >
                    <Search className="h-6 w-6" />
                  </Button>
                  
                  <Button 
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-14 w-14 border-2"
                    onClick={startCameraScanner}
                    disabled={entryState === 'SEARCHING'}
                  >
                    <Camera className="h-6 w-6" />
                  </Button>
                </div>
                
                <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Keyboard className="h-4 w-4" />
                    Hardware scanner supported
                  </span>
                  <span>•</span>
                  <span>Press Enter to search</span>
                </div>
              </div>

            </div>
          )}

          {/* ==========================================
              STEP 2A: FOUND MODE - Quick Stock Entry
          ========================================== */}
          {entryState === 'FOUND' && existingItem && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Item Info Card - Compact */}
              <div className="bg-green-50 border border-green-200 rounded-ios-lg p-3">
                <div className="flex items-center gap-3">
                  <Package className="h-6 w-6 text-green-600" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold font-sf-pro-display text-green-900 truncate">
                      {existingItem.item_name || existingItem.description}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-gray-600 mt-1">
                      <span className="font-mono">{existingItem.sku}</span>
                      <span>Stock: <strong className="text-green-700">{existingItem.quantity}</strong></span>
                      <span>KSh {existingItem.retail_price?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quantity Entry - Compact */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-ios-lg p-4">
                <Label className="text-sm font-semibold font-sf-pro-display text-indigo-900 mb-2 block">Quantity to Add</Label>
                <div className="flex gap-3">
                  <Input
                    ref={quantityInputRef}
                    type="number"
                    min="1"
                    value={formData.quantity || ''}
                    onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                    className="w-28 h-12 text-2xl font-bold text-center bg-white border-2 border-indigo-300"
                    placeholder="0"
                    required
                  />
                  <Input
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="flex-1 h-12 bg-white"
                    placeholder="Invoice # (optional)"
                  />
                </div>
                <p className="text-xs text-indigo-600 mt-2">
                  New stock: <strong>{(existingItem.quantity || 0) + (formData.quantity || 0)}</strong>
                </p>
              </div>

              {/* Action Buttons - Compact */}
              <div className="flex justify-between pt-3 border-t">
                <Button type="button" variant="ghost" size="sm" onClick={resetToScanMode}>
                  ← Back
                </Button>
                <Button 
                  type="submit" 
                  size="sm"
                  disabled={isLoading || formData.quantity <= 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Add ${formData.quantity || 0} Units`}
                </Button>
              </div>
            </div>
          )}

          {/* ==========================================
              STEP 2B: CREATE MODE - New Item Form
          ========================================== */}
          {entryState === 'CREATE' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              
              {/* SKU Preview - Compact */}
              <div className="bg-blue-50 border border-blue-200 rounded-ios-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">SKU Preview:</span>
                  </div>
                  <code className="text-sm font-mono font-bold text-blue-800 bg-white px-2 py-1 rounded">
                    {skuPreview}
                  </code>
                </div>
              </div>

              {/* Item Details Form - Compact */}
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Item Name *</Label>
                  <Input 
                    value={formData.item_name} 
                    onChange={e => setFormData({...formData, item_name: e.target.value, description: e.target.value})}
                    placeholder="e.g., Tusker Lager 500ml"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Category *</Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={v => setFormData({...formData, category: v})}
                    >
                      <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map(cat => (
                          <SelectItem key={cat.code} value={cat.name}>
                            <span className="flex items-center gap-2">
                              <span className="font-mono text-xs bg-gray-100 px-1 rounded">{cat.code}</span>
                              {cat.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-sm">Unit</Label>
                    <Select 
                      value={formData.unit_of_measure} 
                      onValueChange={v => setFormData({...formData, unit_of_measure: v})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="piece">Piece</SelectItem>
                        <SelectItem value="bottle">Bottle</SelectItem>
                        <SelectItem value="kg">Kilogram</SelectItem>
                        <SelectItem value="litre">Litre</SelectItem>
                        <SelectItem value="box">Box/Carton</SelectItem>
                        <SelectItem value="packet">Packet</SelectItem>
                        <SelectItem value="portion">Portion</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Cost Price</Label>
                    <Input 
                      type="number" 
                      min="0"
                      value={formData.cost_price || ''} 
                      onChange={e => setFormData({...formData, cost_price: parseFloat(e.target.value) || 0})}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Selling Price *</Label>
                    <Input 
                      type="number" 
                      min="0"
                      step="0.01"
                      value={formData.retail_price || ''} 
                      onChange={e => setFormData({...formData, retail_price: parseFloat(e.target.value) || 0})}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

              </div>

              {/* Initial Stock - Compact */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-ios-lg p-3">
                <Label className="text-sm font-semibold font-sf-pro-display text-indigo-900 mb-2 block">Initial Stock *</Label>
                <div className="flex gap-3">
                  <Input
                    ref={quantityInputRef}
                    type="number"
                    min="1"
                    value={formData.quantity || ''}
                    onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                    className="w-24 h-10 text-xl font-bold text-center bg-white border-2 border-indigo-300"
                    placeholder="0"
                    required
                  />
                  <Input
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="flex-1 h-10 bg-white"
                    placeholder="Invoice # (optional)"
                  />
                </div>
              </div>

              {/* Action Buttons - Compact */}
              <div className="flex justify-between pt-3 border-t">
                <Button type="button" variant="ghost" size="sm" onClick={resetToScanMode}>
                  ← Back
                </Button>
                <Button 
                  type="submit" 
                  size="sm"
                  disabled={isLoading || formData.quantity <= 0 || !formData.item_name.trim()}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create & Add Stock'}
                </Button>
              </div>
            </div>
          )}

        </form>
      </DialogContent>
    </Dialog>
  );
}

