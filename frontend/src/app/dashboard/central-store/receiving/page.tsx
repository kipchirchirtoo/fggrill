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
    ScanLine, ShoppingCart, Info, Minus, ChevronDown, Printer
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PYTHON_SERVICE_URL } from '@/lib/api/core';

// Standard sound effects (using base64 or public URLs would be better, but simulating for now)
const playSuccessSound = () => {
    // In a real app, use a dedicated sound library or HTML5 Audio
    // console.log('Beep! (Success)');
};

const playErrorSound = () => {
    // console.log('Buzz! (Error)');
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
    added_via: 'scan' | 'manual';
}

interface Supplier {
    id: string;
    name: string;
    code?: string;
}

interface NewItemDraft {
    item_name: string;
    category: string;
    unit_of_measure: string;
    cost_price: string;
    reorder_level: string;
    barcode: string;
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
    const [receivingMode, setReceivingMode] = useState<'scanner' | 'manual'>('scanner');
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
    const [newItemDraft, setNewItemDraft] = useState<NewItemDraft>({
        item_name: '',
        category: '',
        unit_of_measure: 'pcs',
        cost_price: '',
        reorder_level: '10',
        barcode: ''
    });
    const [isCreatingItem, setIsCreatingItem] = useState(false);
    const [isGeneratingBarcode, setIsGeneratingBarcode] = useState(false);

