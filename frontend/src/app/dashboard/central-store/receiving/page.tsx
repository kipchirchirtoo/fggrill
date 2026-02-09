'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { storeAPI, procurementAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
    Barcode, Check, Search, Plus, Trash2, Save,
    AlertTriangle, Package, Loader2, ArrowLeft,
    ScanLine, ShoppingCart, Info, Minus, ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// Standard sound effects (using base64 or public URLs would be better, but simulating for now)
const playSuccessSound = () => {
    // In a real app, use a dedicated sound library or HTML5 Audio
    console.log('Beep! (Success)');
};

const playErrorSound = () => {
    console.log('Buzz! (Error)');
};

interface ScannedItem {
    id: string; // unique ID for key
    item_id: string;
    item_name: string;
    sku: string;
    unit: string;
    scanned_quantity: number;
    cost_price: number;
    po_item_id?: string; // If linked to PO
}

interface Supplier {
    id: string;
    name: string;
    code?: string;
}

export default function GoodsReceivingPage() {
    const router = useRouter();
    const { user } = useAuth();

    // Steps: 0 = Setup, 1 = Scanning, 2 = Review
    const [currentStep, setCurrentStep] = useState(0);

    // Setup State
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [deliveryNote, setDeliveryNote] = useState('');
    const [poNumber, setPoNumber] = useState('');
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
    const [selectedPO, setSelectedPO] = useState<any | null>(null);

    // Scanning State
    const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
    const [barcodeInput, setBarcodeInput] = useState('');
    const [lastScannedItem, setLastScannedItem] = useState<string | null>(null);
    const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const barcodeInputRef = useRef<HTMLInputElement>(null);

    // Item Lookup State
    const [isLookupOpen, setIsLookupOpen] = useState(false);
    const [unknownBarcode, setUnknownBarcode] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Loading States
    const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Catalog for manual selection
    const [allCatalogItems, setAllCatalogItems] = useState<any[]>([]);
    const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
    const [catalogSearch, setCatalogSearch] = useState('');

    // Fetch Suppliers on Mount
    useEffect(() => {
        const fetchSuppliers = async () => {
            setIsLoadingSuppliers(true);
            try {
                const res = await storeAPI.getSuppliers();
                if (res.success) setSuppliers(res.data || []);
            } catch (err) {
                toast.error('Failed to load suppliers');
            } finally {
                setIsLoadingSuppliers(false);
            }
        };
        fetchSuppliers();
    }, []);

    // Handle SKU, Supplier, and PO query params from other pages
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const skuParam = params.get('sku');
        const supplierIdParam = params.get('supplier_id');
        const poIdParam = params.get('po_id');

        const setupPO = async (id: string) => {
            try {
                const res = await procurementAPI.getPurchaseOrder(id);
                if (res.success && res.data) {
                    const po = res.data;
                    setSelectedPO(po);
                    // Find and set supplier from PO
                    if (suppliers.length > 0) {
                        const supplier = suppliers.find(s => s.id === po.supplier_id);
                        if (supplier) setSelectedSupplier(supplier);
                    }

                    // Pre-populate items if step 0 (starting fresh)
                    if (currentStep === 0 && po.items && po.items.length > 0) {
                        const itemsToPopulate = po.items.map((pi: any) => ({
                            id: Math.random().toString(36).substr(2, 9),
                            item_id: pi.item_id,
                            item_name: pi.item_name,
                            sku: pi.sku || pi.item_code,
                            unit: pi.unit || pi.unit_of_measure,
                            scanned_quantity: pi.quantity, // Pre-fill with ordered quantity or 0?
                            // Usually storekeepers want to verify, but user said "sync",
                            // let's pre-fill with ordered quantity to save time if they match.
                            cost_price: pi.unit_price || 0,
                            po_item_id: pi.id
                        }));
                        setScannedItems(itemsToPopulate);
                        setCurrentStep(1);
                        toast.success(`Loaded items from PO: ${po.po_number}`);

                        // Clear params from URL
                        const newUrl = window.location.pathname;
                        window.history.replaceState({}, '', newUrl);
                    }
                }
            } catch (err) {
                console.error('Failed to load PO:', err);
            }
        };

        // Handle PO ID (Priority)
        if (poIdParam && suppliers.length > 0 && !selectedPO) {
            setupPO(poIdParam);
        }

        // Handle Supplier ID (if no PO)
        if (supplierIdParam && suppliers.length > 0 && !selectedSupplier && !poIdParam) {
            const supplier = suppliers.find(s => s.id === supplierIdParam);
            if (supplier) {
                setSelectedSupplier(supplier);
            }
        }

        // Handle SKU (requires catalog loaded)
        if (skuParam && allCatalogItems.length > 0) {
            const item = allCatalogItems.find(i => i.sku === skuParam);
            if (item) {
                addItemToSession({
                    id: item.id,
                    name: item.item_name,
                    sku: item.sku,
                    unit: item.unit_of_measure
                });
                setCurrentStep(1);
                toast.success(`Started receiving: ${item.item_name}`);
                // Clear param from URL without reload
                const newUrl = window.location.pathname;
                window.history.replaceState({}, '', newUrl);
            }
        }
    }, [allCatalogItems, suppliers, selectedSupplier, selectedPO, currentStep]);

    // Fetch POs when supplier selected
    useEffect(() => {
        if (selectedSupplier) {
            const fetchPOs = async () => {
                try {
                    const res = await procurementAPI.getPurchaseOrders({
                        supplier_id: selectedSupplier.id,
                        status: 'approved'
                    });
                    if (res.success) setPurchaseOrders(res.data || []);
                } catch (err) {
                    console.error(err);
                }
            };
            fetchPOs();
        } else {
            setPurchaseOrders([]);
            setSelectedPO(null);
        }
    }, [selectedSupplier]);

    // Focus keeper for scanning
    useEffect(() => {
        if (currentStep === 1 && !isLookupOpen) {
            // Keep focus on input unless user is typing elsewhere
            const interval = setInterval(() => {
                if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                    barcodeInputRef.current?.focus();
                }
            }, 500);
            return () => clearInterval(interval);
        }
    }, [currentStep, isLookupOpen]);

    // Fetch Catalog for manual selection
    useEffect(() => {
        if (currentStep === 1 && allCatalogItems.length === 0) {
            const fetchCatalog = async () => {
                setIsLoadingCatalog(true);
                try {
                    const res = await storeAPI.getItems({ limit: 1000 });
                    if (res.success) setAllCatalogItems(res.data || []);
                } catch (err) {
                    console.error('Failed to load catalog');
                } finally {
                    setIsLoadingCatalog(false);
                }
            };
            fetchCatalog();
        }
    }, [currentStep, allCatalogItems.length]);

    // --- LOGIC: Setup ---

    const handleStartScanning = () => {
        if (!selectedSupplier) {
            toast.error('Please select a supplier');
            return;
        }
        // Invoice and Delivery Note are now optional per user request
        setCurrentStep(1);
    };

    // --- LOGIC: Scanning ---

    const handleBarcodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const barcode = barcodeInput.trim();
        if (!barcode) return;

        // 1. Check if barcode maps to an item
        try {
            // Search in existing scanned items first (optimization) or Master Catalog
            // Simplified: We always query backend or local cache for "Barcode -> SKU/ID" mapping
            // For now, assuming we search by SKU/Code in search API

            const res = await storeAPI.getItems({ search: barcode, limit: 1 });
            const item = res.data && res.data.length > 0 ? res.data[0] : null;

            if (item) {
                addItemToSession(item);
                setBarcodeInput('');
                setScanStatus('success');
                playSuccessSound();
                setTimeout(() => setScanStatus('idle'), 500);
            } else {
                // Unknown barcode
                setUnknownBarcode(barcode);
                setIsLookupOpen(true);
                setScanStatus('error');
                playErrorSound();
                setBarcodeInput('');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error verifying barcode');
        }
    };

    const addItemToSession = (item: any) => {
        setScannedItems(prev => {
            const existingIndex = prev.findIndex(i => i.item_id === item.id);
            if (existingIndex >= 0) {
                // Increment
                const updated = [...prev];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    scanned_quantity: updated[existingIndex].scanned_quantity + 1
                };
                setLastScannedItem(`${item.name} (+1)`);
                return updated;
            } else {
                // Add new
                const newItem: ScannedItem = {
                    id: Math.random().toString(36).substr(2, 9),
                    item_id: item.id,
                    item_name: item.name,
                    sku: item.sku || item.item_code,
                    unit: item.unit,
                    scanned_quantity: 1,
                    cost_price: 0 // Fetch from PO or previous cost
                };
                setLastScannedItem(`${item.name} (Added)`);
                return [...prev, newItem];
            }
        });
    };

    // Manual Lookup Handler
    const handleManualLookup = async () => {
        if (!searchQuery) return;
        setIsSearching(true);
        try {
            const res = await storeAPI.getItems({ search: searchQuery });
            setSearchResults(res.data || []);
        } catch (err) {
            toast.error('Search failed');
        } finally {
            setIsSearching(false);
        }
    };

    const selectItemFromLookup = (item: any) => {
        // Ideally we would map the barcode to this item permanently here
        // For now, we just add it to the session
        addItemToSession(item);
        setIsLookupOpen(false);
        setSearchQuery('');
        setSearchResults([]);
        setUnknownBarcode('');
        toast.success(`Identified as ${item.name}`);

        // Return focus to scanner
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
    };

    // --- LOGIC: Finalize ---

    const handleSubmitGRN = async () => {
        if (scannedItems.length === 0) {
            toast.error('No items scanned');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                po_id: selectedPO?.id,
                supplier_id: selectedSupplier?.id,
                grn_date: new Date().toISOString().split('T')[0],
                delivery_note_number: deliveryNote,
                invoice_number: invoiceNumber,
                items: scannedItems.map(item => ({
                    item_id: item.item_id,
                    quantity_received: item.scanned_quantity,
                    unit_price: item.cost_price,
                    quantity_ordered: 0, // Fill from PO if available
                    quantity_accepted: item.scanned_quantity, // Assume all good for now
                    quality_status: 'accepted'
                }))
            };

            const res = await procurementAPI.createGRN(payload);
            if (res.success) {
                toast.success('Goods Received Successfully');
                router.push('/dashboard/central-store/procurement/grn');
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to submit GRN');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user) return null;

    return (
        <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="max-w-5xl mx-auto space-y-6">

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Goods Receiving</h1>
                            <p className="text-sm text-stone-500">Scan items to verify delivery and update inventory</p>
                        </div>
                        {currentStep > 0 && (
                            <button
                                onClick={() => setCurrentStep(prev => prev - 1)}
                                className="btn-secondary"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back
                            </button>
                        )}
                    </div>

                    {/* STEP 0: SETUP */}
                    {currentStep === 0 && (
                        <div className="card-elevated p-6 max-w-2xl mx-auto">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Info className="h-5 w-5 text-blue-500" />
                                Delivery Details
                            </h2>

                            <div className="space-y-4">
                                {/* Supplier */}
                                <div>
                                    <label className="label">Supplier *</label>
                                    <select
                                        className="input-field"
                                        value={selectedSupplier?.id || ''}
                                        onChange={(e) => {
                                            const s = suppliers.find(sup => sup.id === e.target.value);
                                            setSelectedSupplier(s || null);
                                        }}
                                    >
                                        <option value="">Select Supplier</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* PO Select (Optional) */}
                                {purchaseOrders.length > 0 && (
                                    <div>
                                        <label className="label">Link to Purchase Order (Optional)</label>
                                        <select
                                            className="input-field"
                                            value={selectedPO?.id || ''}
                                            onChange={(e) => setSelectedPO(purchaseOrders.find(p => p.id === e.target.value) || null)}
                                        >
                                            <option value="">No PO (Direct Receive)</option>
                                            {purchaseOrders.map(po => (
                                                <option key={po.id} value={po.id}>{po.po_number} - {new Date(po.createdAt).toLocaleDateString()}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Doc Numbers */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Invoice Number</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            placeholder="e.g. INV-2024-001"
                                            value={invoiceNumber}
                                            onChange={e => setInvoiceNumber(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Delivery Note</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            placeholder="e.g. DO-9988"
                                            value={deliveryNote}
                                            onChange={e => setDeliveryNote(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end">
                                <button
                                    onClick={handleStartScanning}
                                    className="btn-primary w-full sm:w-auto"
                                >
                                    Start Scanning
                                    <ScanLine className="h-4 w-4 ml-2" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 1: SCANNING */}
                    {currentStep === 1 && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Left: Input Area */}
                            <div className="lg:col-span-2 space-y-6">

                                {/* Scanner Input */}
                                <div className={`card-elevated p-8 text-center transition-colors border-2 ${scanStatus === 'success' ? 'border-green-500 bg-green-50' :
                                    scanStatus === 'error' ? 'border-red-500 bg-red-50' : 'border-blue-500'
                                    }`}>
                                    <ScanLine className={`h-12 w-12 mx-auto mb-4 ${scanStatus === 'success' ? 'text-green-600' :
                                        scanStatus === 'error' ? 'text-red-600' : 'text-blue-500'
                                        }`} />
                                    <h2 className="text-xl font-bold mb-2">Ready to Scan</h2>
                                    <p className="text-stone-500 mb-6">Scan unit barcodes or select item manually</p>

                                    {/* Manual Selection Dropdown */}
                                    <div className="max-w-md mx-auto mb-6 text-left relative">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                            <input
                                                type="text"
                                                className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all shadow-sm"
                                                placeholder="Search & Select Item Manually..."
                                                value={catalogSearch}
                                                onChange={(e) => setCatalogSearch(e.target.value)}
                                            />
                                        </div>

                                        {catalogSearch && (
                                            <div className="absolute z-50 mt-1 w-full bg-white border border-stone-200 rounded-xl shadow-2xl max-h-[250px] overflow-y-auto divide-y divide-stone-50">
                                                {isLoadingCatalog ? (
                                                    <div className="p-4 text-center text-stone-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
                                                ) : allCatalogItems.filter(i =>
                                                    (i.item_name || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
                                                    (i.sku || '').toLowerCase().includes(catalogSearch.toLowerCase())
                                                ).length === 0 ? (
                                                    <div className="p-4 text-center text-stone-400 italic">No matching items</div>
                                                ) : (
                                                    allCatalogItems.filter(i =>
                                                        (i.item_name || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
                                                        (i.sku || '').toLowerCase().includes(catalogSearch.toLowerCase())
                                                    ).map(item => (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => {
                                                                addItemToSession({
                                                                    id: item.id,
                                                                    name: item.item_name,
                                                                    sku: item.sku,
                                                                    unit: item.unit_of_measure
                                                                });
                                                                setCatalogSearch('');
                                                                playSuccessSound();
                                                                setScanStatus('success');
                                                                setTimeout(() => setScanStatus('idle'), 500);
                                                            }}
                                                            className="w-full p-3 text-left hover:bg-stone-50 transition-colors flex items-center justify-between group"
                                                        >
                                                            <div>
                                                                <p className="font-semibold text-stone-900">{item.item_name}</p>
                                                                <p className="text-[10px] text-stone-400 uppercase tracking-tighter">{item.sku}</p>
                                                            </div>
                                                            <Plus className="h-4 w-4 text-stone-300 group-hover:text-blue-500" />
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <form onSubmit={handleBarcodeSubmit} className="max-w-md mx-auto relative">
                                        <input
                                            ref={barcodeInputRef}
                                            type="text"
                                            value={barcodeInput}
                                            onChange={(e) => setBarcodeInput(e.target.value)}
                                            className="w-full text-center text-2xl font-mono py-3 px-4 rounded-lg border focus:ring-4 focus:ring-blue-200 outline-none"
                                            placeholder="Click here & scan..."
                                            autoFocus
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            {scanStatus === 'success' && <Check className="h-6 w-6 text-green-500" />}
                                            {scanStatus === 'error' && <AlertTriangle className="h-6 w-6 text-red-500" />}
                                        </div>
                                    </form>

                                    {lastScannedItem && (
                                        <div className="mt-4 p-3 bg-white rounded-lg shadow-sm inline-block animate-in fade-in slide-in-from-bottom-2">
                                            <span className="font-medium text-stone-900">{lastScannedItem}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Scanned List */}
                                <div className="card-elevated overflow-hidden">
                                    <div className="p-4 bg-stone-50 border-b border-stone-100 flex justify-between items-center">
                                        <h3 className="font-semibold text-stone-800">Scanned Items ({scannedItems.reduce((a, b) => a + b.scanned_quantity, 0)})</h3>
                                        <div className="text-sm text-stone-500">
                                            {scannedItems.length} unique items
                                        </div>
                                    </div>
                                    <div className="divide-y divide-stone-100 max-h-[400px] overflow-y-auto">
                                        {scannedItems.length === 0 ? (
                                            <div className="p-8 text-center text-stone-400">
                                                No items scanned yet.
                                            </div>
                                        ) : (
                                            scannedItems.map((item, idx) => (
                                                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-stone-50">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 bg-stone-100 rounded-lg flex items-center justify-center">
                                                            <Package className="h-5 w-5 text-stone-500" />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-stone-900">{item.item_name}</p>
                                                            <p className="text-xs text-stone-500">SKU: {item.sku}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <div className="flex items-center bg-stone-100 rounded-lg p-1">
                                                            <button
                                                                onClick={() => {
                                                                    setScannedItems(prev => prev.map(i =>
                                                                        i.id === item.id ? { ...i, scanned_quantity: Math.max(1, i.scanned_quantity - 1) } : i
                                                                    ));
                                                                }}
                                                                className="p-1 hover:bg-white rounded-md transition-shadow"
                                                            >
                                                                <Minus className="h-3 w-3 text-stone-500" />
                                                            </button>
                                                            <input
                                                                type="number"
                                                                value={item.scanned_quantity}
                                                                onChange={(e) => {
                                                                    const val = parseInt(e.target.value) || 0;
                                                                    setScannedItems(prev => prev.map(i =>
                                                                        i.id === item.id ? { ...i, scanned_quantity: val } : i
                                                                    ));
                                                                }}
                                                                className="w-16 h-8 text-center text-lg font-bold font-mono text-blue-600 bg-white border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    setScannedItems(prev => prev.map(i =>
                                                                        i.id === item.id ? { ...i, scanned_quantity: i.scanned_quantity + 1 } : i
                                                                    ));
                                                                }}
                                                                className="p-1 hover:bg-white rounded-md transition-shadow"
                                                            >
                                                                <Plus className="h-3 w-3 text-stone-500" />
                                                            </button>
                                                        </div>
                                                        <button
                                                            onClick={() => setScannedItems(prev => prev.filter(i => i.id !== item.id))}
                                                            className="p-2 text-stone-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                            </div>

                            {/* Right: Summary & Action */}
                            <div className="space-y-6">
                                <div className="card-elevated p-6 sticky top-6">
                                    <h3 className="font-semibold text-lg mb-4">Receiving Summary</h3>

                                    <div className="space-y-3 mb-6 text-sm">
                                        <div className="flex justify-between py-2 border-b border-stone-100">
                                            <span className="text-stone-500">Supplier</span>
                                            <span className="font-medium">{selectedSupplier?.name}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-stone-100">
                                            <span className="text-stone-500">Invoice</span>
                                            <span className="font-medium">{invoiceNumber || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-stone-100">
                                            <span className="text-stone-500">Total Units</span>
                                            <span className="font-bold text-stone-900">{scannedItems.reduce((a, b) => a + b.scanned_quantity, 0)}</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSubmitGRN}
                                        disabled={scannedItems.length === 0 || isSubmitting}
                                        className="btn-primary w-full py-3 text-lg"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Check className="h-5 w-5 mr-2" />
                                                Complete Receiving
                                            </>
                                        )}
                                    </button>

                                    <p className="text-xs text-stone-400 mt-4 text-center">
                                        Strict scanning enabled. Inventory will be updated immediately upon completion.
                                    </p>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* UNKNOWN BARCODE DIALOG */}
                    <Dialog open={isLookupOpen} onOpenChange={setIsLookupOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Unknown Barcode: {unknownBarcode}</DialogTitle>
                            </DialogHeader>
                            <div className="py-4">
                                <p className="text-stone-600 mb-4">This barcode was not found in the cache. Search for the item to map manually.</p>

                                <div className="relative mb-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                    <input
                                        type="text"
                                        className="input-field pl-9"
                                        placeholder="Search item name or code..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()}
                                    />
                                </div>
                                <div className="flex justify-end mb-4">
                                    <button onClick={handleManualLookup} disabled={isSearching} className="btn-secondary btn-sm">
                                        {isSearching ? 'Searching...' : 'Search'}
                                    </button>
                                </div>

                                <div className="max-h-[200px] overflow-y-auto border rounded-md divide-y">
                                    {searchResults.map(res => (
                                        <div
                                            key={res.id}
                                            className="p-3 hover:bg-stone-50 cursor-pointer flex justify-between items-center"
                                            onClick={() => selectItemFromLookup(res)}
                                        >
                                            <div>
                                                <p className="font-medium text-sm">{res.name}</p>
                                                <p className="text-xs text-stone-400">{res.sku}</p>
                                            </div>
                                            <Plus className="h-4 w-4 text-blue-500" />
                                        </div>
                                    ))}
                                    {searchResults.length === 0 && searchQuery && !isSearching && (
                                        <div className="p-4 text-center text-gray-500 text-sm">No items found.</div>
                                    )}
                                </div>
                            </div>
                            <DialogFooter>
                                <button onClick={() => setIsLookupOpen(false)} className="btn-ghost">Cancel</button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
