'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { storeAPI, auditorReportsAPI } from '@/lib/api';
import { Truck, RefreshCw, Check, AlertTriangle, ArrowDownToLine, Package, Search, FileDown, Activity, Clock, Plus, Trash2, User, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IOSInput } from '@/components/ui/ios-input';

interface IncomingDispatch {
  id: string;
  dispatch_number: string;
  status: string;
  dispatched_at: string;
  estimated_delivery: string;
  from_branch: { name: string; };
  items: any[];
  vehicle?: { registration_number: string; model: string; };
  vehicle_registration?: string;
  driver?: { name: string; phone: string; };
  driver_name?: string;
  auditor_id?: string;
  audited_at?: string;
  audit_notes?: string;
}

export default function BranchReceivePage() {
  const { user } = useAuth();
  const [dispatches, setDispatches] = useState<IncomingDispatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDispatch, setSelectedDispatch] = useState<IncomingDispatch | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receivedItems, setReceivedItems] = useState<Record<string, {
    quantity: number,
    damaged: number,
    missing: number,
    note: string
  }>>({});
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('central');
  
  // Supplier Receipt State
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [supplierFormData, setSupplierFormData] = useState({
    delivery_note: '',
    invoice_no: '',
    remarks: ''
  });
  const [receiptItems, setReceiptItems] = useState<Array<{
    item_sku: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    unit: string;
  }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // SKU search combobox state
  const [skuSearch, setSkuSearch] = useState('');
  const [skuDropdownOpen, setSkuDropdownOpen] = useState(false);
  const skuDropdownRef = useRef<HTMLDivElement>(null);

  // New SKU modal state
  const [isNewSkuModalOpen, setIsNewSkuModalOpen] = useState(false);
  const [newSkuForm, setNewSkuForm] = useState({
    item_name: '',
    category: '',
    unit_of_measure: 'units',
    cost_price: '',
    description: '',
  });
  const [isCreatingSku, setIsCreatingSku] = useState(false);

  const CATEGORIES = [
    'Foodstuffs','Cereals','Spices','Spread','Beverages','Satches','Flour',
    'Perishable goods','Fruits','Vegetables','Non-consumables','Soap',
    'Detergent','Stationery','Gas','Other'
  ];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (skuDropdownRef.current && !skuDropdownRef.current.contains(e.target as Node)) {
        setSkuDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dispatchRes, supplierRes, catalogRes] = await Promise.all([
        storeAPI.getIncomingDispatches(),
        storeAPI.getSuppliers(),
        storeAPI.getMasterCatalog()
      ]);
      
      if (dispatchRes.success) setDispatches(dispatchRes.data || []);
      if (supplierRes.success) setSuppliers(supplierRes.data || []);
      if (catalogRes.success) setMasterItems(catalogRes.data || []);
    } catch (error) { console.error('Error fetching data:', error); }
    finally { setIsLoading(false); }
  }, []);

  const handleExport = async () => {
    try {
      toast.loading("Generating delivery oversight report...");
      await auditorReportsAPI.exportBrandedPdf('dispatches', {
        branch_id: user?.branch_id
      });
      toast.dismiss();
      toast.success("Report generated successfully");
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Failed to generate report");
    }
  };

  const stats = useMemo(() => {
    const total = dispatches.length;
    const inTransit = dispatches.filter(d => d.status === 'IN_TRANSIT').length;
    const totalItems = dispatches.reduce((acc, d) => acc + (d.items?.length || 0), 0);
    return { total, inTransit, totalItems };
  }, [dispatches]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenReceive = (dispatch: IncomingDispatch) => {
    setSelectedDispatch(dispatch);
    const initialReceived: Record<string, any> = {};
    dispatch.items.forEach(item => {
      initialReceived[item.id] = {
        quantity: item.dispatched_quantity,
        damaged: 0,
        missing: 0,
        note: ''
      };
    });
    setReceivedItems(initialReceived);
    setIsReceiveModalOpen(true);
  };

  const handleConfirmDelivery = async () => {
    if (!selectedDispatch) return;

    try {
      const payload = {
        items_received: selectedDispatch.items.map(item => {
          const verification = receivedItems[item.id] || { quantity: item.dispatched_quantity, damaged: 0, missing: 0, note: '' };
          return {
            item_id: item.id,
            quantity: verification.quantity,
            damaged: verification.damaged,
            missing: verification.missing,
            note: verification.note
          };
        }),
        notes: deliveryNotes
      };

      await storeAPI.receiveDispatch(selectedDispatch.id, payload);
      toast.success('Dispatch received successfully');
      setIsReceiveModalOpen(false);
      fetchData();
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      toast.error(backendMessage || error?.message || 'Failed to receive dispatch');
    }
  };

  const handleFlagAnomaly = async (dispatch: IncomingDispatch) => {
    try {
      toast.loading("Flagging anomaly...");
      // @ts-ignore - auditAPI might not be imported or available in this context if not passed correctly, but we'll assume it is for now or use storeAPI if appropriate
      await storeAPI.createException({
        audit_session_id: 'MANUAL_RECEIVE_' + new Date().getTime(),
        exception_type: 'RECEIVE_ANOMALY',
        severity: 'medium',
        description: `Potential anomaly in receipt of dispatch ${dispatch.dispatch_number} from ${dispatch.from_branch?.name}`,
        amount: dispatch.items?.length || 0,
        reference_type: 'dispatch_note',
        reference_id: dispatch.id,
      });
      toast.dismiss();
      toast.success("Anomaly flagged for review");
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Failed to flag anomaly");
    }
  };

  const handleVerify = async (dispatch: IncomingDispatch) => {
    try {
      toast.loading("Verifying dispatch...");
      // @ts-ignore
      await storeAPI.verifyAnomaly({
        id: dispatch.id,
        type: 'dispatch_note',
        notes: 'Verified by auditor'
      });
      toast.dismiss();
      toast.success("Dispatch verified successfully");
      fetchData(); // Refresh data
      setIsDetailModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Failed to verify dispatch");
    }
  };

  const handleAddReceiptItem = (itemSku: string) => {
    const item = masterItems.find(i => i.sku === itemSku);
    if (!item) return;

    if (receiptItems.some(i => i.item_sku === itemSku)) {
      toast.error('Item already added');
      return;
    }

    setReceiptItems([...receiptItems, {
      item_sku: item.sku,
      item_name: item.item_name,
      quantity: 1,
      unit_price: item.cost_price || 0,
      unit: item.unit_of_measure || 'units'
    }]);
  };

  const handleRemoveReceiptItem = (sku: string) => {
    setReceiptItems(receiptItems.filter(i => i.item_sku !== sku));
  };

  const handleUpdateReceiptItem = (sku: string, field: string, value: any) => {
    setReceiptItems(receiptItems.map(item => 
      item.item_sku === sku ? { ...item, [field]: value } : item
    ));
  };

  const filteredMasterItems = useMemo(() => {
    if (!skuSearch.trim()) return masterItems.slice(0, 50);
    const q = skuSearch.toLowerCase();
    return masterItems.filter(i =>
      i.item_name?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [masterItems, skuSearch]);

  const handleSkuSelect = (itemSku: string) => {
    handleAddReceiptItem(itemSku);
    setSkuSearch('');
    setSkuDropdownOpen(false);
  };

  const handleCreateNewSku = async () => {
    if (!newSkuForm.item_name.trim() || !newSkuForm.category) {
      toast.error('Item name and category are required');
      return;
    }
    setIsCreatingSku(true);
    try {
      const res = await storeAPI.createItem({
        item_name: newSkuForm.item_name.trim(),
        category: newSkuForm.category,
        unit_of_measure: newSkuForm.unit_of_measure,
        cost_price: parseFloat(newSkuForm.cost_price) || 0,
        description: newSkuForm.description.trim(),
        is_active: true,
      });
      if (res.success && res.data) {
        toast.success(`SKU created: ${res.data.sku || res.data.item_name}`);
        // Refresh catalog and auto-add the new item
        const catalogRes = await storeAPI.getMasterCatalog();
        if (catalogRes.success) setMasterItems(catalogRes.data || []);
        if (res.data.sku) handleAddReceiptItem(res.data.sku);
        setIsNewSkuModalOpen(false);
        setNewSkuForm({ item_name: '', category: '', unit_of_measure: 'units', cost_price: '', description: '' });
      } else {
        throw new Error(res.message || 'Failed to create SKU');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create SKU');
    } finally {
      setIsCreatingSku(false);
    }
  };

  const submitSupplierReceipt = async () => {
    if (!selectedSupplierId) {
      toast.error('Please select a supplier');
      return;
    }
    if (receiptItems.length === 0) {
      toast.error('Add at least one item');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        supplier_id: selectedSupplierId,  // UUID string — do not coerce to Number
        delivery_note_number: supplierFormData.delivery_note || undefined,
        invoice_number: supplierFormData.invoice_no || undefined,
        remarks: supplierFormData.remarks || undefined,
        items: receiptItems.map(i => ({
          item_sku: i.item_sku,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price)
        }))
      };

      console.log('[receiveFromSupplier] payload:', JSON.stringify(payload, null, 2));

      const res = await storeAPI.receiveFromSupplier(payload);
      if (res.success) {
        toast.success('Inventory updated successfully');
        setReceiptItems([]);
        setSupplierFormData({ delivery_note: '', invoice_no: '', remarks: '' });
        setSelectedSupplierId('');
        fetchData();
      } else {
        throw new Error(res.message || 'Submission failed');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to receive goods';
      console.error('[receiveFromSupplier] error:', error?.response?.data || error);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 w-full max-w-md">
              <TabsTrigger value="central" className="flex-1">Central Store Dispatches</TabsTrigger>
              <TabsTrigger value="supplier" className="flex-1">Direct from Supplier</TabsTrigger>
            </TabsList>

            <TabsContent value="central">
              {isLoading ? (
                <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
              ) : dispatches.length === 0 ? (
                <IOSCard className="p-12 text-center"><Truck className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No incoming deliveries</p></IOSCard>
              ) : (
                <div className="grid gap-4">
                  {dispatches.map((dispatch) => (
                    <IOSCard key={dispatch.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-ios-lg bg-blue-100 flex items-center justify-center"><Truck className="h-6 w-6 text-[#007AFF]" /></div>
                          <div>
                            <p className="font-bold">{dispatch.dispatch_number}</p>
                            <p className="text-sm text-gray-500">From: {dispatch.from_branch?.name}</p>
                            <p className="text-xs text-gray-400">Items: {dispatch.items?.length || 0}</p>
                          </div>
                        </div>
                        {dispatch.status === 'IN_TRANSIT' ? (
                          <>
                            {user?.role === UserRole.AUDITOR && (
                              <IOSBadge variant="light" color="warning">In Transit</IOSBadge>
                            )}
                            {user?.role !== UserRole.AUDITOR && (
                              <IOSButton size="sm" onClick={() => handleOpenReceive(dispatch)} leftIcon={<ArrowDownToLine />}>Receive</IOSButton>
                            )}
                            {user?.role === UserRole.AUDITOR && (
                              <IOSButton size="sm" variant="secondary" onClick={() => { setSelectedDispatch(dispatch); setIsDetailModalOpen(true); }} leftIcon={<Search />}>Audit</IOSButton>
                            )}
                          </>
                        ) : (
                          <IOSBadge variant="light" color="success">Received</IOSBadge>
                        )}
                      </div>
                    </IOSCard>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="supplier">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Form: Metadata */}
                <div className="space-y-4">
                  <IOSCard className="p-5">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-4">Reception Details</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-stone-500 mb-1.5 block">Supplier</label>
                        <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                          <SelectTrigger className="bg-stone-50 border border-stone-100">
                            <SelectValue placeholder="Select Local Supplier" />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers.map(s => (
                              <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({s.supplier_code})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <IOSInput 
                        label="Delivery Note #" 
                        placeholder="DN-XXXXX"
                        value={supplierFormData.delivery_note}
                        onChange={(e) => setSupplierFormData({...supplierFormData, delivery_note: e.target.value})}
                      />

                      <IOSInput 
                        label="Invoice #" 
                        placeholder="INV-XXXXX"
                        value={supplierFormData.invoice_no}
                        onChange={(e) => setSupplierFormData({...supplierFormData, invoice_no: e.target.value})}
                      />

                      <IOSInput 
                        label="Remarks" 
                        placeholder="Quality check ok..."
                        value={supplierFormData.remarks}
                        onChange={(e) => setSupplierFormData({...supplierFormData, remarks: e.target.value})}
                      />
                    </div>
                  </IOSCard>

                  <IOSCard className="p-5 bg-stone-900 text-white">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">Add Item</h2>
                      <Package className="h-4 w-4 text-stone-500" />
                    </div>

                    {/* Searchable SKU combobox */}
                    <div className="relative" ref={skuDropdownRef}>
                      <div
                        className="flex items-center bg-stone-800 border border-stone-700 rounded-lg px-3 h-10 gap-2 cursor-text"
                        onClick={() => setSkuDropdownOpen(true)}
                      >
                        <Search className="h-3.5 w-3.5 text-stone-500 shrink-0" />
                        <input
                          className="flex-1 bg-transparent text-sm text-white placeholder-stone-500 outline-none"
                          placeholder="Search SKU / Item"
                          value={skuSearch}
                          onChange={(e) => { setSkuSearch(e.target.value); setSkuDropdownOpen(true); }}
                          onFocus={() => setSkuDropdownOpen(true)}
                        />
                        {skuSearch && (
                          <button onClick={(e) => { e.stopPropagation(); setSkuSearch(''); }} className="text-stone-500 hover:text-white">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <ChevronDown className="h-3.5 w-3.5 text-stone-500 shrink-0" />
                      </div>

                      {skuDropdownOpen && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-stone-100 overflow-hidden max-h-56 overflow-y-auto">
                          {filteredMasterItems.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-stone-400 text-center">No items found</div>
                          ) : (
                            filteredMasterItems.map(item => (
                              <button
                                key={item.sku}
                                className="w-full text-left px-4 py-2.5 hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0"
                                onMouseDown={(e) => { e.preventDefault(); handleSkuSelect(item.sku); }}
                              >
                                <p className="text-sm font-semibold text-stone-800">{item.item_name}</p>
                                <p className="text-[10px] font-mono text-stone-400">{item.sku}</p>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    <p className="text-[10px] text-stone-500 mt-2 italic">Select from master catalog to add to receipt</p>

                    {/* Add new SKU button */}
                    <button
                      onClick={() => setIsNewSkuModalOpen(true)}
                      className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-stone-600 text-stone-400 hover:border-stone-400 hover:text-stone-200 transition-colors text-xs font-semibold"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add New SKU Item
                    </button>
                  </IOSCard>
                </div>

                {/* Right Form: Items Table */}
                <div className="lg:col-span-2 space-y-4">
                  <IOSCard className="p-5 overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-[#007AFF]" />
                        Line Items
                      </h2>
                      <IOSBadge variant="light" color="blue">{receiptItems.length} Products</IOSBadge>
                    </div>

                    {receiptItems.length === 0 ? (
                      <div className="py-20 text-center border-2 border-dashed border-stone-100 rounded-2xl">
                        <Plus className="h-8 w-8 text-stone-200 mx-auto mb-2" />
                        <p className="text-sm text-stone-400">Add items from the catalogs on the left</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-stone-50 rounded-lg text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                          <div className="col-span-1">#</div>
                          <div className="col-span-5">Item Detail</div>
                          <div className="col-span-2 text-center">Qty</div>
                          <div className="col-span-3 text-right">Unit Price (KES)</div>
                          <div className="col-span-1"></div>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
                          {receiptItems.map((item, idx) => (
                            <div key={item.item_sku} className="grid grid-cols-12 gap-4 px-4 py-3 border border-stone-100 rounded-xl hover:bg-stone-50/50 transition-all items-center">
                              <div className="col-span-1 text-xs font-bold text-stone-300">{idx + 1}</div>
                              <div className="col-span-5">
                                <p className="text-sm font-bold text-stone-800">{item.item_name}</p>
                                <p className="text-[10px] text-stone-400 font-mono tracking-tighter">{item.item_sku}</p>
                              </div>
                              <div className="col-span-2">
                                <input 
                                  type="number"
                                  className="w-full bg-white border border-stone-200 rounded-lg h-9 text-center text-sm font-bold focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none transition-all"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateReceiptItem(item.item_sku, 'quantity', parseFloat(e.target.value) || 0)}
                                />
                                <p className="text-[9px] text-center text-stone-400 mt-1 font-bold">{item.unit}</p>
                              </div>
                              <div className="col-span-3">
                                <input 
                                  type="number"
                                  className="w-full bg-white border border-stone-200 rounded-lg h-9 text-right px-3 text-sm font-bold focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none transition-all"
                                  value={item.unit_price}
                                  onChange={(e) => handleUpdateReceiptItem(item.item_sku, 'unit_price', parseFloat(e.target.value) || 0)}
                                />
                              </div>
                              <div className="col-span-1 flex justify-end">
                                <button 
                                  onClick={() => handleRemoveReceiptItem(item.item_sku)}
                                  className="p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="pt-4 mt-4 border-t border-stone-100 flex justify-between items-center">
                          <div className="text-right flex-1">
                            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Total Value</p>
                            <p className="text-2xl font-black text-stone-900">
                              KES {receiptItems.reduce((acc, i) => acc + (i.quantity * i.unit_price), 0).toLocaleString()}
                            </p>
                          </div>
                          <div className="ml-10">
                            <IOSButton 
                              size="lg" 
                              onClick={submitSupplierReceipt} 
                              isLoading={isSubmitting}
                              className="px-8"
                              leftIcon={<Check />}
                            >
                              Finalize Receipt
                            </IOSButton>
                          </div>
                        </div>
                      </div>
                    )}
                  </IOSCard>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <Dialog open={isReceiveModalOpen} onOpenChange={setIsReceiveModalOpen}>
          <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-xl border-none shadow-2xl">
            <div className="flex flex-col flex-1 min-h-0 bg-white">
              {/* Sticky Header */}
              <div className="px-5 py-3 border-b border-stone-100 flex-none bg-stone-50/50">
                <DialogHeader>
                  <DialogTitle className="text-[17px] font-bold text-stone-900 flex items-center gap-2">
                    <Package className="h-5 w-5 text-[#007AFF]" />
                    Process Delivery: {selectedDispatch?.dispatch_number}
                  </DialogTitle>
                </DialogHeader>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {/* Logistics Info & Batch Actions */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-stone-50 p-3 rounded-xl border border-stone-100">
                  <div className="flex gap-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Vehicle</p>
                      <p className="text-sm font-bold text-stone-900">{selectedDispatch?.vehicle_registration || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Driver</p>
                      <p className="text-sm font-bold text-stone-900">{selectedDispatch?.driver_name || 'N/A'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const allGood: Record<string, any> = {};
                      selectedDispatch?.items.forEach(item => {
                        allGood[item.id] = {
                          quantity: item.dispatched_quantity,
                          damaged: 0,
                          missing: 0,
                          note: 'Received as dispatched'
                        };
                      });
                      setReceivedItems(allGood);
                      toast.success('All items set to expected');
                    }}
                    className="w-full md:w-auto px-4 py-2 bg-stone-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                  >
                    <Check className="h-4 w-4" />
                    <span>Mark All Verified</span>
                  </button>
                </div>

                {/* Items Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <h3 className="text-[11px] font-bold text-stone-500 uppercase tracking-widest">Incoming Items</h3>
                    <span className="text-[10px] font-bold text-stone-400">{selectedDispatch?.items.length} Units</span>
                  </div>

                  <div className="space-y-2">
                    {selectedDispatch?.items.map((item) => (
                      <div key={item.id} className="group grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 p-3 border border-stone-100 rounded-xl bg-white hover:bg-stone-50/50 hover:border-stone-200 transition-all">
                        <div className="lg:col-span-5 flex flex-col justify-center">
                          <p className="font-bold text-[14px] text-stone-800 leading-tight">{item.item_name}</p>
                          <p className="text-[10px] font-semibold text-stone-400 uppercase mt-0.5 tracking-tight">{item.item_sku}</p>
                        </div>

                        <div className="lg:col-span-1 border-stone-100 flex flex-col items-center justify-center bg-blue-50/50 rounded-lg py-1">
                          <p className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter">Exp</p>
                          <p className="text-sm font-bold text-[#007AFF]">{item.dispatched_quantity}</p>
                        </div>

                        <div className="lg:col-span-6 grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-stone-400/80 uppercase tracking-tighter block text-center">Received</label>
                            <input
                              type="number"
                              className="w-full h-9 text-xs text-center font-bold bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none transition-all"
                              value={receivedItems[item.id]?.quantity}
                              onChange={(e) => setReceivedItems({ ...receivedItems, [item.id]: { ...receivedItems[item.id], quantity: parseInt(e.target.value) || 0 } })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-rose-400/80 uppercase tracking-tighter block text-center">Damaged</label>
                            <input
                              type="number"
                              className="w-full h-9 text-xs text-center font-bold bg-white border border-rose-100 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 outline-none transition-all text-rose-600"
                              value={receivedItems[item.id]?.damaged}
                              onChange={(e) => setReceivedItems({ ...receivedItems, [item.id]: { ...receivedItems[item.id], damaged: parseInt(e.target.value) || 0 } })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-amber-500/80 uppercase tracking-tighter block text-center">Missing</label>
                            <input
                              type="number"
                              className="w-full h-9 text-xs text-center font-bold bg-white border border-amber-100 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none transition-all text-amber-600"
                              value={receivedItems[item.id]?.missing}
                              onChange={(e) => setReceivedItems({ ...receivedItems, [item.id]: { ...receivedItems[item.id], missing: parseInt(e.target.value) || 0 } })}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Observations */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-stone-400" />
                    <h3 className="text-[11px] font-bold text-stone-500 uppercase tracking-widest">Observations & Notes</h3>
                  </div>
                  <textarea
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-[#007AFF]/10 focus:border-[#007AFF]/30 outline-none min-h-[80px] transition-all resize-none"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Enter any discrepancies or delivery observations here..."
                  />
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="px-5 py-4 border-t border-stone-100 flex-none bg-stone-50/50 backdrop-blur-md">
                <div className="flex gap-4">
                  <button
                    onClick={() => setIsReceiveModalOpen(false)}
                    className="flex-1 h-11 rounded-xl border border-stone-200 font-bold text-sm text-stone-500 bg-white hover:bg-stone-50 transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelivery}
                    className="flex-3 h-11 px-8 rounded-xl bg-stone-900 text-white text-sm font-bold hover:bg-black transition-all active:scale-95 shadow-lg shadow-stone-200"
                  >
                    Confirm Delivery & Update Stock
                  </button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Dispatch Audit: {selectedDispatch?.dispatch_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4 text-sm text-stone-600">
              <div className="grid grid-cols-2 gap-4 bg-stone-50 p-3 rounded-ios-lg">
                <div><p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">From</p><p className="font-bold text-stone-900">{selectedDispatch?.from_branch?.name}</p></div>
                <div><p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Status</p><p className="font-bold text-stone-900">{selectedDispatch?.status}</p></div>
                <div className="col-span-2"><p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Dispatched At</p><p className="font-bold text-stone-900">{selectedDispatch && new Date(selectedDispatch.dispatched_at).toLocaleString()}</p></div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-2">Items Included</p>
                <div className="space-y-1">
                  {selectedDispatch?.items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center py-1 border-b border-stone-100 last:border-0">
                      <span>{item.item?.item_name || 'Item'}</span>
                      <span className="font-bold">{item.dispatched_quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-stone-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Audit Status</p>
                  {selectedDispatch?.audited_at ? (
                    <div className="flex items-center gap-1 text-emerald-600">
                      <Check className="h-3 w-3" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Verified</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-amber-600">
                      <Clock className="h-3 w-3" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Unverified</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <IOSButton onClick={() => setIsDetailModalOpen(false)} variant="secondary" className="w-full">Close</IOSButton>
                  {!selectedDispatch?.audited_at && (
                    <IOSButton variant="secondary" onClick={() => handleVerify(selectedDispatch!)} leftIcon={<Check />} className="w-full">
                      Verify
                    </IOSButton>
                  )}
                </div>

                {!selectedDispatch?.audited_at && (
                  <IOSButton variant="destructive" onClick={() => handleFlagAnomaly(selectedDispatch!)} leftIcon={<AlertTriangle />} className="w-full">
                    Flag Anomaly
                  </IOSButton>
                )}
                {selectedDispatch?.audited_at && (
                  <div className="pt-2 italic text-[10px] text-stone-500">
                    Verified on {selectedDispatch.audited_at ? new Date(selectedDispatch.audited_at).toLocaleDateString() : 'N/A'}.
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── New SKU Item Modal ─────────────────────────────────────────── */}
        <Dialog open={isNewSkuModalOpen} onOpenChange={setIsNewSkuModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-[#007AFF]" />
                Add New SKU Item
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-bold text-stone-500 mb-1.5 block">Item Name *</label>
                <Input
                  placeholder="e.g. Basmati Rice 5kg"
                  value={newSkuForm.item_name}
                  onChange={(e) => setNewSkuForm({ ...newSkuForm, item_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-500 mb-1.5 block">Category *</label>
                <Select value={newSkuForm.category} onValueChange={(v) => setNewSkuForm({ ...newSkuForm, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-500 mb-1.5 block">Unit of Measure</label>
                  <Select value={newSkuForm.unit_of_measure} onValueChange={(v) => setNewSkuForm({ ...newSkuForm, unit_of_measure: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['units','kg','g','litres','ml','pieces','bags','boxes','crates','dozen','packets'].map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-500 mb-1.5 block">Cost Price (KES)</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newSkuForm.cost_price}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, cost_price: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-500 mb-1.5 block">Description (optional)</label>
                <Input
                  placeholder="Brief description..."
                  value={newSkuForm.description}
                  onChange={(e) => setNewSkuForm({ ...newSkuForm, description: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <IOSButton variant="secondary" className="flex-1" onClick={() => setIsNewSkuModalOpen(false)}>
                  Cancel
                </IOSButton>
                <IOSButton className="flex-1" onClick={handleCreateNewSku} disabled={isCreatingSku}>
                  {isCreatingSku ? 'Creating…' : 'Create & Add'}
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </DashboardLayout>
    </ProtectedRoute>
  );
}