    // Fetch Suppliers on Mount
    useEffect(() => {
        const fetchSuppliers = async () => {
            setIsLoadingSuppliers(true);
            try {
                const res = await storeAPI.getSuppliers({ scope: 'global' });
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
                            scanned_quantity: Number(pi.quantity || pi.quantity_ordered) || 0,
                            cost_price: Number(pi.unit_price || pi.cost_price) || 0,
                            po_item_id: pi.id,
                            added_via: 'manual' as const
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
                    id: item.sku || item.id,
                    name: item.item_name,
                    sku: item.sku,
                    unit: item.unit_of_measure
                }, 'manual');
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
        if (currentStep === 1 && receivingMode === 'scanner' && !isLookupOpen) {
            // Keep focus on input unless user is typing elsewhere
            const interval = setInterval(() => {
                if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                    barcodeInputRef.current?.focus();
                }
            }, 500);
            return () => clearInterval(interval);
        }
    }, [currentStep, receivingMode, isLookupOpen]);

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

    useEffect(() => {
        if (isLookupOpen) {
            setNewItemDraft(prev => ({
                ...prev,
                barcode: unknownBarcode || prev.barcode,
                item_name: prev.item_name || searchQuery
            }));
        }
    }, [isLookupOpen, unknownBarcode, searchQuery]);

    const getItemLabel = useCallback((item: any) => item?.item_name || item?.name || item?.description || item?.sku || 'Unnamed Item', []);
    const getItemSku = useCallback((item: any) => item?.sku || item?.item_code || item?.item_id || item?.id || '', []);
    const getItemUnit = useCallback((item: any) => item?.unit || item?.unit_of_measure || 'piece', []);

    const printBarcodeLabel = useCallback((barcode: string, itemName: string) => {
        if (typeof window === 'undefined') return;
        const printWindow = window.open('', '_blank', 'width=420,height=640');
        if (!printWindow) {
            toast.error('Enable pop-ups to print barcode labels');
            return;
        }

        const barcodeUrl = `${PYTHON_SERVICE_URL}/api/barcode/barcode-image/${encodeURIComponent(barcode)}?format=code128&include_text=true`;
        printWindow.document.write(`
            <html>
                <head><title>${itemName} Barcode</title></head>
                <body style="font-family: Arial, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0;">
                    <div style="border:1px solid #d6d3d1; border-radius:12px; padding:24px; text-align:center; width:320px;">
                        <div style="font-size:18px; font-weight:700; margin-bottom:12px;">${itemName}</div>
                        <img src="${barcodeUrl}" alt="${barcode}" style="max-width:100%; height:auto; margin-bottom:12px;" />
                        <div style="font-size:14px; font-weight:600; letter-spacing:0.08em;">${barcode}</div>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 300);
    }, []);

    const generateUniqueBarcode = useCallback(async () => {
        const res = await storeAPI.generateBarcode({});
        const barcode = res.data?.barcode;
        if (!res.success || !barcode) {
            throw new Error(res.message || 'Failed to generate barcode');
        }
        return barcode;
    }, []);

    const ensureItemHasBarcode = useCallback(async (item: any, preferredBarcode?: string) => {
        if (item?.barcode) {
            return item;
        }

        const sku = getItemSku(item);
        if (!sku) {
            throw new Error('Unable to resolve item SKU');
        }

        const barcodeToAssign = preferredBarcode?.trim() || await generateUniqueBarcode();
        const updateRes = await storeAPI.updateItem(sku, { barcode: barcodeToAssign });
        if (!updateRes.success) {
            throw new Error(updateRes.message || 'Failed to assign barcode');
        }

        const itemName = getItemLabel(item);
        if (typeof window !== 'undefined' && window.confirm(`${itemName} now has barcode ${barcodeToAssign}. Print label now?`)) {
            printBarcodeLabel(barcodeToAssign, itemName);
        }

        return {
            ...item,
            ...(updateRes.data || {}),
            barcode: barcodeToAssign
        };
    }, [generateUniqueBarcode, getItemLabel, getItemSku, printBarcodeLabel]);

    const resetLookupState = useCallback(() => {
        setIsLookupOpen(false);
        setSearchQuery('');
        setSearchResults([]);
        setUnknownBarcode('');
        setNewItemDraft({
            item_name: '',
            category: '',
            unit_of_measure: 'pcs',
            cost_price: '',
            reorder_level: '10',
            barcode: ''

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

            const res = await storeAPI.getItems({ search: barcode, limit: 10 });
            const item = (res.data || []).find((candidate: any) => {
                const candidateBarcode = String(candidate?.barcode || '').trim().toLowerCase();
                const candidateSku = String(candidate?.sku || '').trim().toLowerCase();
                const needle = barcode.toLowerCase();
                return candidateBarcode === needle || candidateSku === needle;
            }) || null;

            if (item) {
                addItemToSession(item, 'scan');
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

    const addItemToSession = (item: any, via: 'scan' | 'manual' = 'manual') => {
        setScannedItems(prev => {
            const resolvedItemId = getItemSku(item);
            const existingIndex = prev.findIndex(i => i.item_id === resolvedItemId);
            if (existingIndex >= 0) {
                // Increment
                const updated = [...prev];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    scanned_quantity: updated[existingIndex].scanned_quantity + 1
                };
                setLastScannedItem(`${getItemLabel(item)} (+1)`);
                return updated;
            } else {
                // Add new
                const newItem: ScannedItem = {
                    id: Math.random().toString(36).substr(2, 9),
                    item_id: resolvedItemId,
                    item_name: getItemLabel(item),
                    sku: getItemSku(item),
                    unit: getItemUnit(item),
                    scanned_quantity: 1,
                    cost_price: Number(item.cost_price || item.unit_price || 0),
                    added_via: via
                };
                setLastScannedItem(`${getItemLabel(item)} (Added)`);
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

    const selectItemFromLookup = async (item: any) => {
        try {
            const preparedItem = await ensureItemHasBarcode(item, unknownBarcode || undefined);
            addItemToSession(preparedItem, 'manual');
            resetLookupState();
            toast.success(`Identified as ${getItemLabel(preparedItem)}`);
            setTimeout(() => barcodeInputRef.current?.focus(), 100);
        } catch (error: any) {
            toast.error(error.message || 'Failed to assign barcode to selected item');
        }
    };

    const handleGenerateDraftBarcode = async () => {
        setIsGeneratingBarcode(true);
        try {
            const barcode = await generateUniqueBarcode();
            setNewItemDraft(prev => ({ ...prev, barcode }));
            toast.success(`Generated barcode ${barcode}`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to generate barcode');
        } finally {
            setIsGeneratingBarcode(false);
        }
    };

    const handleCreateNewItem = async () => {
        if (!newItemDraft.item_name.trim()) {
            toast.error('Item name is required');
            return;
        }

        setIsCreatingItem(true);
        try {
            let category = newItemDraft.category.trim();
            let unit = newItemDraft.unit_of_measure.trim();

            if (!category || !unit) {
                const suggested = await storeAPI.suggestAttributes(newItemDraft.item_name.trim());
                if (suggested.success && suggested.data) {
                    category = category || suggested.data.category || 'other';
                    unit = unit || suggested.data.unit_of_measure || 'pcs';
                }
            }

            const barcode = newItemDraft.barcode.trim() || await generateUniqueBarcode();
            const createRes = await storeAPI.createItem({
                item_name: newItemDraft.item_name.trim(),
                description: newItemDraft.item_name.trim(),
                category: category || 'other',
                unit_of_measure: unit || 'pcs',
                cost_price: Number(newItemDraft.cost_price || 0),
                retail_price: Number(newItemDraft.cost_price || 0),
                reorder_level: Number(newItemDraft.reorder_level || 10),
                barcode,
                quantity: 0,
                supplier: selectedSupplier?.name || undefined
            });

            if (!createRes.success || !createRes.data) {
                throw new Error(createRes.message || 'Failed to create item');
            }

            addItemToSession(createRes.data, 'manual');
            resetLookupState();
            toast.success(`${getItemLabel(createRes.data)} created successfully`);

            if (typeof window !== 'undefined' && window.confirm(`Barcode ${barcode} is ready. Print label now?`)) {
                printBarcodeLabel(barcode, getItemLabel(createRes.data));
            }

            setTimeout(() => barcodeInputRef.current?.focus(), 100);
        } catch (error: any) {
            toast.error(error.message || 'Failed to create item');
        } finally {
            setIsCreatingItem(false);
        }
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
                    unit_of_measure: item.unit,
                    quantity_ordered: 0, // Fill from PO if available
                    quantity_accepted: item.scanned_quantity, // Assume all good for now
                    quality_status: 'accepted'
                }))
            };

            const res = await procurementAPI.createGRN(payload);
            if (res.success) {
                toast.success('Goods received and stock updated successfully!');
                // Redirect to inventory page instead of GRN list
                router.push('/dashboard/central-store/inventory');
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
        <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
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

                    {/* STEP 1: SCANNING/RECEIVING */}
                    {currentStep === 1 && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Left: Input Area */}
                            <div className="lg:col-span-2 space-y-6">

                                {/* Mode Toggle & Input */}
                                <div className={`card-elevated p-8 text-center transition-all border-2 relative overflow-hidden ${scanStatus === 'success' ? 'border-green-500 bg-green-50/30' :
                                    scanStatus === 'error' ? 'border-red-500 bg-red-50/30' : 'border-blue-500'
                                    }`}>
                                    
                                    {/* Sub-header with toggle */}
                                    <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
                                        <div className="text-left">
                                            <h2 className="text-xl font-bold text-stone-900">{receivingMode === 'scanner' ? 'Scanner Active' : 'Manual Item Entry'}</h2>
                                            <p className="text-sm text-stone-500">
                                                {receivingMode === 'scanner' 
                                                    ? 'Scan barcode directly or enter SKU manually' 
                                                    : 'Search and select items from store inventory'}
                                            </p>
                                        </div>
                                        <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 shadow-inner">
                                            <button
                                                onClick={() => setReceivingMode('scanner')}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                                    receivingMode === 'scanner' 
                                                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-stone-950/5' 
                                                        : 'text-stone-500 hover:text-stone-700'
                                                }`}
                                            >
                                                <Barcode className="h-4 w-4" />
                                                Scanner
                                            </button>
                                            <button
                                                onClick={() => setReceivingMode('manual')}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                                    receivingMode === 'manual' 
                                                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-stone-950/5' 
                                                        : 'text-stone-500 hover:text-stone-700'
                                                }`}
                                            >
                                                <Plus className="h-4 w-4" />
                                                Manual
                                            </button>
                                        </div>
                                    </div>

                                    {/* Scanner Mode Input */}
                                    {receivingMode === 'scanner' ? (
                                        <div className="max-w-md mx-auto space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                            <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                                <ScanLine className={`h-8 w-8 ${scanStatus === 'success' ? 'text-green-600' :
                                                    scanStatus === 'error' ? 'text-red-600' : 'text-blue-500'
                                                    }`} />
                                            </div>
                                            <form onSubmit={handleBarcodeSubmit} className="relative">
                                                <input
                                                    ref={barcodeInputRef}
                                                    type="text"
                                                    value={barcodeInput}
                                                    onChange={(e) => setBarcodeInput(e.target.value)}
                                                    className="w-full text-center text-3xl font-mono py-4 px-6 rounded-2xl border-2 focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm"
                                                    placeholder="Scan here..."
                                                    autoFocus
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                    {scanStatus === 'success' && <Check className="h-7 w-7 text-green-500 animate-bounce" />}
                                                    {scanStatus === 'error' && <AlertTriangle className="h-7 w-7 text-red-500" />}
                                                </div>
                                            </form>
                                            <p className="text-xs text-stone-400 font-medium uppercase tracking-widest">Awaiting Barcode Input</p>
                                        </div>
                                    ) : (
                                        /* Manual Mode Search */
                                        <div className="max-w-xl mx-auto space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
                                            <div className="relative">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
                                                <input
                                                    type="text"
                                                    className="w-full pl-12 pr-4 py-4 bg-white border-2 border-stone-200 rounded-2xl text-lg focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all shadow-inner"
                                                    placeholder="Search item by name or SKU..."
                                                    value={catalogSearch}
                                                    onChange={(e) => setCatalogSearch(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>

                                            {catalogSearch && (
                                                <div className="bg-white border-2 border-stone-100 rounded-2xl shadow-xl max-h-[300px] overflow-y-auto divide-y divide-stone-50">
                                                    {isLoadingCatalog ? (
                                                        <div className="p-8 text-center text-stone-400 flex flex-col items-center gap-2">
                                                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                                            <span className="text-sm font-medium">Searching Catalog...</span>
                                                        </div>
                                                    ) : (() => {
                                                        const filtered = allCatalogItems.filter(i =>
                                                            (i.item_name || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
                                                            (i.sku || '').toLowerCase().includes(catalogSearch.toLowerCase())
                                                        );

                                                        if (filtered.length === 0) {
                                                            return <div className="p-8 text-center text-stone-400 italic font-medium">No goods found matching "{catalogSearch}"</div>;
                                                        }

                                                        return filtered.map((item, idx) => (
                                                            <button
                                                                key={item.id || `catalog-${item.sku}-${idx}`}
                                                                onClick={() => {
                                                                    ensureItemHasBarcode(item)
                                                                        .then((preparedItem) => {
                                                                            addItemToSession(preparedItem, 'manual');
                                                                            setCatalogSearch('');
                                                                            playSuccessSound();
                                                                            setScanStatus('success');
                                                                            setTimeout(() => setScanStatus('idle'), 500);
                                                                        })
                                                                        .catch((error: any) => {
                                                                            toast.error(error.message || 'Failed to prepare item barcode');
                                                                        });
                                                                }}
                                                                className="w-full p-4 text-left hover:bg-blue-50 transition-colors flex items-center justify-between group"
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    <div className="h-12 w-12 bg-stone-100 rounded-xl flex items-center justify-center group-hover:bg-white transition-colors">
                                                                        <Package className="h-6 w-6 text-stone-500" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-bold text-stone-900 leading-tight">{item.item_name}</p>
                                                                        <div className="flex items-center gap-3 mt-1">
                                                                            <span className="text-xs font-mono bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded uppercase tracking-tighter">{item.sku}</span>
                                                                            <span className="text-xs text-stone-400">•</span>
                                                                            <span className="text-xs text-blue-600 font-semibold">{item.unit_of_measure}</span>
                                                                            <span className="text-xs text-stone-400">•</span>
                                                                            <span className="text-xs text-stone-500">Stock: <span className={item.current_stock > 0 ? 'text-green-600' : 'text-red-500'}>{item.current_stock || 0}</span></span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="bg-stone-50 p-2 rounded-full group-hover:bg-blue-500 transition-all">
                                                                    <Plus className="h-5 w-5 text-stone-400 group-hover:text-white" />
                                                                </div>
                                                            </button>
                                                        ));
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {lastScannedItem && (
                                        <div className="mt-6 p-4 bg-white border border-stone-100 rounded-xl shadow-sm inline-flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                                            <span className="text-sm font-semibold text-stone-900">Added: {lastScannedItem}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Scanned List */}
                                <div className="card-elevated overflow-hidden">
                                    <div className="p-4 bg-stone-50 border-b border-stone-100 flex justify-between items-center">
                                        <h3 className="font-semibold text-stone-800">Scanned Items ({scannedItems.reduce((a, b) => a + (Number(b.scanned_quantity) || 0), 0)})</h3>
                                        <div className="text-sm text-stone-500">
                                            {scannedItems.length} unique items
                                        </div>
                                    </div>
                                    <div className="divide-y divide-stone-100 max-h-[400px] overflow-y-auto">
                                        {scannedItems.length === 0 ? (
                                            <div className="p-12 text-center text-stone-400 flex flex-col items-center gap-3">
                                                <ShoppingCart className="h-12 w-12 text-stone-200" />
                                                <p className="font-medium">No items in receiving list yet.</p>
                                            </div>
                                        ) : (
                                            scannedItems.map((item) => (
                                                <div key={item.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-stone-50/50 transition-colors gap-4">
                                                    <div className="flex items-center gap-4 flex-1">
                                                        <div className="relative">
                                                            <div className="h-12 w-12 bg-stone-100 rounded-xl flex items-center justify-center text-stone-400">
                                                                <Package className="h-6 w-6" />
                                                            </div>
                                                            <div className={`absolute -top-1 -right-1 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${
                                                                item.added_via === 'scan' ? 'bg-blue-500' : 'bg-purple-500'
                                                            }`} title={item.added_via === 'scan' ? 'Added via Barcode' : 'Added Manually'}>
                                                                {item.added_via === 'scan' ? <Barcode className="h-3 w-3 text-white" /> : <Plus className="h-3 w-3 text-white" />}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-stone-900 leading-tight">{item.item_name}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-xs font-mono text-stone-400">{item.sku}</span>
                                                                <span className="h-1 w-1 bg-stone-200 rounded-full"></span>
                                                                <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                                                                    item.added_via === 'scan' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                                                                }`}>
                                                                    {item.added_via === 'scan' ? 'Barcode' : 'Manual'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex flex-wrap items-center gap-3 sm:gap-6 w-full sm:w-auto">
                                                        {/* Unit Selector */}
                                                        <div className="relative min-w-[100px]">
                                                            <select
                                                                value={item.unit}
                                                                onChange={(e) => {
                                                                    const unit = e.target.value;
                                                                    setScannedItems(prev => prev.map(i =>
                                                                        i.id === item.id ? { ...i, unit } : i
                                                                    ));
                                                                }}
                                                                className="w-full appearance-none bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm font-medium text-stone-700 pr-10 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                                            >
                                                                <option value="piece">Piece</option>
                                                                <option value="kg">Kilogram</option>
                                                                <option value="litre">Litre</option>
                                                                <option value="box">Box/Carton</option>
                                                                <option value="packet">Packet</option>
                                                                <option value="portion">Portion</option>
                                                                <option value="bottle">Bottle</option>
                                                                <option value={item.unit}>{item.unit}</option>
                                                            </select>
                                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                                                        </div>

                                                        {/* Quantity Controls */}
                                                        <div className="flex items-center bg-stone-100 rounded-xl p-1 border border-stone-200">
                                                            <button
                                                                onClick={() => {
                                                                    setScannedItems(prev => prev.map(i =>
                                                                        i.id === item.id ? { ...i, scanned_quantity: Math.max(1, i.scanned_quantity - 1) } : i
                                                                    ));
                                                                }}
                                                                className="h-8 w-8 flex items-center justify-center hover:bg-white rounded-lg transition-all shadow-none hover:shadow-sm"
                                                            >
                                                                <Minus className="h-4 w-4 text-stone-500" />
                                                            </button>
                                                            <input
                                                                type="number"
                                                                value={item.scanned_quantity}
                                                                onChange={(e) => {
                                                                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                                                                    setScannedItems(prev => prev.map(i =>
                                                                        i.id === item.id ? { ...i, scanned_quantity: val } : i
                                                                    ));
                                                                }}
                                                                className="w-16 h-8 text-center text-base font-bold font-mono text-blue-600 bg-transparent focus:outline-none"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    setScannedItems(prev => prev.map(i =>
                                                                        i.id === item.id ? { ...i, scanned_quantity: i.scanned_quantity + 1 } : i
                                                                    ));
                                                                }}
                                                                className="h-8 w-8 flex items-center justify-center hover:bg-white rounded-lg transition-all shadow-none hover:shadow-sm"
                                                            >
                                                                <Plus className="h-4 w-4 text-stone-500" />
                                                            </button>
                                                        </div>

                                                        <button
                                                            onClick={() => setScannedItems(prev => prev.filter(i => i.id !== item.id))}
                                                            className="p-2.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Remove Item"
                                                        >
                                                            <Trash2 className="h-5 w-5" />
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
                                            <span className="font-bold text-stone-900">{scannedItems.reduce((a, b) => a + (Number(b.scanned_quantity) || 0), 0)}</span>
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
                                <p className="text-stone-600 mb-4">This barcode was not found. Match an existing item or create a new one and continue receiving.</p>

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
                                            onClick={() => void selectItemFromLookup(res)}
                                        >
                                            <div>
                                                <p className="font-medium text-sm">{getItemLabel(res)}</p>
                                                <p className="text-xs text-stone-400">{res.sku}</p>
                                            </div>
                                            <Plus className="h-4 w-4 text-blue-500" />
                                        </div>
                                    ))}
                                    {searchResults.length === 0 && searchQuery && !isSearching && (
                                        <div className="p-4 text-center text-gray-500 text-sm">No items found.</div>
                                    )}
                                </div>

                                <div className="mt-6 border-t pt-4 space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-stone-900">Create New Item</p>
                                            <p className="text-xs text-stone-500">Use the scanned barcode or generate a unique store barcode.</p>
                                        </div>
                                        {newItemDraft.barcode ? (
                                            <button
                                                type="button"
                                                onClick={() => printBarcodeLabel(newItemDraft.barcode, newItemDraft.item_name || 'New Item')}
                                                className="btn-secondary btn-sm"
                                            >
                                                <Printer className="h-4 w-4 mr-2" />
                                                Print
                                            </button>
                                        ) : null}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <input
                                            type="text"
                                            className="input-field"
                                            placeholder="Item name"
                                            value={newItemDraft.item_name}
                                            onChange={(e) => setNewItemDraft(prev => ({ ...prev, item_name: e.target.value }))}
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="input-field"
                                            placeholder="Cost price"
                                            value={newItemDraft.cost_price}
                                            onChange={(e) => setNewItemDraft(prev => ({ ...prev, cost_price: e.target.value }))}
                                        />
                                        <select
                                            className="input-field"
                                            value={newItemDraft.category}
                                            onChange={(e) => setNewItemDraft(prev => ({ ...prev, category: e.target.value }))}
                                        >
                                            <option value="">Select category</option>
                                            <option value="food">Food</option>
                                            <option value="beverage">Beverage</option>
                                            <option value="toiletries">Toiletries</option>
                                            <option value="other">Other</option>
                                        </select>
                                        <select
                                            className="input-field"
                                            value={newItemDraft.unit_of_measure}
                                            onChange={(e) => setNewItemDraft(prev => ({ ...prev, unit_of_measure: e.target.value }))}
                                        >
                                            <option value="pcs">Pieces</option>
                                            <option value="kg">Kilogram</option>
                                            <option value="liters">Liters</option>
                                            <option value="packets">Packets</option>
                                            <option value="bottles">Bottles</option>
                                        </select>
                                        <input
                                            type="number"
                                            min="0"
                                            className="input-field"
                                            placeholder="Reorder level"
                                            value={newItemDraft.reorder_level}
                                            onChange={(e) => setNewItemDraft(prev => ({ ...prev, reorder_level: e.target.value }))}
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                className="input-field flex-1"
                                                placeholder="Barcode"
                                                value={newItemDraft.barcode}
                                                onChange={(e) => setNewItemDraft(prev => ({ ...prev, barcode: e.target.value }))}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => void handleGenerateDraftBarcode()}
                                                disabled={isGeneratingBarcode}
                                                className="btn-secondary whitespace-nowrap"
                                            >
                                                {isGeneratingBarcode ? 'Generating...' : 'Generate'}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => void handleCreateNewItem()}
                                        disabled={isCreatingItem}
                                        className="btn-primary w-full"
                                    >
                                        {isCreatingItem ? 'Creating...' : 'Create Item & Continue'}
                                    </button>
                                </div>
                            </div>
                            <DialogFooter>
                                <button onClick={resetLookupState} className="btn-ghost">Cancel</button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
