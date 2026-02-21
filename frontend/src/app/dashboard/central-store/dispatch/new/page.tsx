'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { storeAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
    ScanLine, ArrowLeft, Truck, User, Info, Check, AlertTriangle, Package, Loader2, X, Search, Plus
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// Helper for sound effects
const playSuccessSound = () => { console.log('Beep!'); };
const playErrorSound = () => { console.log('Buzz!'); };

interface ScannedDispatchItem {
    id: string; // unique ID for key
    item_id: string;
    item_name: string;
    sku: string;
    unit: string;
    scanned_quantity: number;
    available_stock: number;
}

interface Branch { id: number; name: string; }
interface Vehicle { id: string; registration_number: string; model: string; }
interface Driver { id: string; name: string; }

export default function NewDispatchPage() {
    const router = useRouter();
    const { user } = useAuth();

    // Steps: 0 = Setup, 1 = Scanning
    const [currentStep, setCurrentStep] = useState(0);

    // Setup State
    const [branches, setBranches] = useState<Branch[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);

    // Form Data
    const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('');
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [selectedDriverId, setSelectedDriverId] = useState('');
    const [notes, setNotes] = useState('');

    // Scanning State
    const [scannedItems, setScannedItems] = useState<ScannedDispatchItem[]>([]);
    const [barcodeInput, setBarcodeInput] = useState('');
    const [lastScannedItem, setLastScannedItem] = useState<{ name: string, status: 'success' | 'warn' | 'error' } | null>(null);
    const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const barcodeInputRef = useRef<HTMLInputElement>(null);

    // Item Lookup
    const [isLookupOpen, setIsLookupOpen] = useState(false);
    const [unknownBarcode, setUnknownBarcode] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    // Loading
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);

    // Master Catalog Data
    const [allCatalogItems, setAllCatalogItems] = useState<any[]>([]);
    const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
    const [catalogSearch, setCatalogSearch] = useState('');

    // Fetch Initial Data
    useEffect(() => {
        const fetchInitData = async () => {
            setIsLoadingData(true);
            try {
                const [branchRes, vehRes, driverRes] = await Promise.all([
                    storeAPI.getBranches(),
                    storeAPI.getVehicles(),
                    storeAPI.getDrivers()
                ]);
                if (branchRes.success) setBranches(branchRes.data || []);
                if (vehRes.success) setVehicles(vehRes.data || []);
                if (driverRes.success) setDrivers(driverRes.data || []);
            } catch (err) {
                toast.error('Failed to load initial data');
            } finally {
                setIsLoadingData(false);
            }
        };

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

        fetchInitData();
        fetchCatalog();
    }, []);

    // Focus keeper
    useEffect(() => {
        if (currentStep === 1 && !isLookupOpen) {
            const interval = setInterval(() => {
                if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                    barcodeInputRef.current?.focus();
                }
            }, 500);
            return () => clearInterval(interval);
        }
    }, [currentStep, isLookupOpen]);

    // --- SETUP LOGIC ---
    const handleStartScanning = () => {
        if (!selectedBranchId) { toast.error('Select a destination branch'); return; }
        // Driver/Vehicle optional for now, but recommended
        setCurrentStep(1);
    };

    // --- SCANNING LOGIC ---
    const handleBarcodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const barcode = barcodeInput.trim();
        if (!barcode) return;

        try {
            // Find item by barcode/sku
            const res = await storeAPI.getItems({ search: barcode, limit: 1 });
            const item = res.data && res.data.length > 0 ? res.data[0] : null;

            if (item) {
                processItemScan(item);
                setBarcodeInput('');
            } else {
                setUnknownBarcode(barcode);
                setIsLookupOpen(true);
                setScanStatus('error');
                playErrorSound();
                setBarcodeInput('');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const processItemScan = (item: any) => {
        // Validate Stock
        const currentScanned = scannedItems.find(i => i.item_id === item.id)?.scanned_quantity || 0;
        const available = item.stock_quantity || item.current_stock || 0; // Adjust based on API response structure

        // Strict Check: Cannot scan more than available
        if (currentScanned + 1 > available) {
            setScanStatus('error');
            setLastScannedItem({ name: `Insufficient Stock: ${item.name}`, status: 'error' });
            playErrorSound();
            toast.error(`Cannot add ${item.name}. Only ${available} available.`);
            return;
        }

        addItemToSession(item, available);
        setScanStatus('success');
        setLastScannedItem({ name: `${item.name} (+1)`, status: 'success' });
        playSuccessSound();
        setTimeout(() => setScanStatus('idle'), 500);
    };

    const addItemToSession = (item: any, available: number) => {
        setScannedItems(prev => {
            const idx = prev.findIndex(i => i.item_id === item.id);
            if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], scanned_quantity: updated[idx].scanned_quantity + 1 };
                return updated;
            } else {
                return [...prev, {
                    id: Math.random().toString(36).substr(2, 9),
                    item_id: item.id,
                    item_name: item.name,
                    sku: item.sku || item.item_code,
                    unit: item.unit,
                    scanned_quantity: 1,
                    available_stock: available
                }];
            }
        });
    };

    // --- MANUAL LOOKUP ---
    const handleManualLookup = async () => {
        if (!searchQuery) return;
        setIsSearching(true);
        try {
            const res = await storeAPI.getItems({ search: searchQuery });
            setSearchResults(res.data || []);
        } catch (err) { toast.error('Search failed'); }
        finally { setIsSearching(false); }
    };

    const selectItemFromLookup = (item: any) => {
        // We need to fetch full details including stock before adding
        setIsSearching(true);
        storeAPI.getItem(item.id).then((res) => {
            if (res.success && res.data) {
                processItemScan(res.data);
                setIsLookupOpen(false);
                setSearchQuery('');
                setSearchResults([]);
                toast.success(`Identified: ${item.name}`);
            }
        }).finally(() => setIsSearching(false));
    };

    // --- SUBMISSION ---
    const handleSubmitDispatch = async () => {
        if (scannedItems.length === 0) return;
        setIsSubmitting(true);
        try {
            const payload = {
                to_branch_id: Number(selectedBranchId),
                vehicle_id: selectedVehicleId || undefined,
                driver_id: selectedDriverId || undefined,
                items: scannedItems.map(item => ({
                    item_sku: item.sku,
                    dispatched_quantity: item.scanned_quantity
                })),
                notes: notes,
                // Assuming status defaults to 'READY' or 'IN_TRANSIT' depending on backend
            };

            const res = await storeAPI.createDispatch(payload);
            if (res.success) {
                toast.success('Dispatch Created Successfully');
                router.push('/dashboard/central-store/dispatch');
            } else {
                toast.error(res.message || 'Failed to create dispatch');
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to create dispatch');
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
                            <h1 className="text-2xl font-bold text-stone-900">New Dispatch</h1>
                            <p className="text-sm text-stone-500">Scan items to dispatch to branch</p>
                        </div>
                        {currentStep > 0 && (
                            <button onClick={() => setCurrentStep(prev => prev - 1)} className="btn-secondary">
                                <ArrowLeft className="h-4 w-4 mr-2" /> Back
                            </button>
                        )}
                    </div>

                    {/* STEP 0: DETAILS */}
                    {currentStep === 0 && (
                        <div className="card-elevated p-6 max-w-2xl mx-auto">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Truck className="h-5 w-5 text-blue-500" /> Dispatch Details
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="label">Destination Branch *</label>
                                    <select
                                        className="input-field"
                                        value={selectedBranchId}
                                        onChange={e => setSelectedBranchId(Number(e.target.value))}
                                    >
                                        <option value="">Select Branch</option>
                                        {branches.filter(b => b.id !== user.branch_id).map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Vehicle</label>
                                        <select
                                            className="input-field"
                                            value={selectedVehicleId}
                                            onChange={e => setSelectedVehicleId(e.target.value)}
                                        >
                                            <option value="">Select Vehicle</option>
                                            {vehicles.map(v => (
                                                <option key={v.id} value={v.id}>{v.registration_number} ({v.model})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Driver</label>
                                        <select
                                            className="input-field"
                                            value={selectedDriverId}
                                            onChange={e => setSelectedDriverId(e.target.value)}
                                        >
                                            <option value="">Select Driver</option>
                                            {drivers.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="label">Notes</label>
                                    <textarea
                                        className="input-field min-h-[80px]"
                                        placeholder="Optional notes..."
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="mt-8 flex justify-end">
                                <button onClick={handleStartScanning} className="btn-primary">
                                    Start Scanning <ScanLine className="h-4 w-4 ml-2" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 1: SCANNING */}
                    {currentStep === 1 && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left: Scanner */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className={`card-elevated p-8 text-center border-2 transition-colors ${scanStatus === 'success' ? 'border-green-500 bg-green-50' :
                                    scanStatus === 'error' ? 'border-red-500 bg-red-50' : 'border-blue-500'
                                    }`}>
                                    <ScanLine className={`h-12 w-12 mx-auto mb-4 ${scanStatus === 'success' ? 'text-green-600' :
                                        scanStatus === 'error' ? 'text-red-600' : 'text-blue-500'
                                        }`} />
                                    <h2 className="text-xl font-bold mb-2">Scan to Dispatch</h2>
                                    <p className="text-stone-500 mb-6">Stock is validated immediately</p>

                                    <div className="max-w-md mx-auto mb-6 relative">
                                        <div className="relative mb-2">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                            <input
                                                type="text"
                                                placeholder="Search master catalog..."
                                                value={catalogSearch}
                                                onChange={(e) => setCatalogSearch(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                                            />
                                            {catalogSearch && (
                                                <div className="absolute z-50 mt-1 w-full bg-white border border-stone-200 rounded-xl shadow-2xl max-h-[250px] overflow-y-auto divide-y divide-stone-50 text-left">
                                                    {allCatalogItems
                                                        .filter(i =>
                                                            i.item_name?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                                                            i.sku?.toLowerCase().includes(catalogSearch.toLowerCase())
                                                        )
                                                        .slice(0, 10)
                                                        .map(item => (
                                                            <button
                                                                key={item.id}
                                                                onClick={() => {
                                                                    processItemScan(item);
                                                                    setCatalogSearch('');
                                                                }}
                                                                className="w-full p-3 hover:bg-stone-50 transition-colors flex items-center justify-between group"
                                                            >
                                                                <div>
                                                                    <p className="font-semibold text-stone-900">{item.item_name}</p>
                                                                    <p className="text-[10px] text-stone-400 uppercase tracking-tighter">
                                                                        {item.sku} | Stock: {item.stock_quantity || item.current_stock || 0}
                                                                    </p>
                                                                </div>
                                                                <Plus className="h-4 w-4 text-stone-300 group-hover:text-blue-500" />
                                                            </button>
                                                        ))}
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-[10px] uppercase font-bold text-stone-300 mb-2">OR SCAN BARCODE</p>

                                        <form onSubmit={handleBarcodeSubmit} className="relative">
                                            <input
                                                ref={barcodeInputRef}
                                                type="text"
                                                value={barcodeInput}
                                                onChange={e => setBarcodeInput(e.target.value)}
                                                className="w-full text-center text-2xl font-mono py-3 px-4 rounded-lg border focus:ring-4 focus:ring-blue-200 outline-none"
                                                placeholder="Scan barcode..."
                                            />
                                        </form>
                                    </div>
                                    {lastScannedItem && (
                                        <div className={`mt-4 p-3 rounded-lg shadow-sm inline-block ${lastScannedItem.status === 'error' ? 'bg-red-100 text-red-800' : 'bg-white text-stone-900'
                                            }`}>
                                            <span className="font-medium">{lastScannedItem.name}</span>
                                        </div>
                                    )}
                                </div>

                                {/* List */}
                                <div className="card-elevated">
                                    <div className="p-4 border-b border-stone-100 flex justify-between items-center">
                                        <h3 className="font-semibold text-stone-800">Dispatched Items</h3>
                                        <span className="text-sm text-stone-500">{scannedItems.length} items</span>
                                    </div>
                                    <div className="divide-y divide-stone-100 max-h-[400px] overflow-y-auto">
                                        {scannedItems.map(item => (
                                            <div key={item.id} className="p-4 flex justify-between items-center hover:bg-stone-50">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 bg-stone-100 rounded-lg flex items-center justify-center">
                                                        <Package className="h-5 w-5 text-stone-500" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">{item.item_name}</p>
                                                        <p className="text-xs text-stone-500">SKU: {item.sku} | Stock: {item.available_stock}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center bg-stone-100 rounded-lg p-1 border border-stone-200">
                                                        <button
                                                            onClick={() => {
                                                                if (item.scanned_quantity > 1) {
                                                                    setScannedItems(prev => prev.map(i =>
                                                                        i.id === item.id ? { ...i, scanned_quantity: i.scanned_quantity - 1 } : i
                                                                    ));
                                                                } else {
                                                                    setScannedItems(prev => prev.filter(i => i.id !== item.id));
                                                                }
                                                            }}
                                                            className="p-1.5 hover:bg-white rounded text-stone-500 transition-all active:scale-95"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            value={item.scanned_quantity}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value) || 0;
                                                                const finalVal = Math.min(val, item.available_stock);
                                                                if (val > item.available_stock) {
                                                                    toast.error(`Only ${item.available_stock} available`);
                                                                }
                                                                setScannedItems(prev => prev.map(i =>
                                                                    i.id === item.id ? { ...i, scanned_quantity: finalVal } : i
                                                                ));
                                                            }}
                                                            className="w-16 h-8 text-center text-lg font-bold font-mono text-blue-600 bg-white border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                if (item.scanned_quantity < item.available_stock) {
                                                                    setScannedItems(prev => prev.map(i =>
                                                                        i.id === item.id ? { ...i, scanned_quantity: i.scanned_quantity + 1 } : i
                                                                    ));
                                                                } else {
                                                                    toast.error(`Only ${item.available_stock} available`);
                                                                }
                                                            }}
                                                            className="p-1.5 hover:bg-white rounded text-stone-500 transition-all active:scale-95"
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                    <div className="text-right min-w-[60px]">
                                                        <p className="text-[10px] uppercase text-stone-400 font-bold">{item.unit}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {scannedItems.length === 0 && <div className="p-8 text-center text-stone-400">No items scanned.</div>}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Summary */}
                            <div className="space-y-6">
                                <div className="card-elevated p-6 sticky top-6">
                                    <h3 className="font-semibold text-lg mb-4">Dispatch Summary</h3>
                                    <div className="space-y-3 mb-6 text-sm">
                                        <div className="flex justify-between py-2 border-b">
                                            <span className="text-stone-500">To Branch</span>
                                            <span className="font-medium">{branches.find(b => b.id === selectedBranchId)?.name}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b">
                                            <span className="text-stone-500">Total Items</span>
                                            <span className="font-bold">{scannedItems.reduce((a, b) => a + b.scanned_quantity, 0)}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleSubmitDispatch}
                                        disabled={scannedItems.length === 0 || isSubmitting}
                                        className="btn-primary w-full py-3 text-lg"
                                    >
                                        {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : <Check className="h-5 w-5 mr-2" />}
                                        Create Dispatch
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Dialogs would go here (same as receiving) */}
                    <Dialog open={isLookupOpen} onOpenChange={setIsLookupOpen}>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Unknown Barcode</DialogTitle></DialogHeader>
                            <div className="py-4 space-y-4">
                                <p className="text-stone-500">Item not found. Search manually:</p>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                                    <input
                                        className="input-field pl-9"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Search item..."
                                        onKeyDown={e => e.key === 'Enter' && handleManualLookup()}
                                    />
                                </div>
                                <button onClick={handleManualLookup} className="btn-secondary w-full">Search</button>
                                <div className="max-h-[200px] overflow-y-auto border rounded divide-y">
                                    {searchResults.map((item: any) => (
                                        <div key={item.id} onClick={() => selectItemFromLookup(item)} className="p-3 hover:bg-stone-50 cursor-pointer flex justify-between">
                                            <span>{item.name}</span>
                                            <Plus className="h-4 w-4 text-blue-500" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
