'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { procurementAPI, storeAPI } from '@/lib/api';
import { FileText, Plus, Search, RefreshCw, Eye, CheckCircle2, ShieldCheck, Receipt, DollarSign, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface InvoiceItem {
    id?: string;
    item_id: string;
    item_name?: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
    vat_amount?: number;
    total_price?: number;
    grn_item_id?: string;
    po_item_id?: string;
}

interface Invoice {
    id: string;
    invoice_number: string;
    supplier_name?: string;
    supplier_pin?: string;
    grn_number?: string;
    invoice_date: string;
    due_date: string;
    status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid' | 'partially_paid';
    sub_total: number;
    vat_amount: number;
    wht_amount: number;
    total_amount: number;
    items?: InvoiceItem[];
}

export default function InvoicesPage() {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);

    // Record Invoice State
    const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [grns, setGrns] = useState<any[]>([]);
    
    const [newInvoice, setNewInvoice] = useState({
        invoice_number: '',
        supplier_id: '',
        grn_id: 'none',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
        notes: ''
    });

    const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);

    const fetchInvoices = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await procurementAPI.getInvoices();
            if (response.success) setInvoices(response.data || []);
        } catch (error) { console.error('Error fetching invoices:', error); }
        finally { setIsLoading(false); }
    }, []);

    const fetchSuppliers = useCallback(async () => {
        try {
            const res = await storeAPI.getSuppliers({ scope: 'global' });
            if (res.success) setSuppliers(res.data || []);
        } catch (e) {}
    }, []);

    const fetchGRNs = useCallback(async (supplierId: string) => {
        try {
            const res = await procurementAPI.getGRNs({ supplier_id: supplierId, status: 'approved' });
            if (res.success) {
                setGrns(res.data || []);
            }
        } catch (e) {}
    }, []);

    useEffect(() => { 
        fetchInvoices(); 
        fetchSuppliers();
    }, [fetchInvoices, fetchSuppliers]);

    useEffect(() => {
        if (newInvoice.supplier_id) {
            fetchGRNs(newInvoice.supplier_id);
            setNewInvoice(prev => ({ ...prev, grn_id: 'none' }));
            setInvoiceItems([]);
        } else {
            setGrns([]);
        }
    }, [newInvoice.supplier_id, fetchGRNs]);

    const handleGRNSelect = async (grnId: string) => {
        setNewInvoice(prev => ({ ...prev, grn_id: grnId }));
        if (grnId !== 'none') {
            try {
                const res = await procurementAPI.getGRN(grnId);
                if (res.success && res.data && res.data.items) {
                    const mappedItems = res.data.items.map((item: any) => ({
                        item_id: item.item_id,
                        item_name: item.item?.name || 'Item',
                        quantity: item.received_quantity,
                        unit_price: item.unit_price,
                        vat_rate: 16,
                        grn_item_id: item.id,
                        po_item_id: item.po_item_id
                    }));
                    setInvoiceItems(mappedItems);
                }
            } catch (e) {
                toast.error('Failed to load GRN items');
            }
        } else {
            setInvoiceItems([]);
        }
    };

    const addEmptyItem = () => {
        setInvoiceItems([...invoiceItems, {
            item_id: 'manual',
            item_name: '',
            quantity: 1,
            unit_price: 0,
            vat_rate: 16
        }]);
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...invoiceItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setInvoiceItems(newItems);
    };

    const removeItem = (index: number) => {
        const newItems = [...invoiceItems];
        newItems.splice(index, 1);
        setInvoiceItems(newItems);
    };

    const handleRecordInvoice = async () => {
        if (!newInvoice.supplier_id || !newInvoice.invoice_number) {
            toast.error("Supplier and Invoice Number are required");
            return;
        }
        if (invoiceItems.length === 0) {
            toast.error("Add at least one line item");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await procurementAPI.createInvoice({
                ...newInvoice,
                supplier_id: newInvoice.supplier_id === 'other' ? null : newInvoice.supplier_id,
                grn_id: newInvoice.grn_id === 'none' ? null : newInvoice.grn_id,
                items: invoiceItems.map(item => ({
                    ...item,
                    description: item.item_name
                }))
            });

            if (res.success) {
                toast.success('Invoice recorded successfully');
                setIsRecordModalOpen(false);
                setNewInvoice({
                    invoice_number: '',
                    supplier_id: '',
                    grn_id: 'none',
                    invoice_date: new Date().toISOString().split('T')[0],
                    due_date: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
                    notes: ''
                });
                setInvoiceItems([]);
                fetchInvoices();
            } else {
                toast.error(res.message || 'Failed to record invoice');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to record invoice');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleApprove = async (id: string) => {
        if (!confirm('Approve this invoice for payment? Ensure VAT details are correct.')) return;
        try {
            await procurementAPI.approveInvoice(id);
            toast.success('Invoice Approved & Ledger Posted');
            fetchInvoices();
            setIsViewOpen(false);
        } catch (error: any) { toast.error(error.message || 'Failed to approve'); }
    };

    const filteredInvoices = invoices.filter(inv =>
        inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.grn_number && inv.grn_number.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'success';
            case 'paid': return 'success';
            case 'submitted': return 'warning';
            case 'draft': return 'secondary';
            case 'rejected': return 'danger';
            default: return 'secondary';
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Supplier Invoices</h1>
                            <p className="text-gray-500">Manage billing and VAT compliance</p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={fetchInvoices} leftIcon={<RefreshCw size={16} />}>Refresh</IOSButton>
                            {(user?.role === UserRole.CENTRAL_STOREKEEPER || user?.role === UserRole.SUPER_ADMIN) && (
                                <IOSButton onClick={() => setIsRecordModalOpen(true)} leftIcon={<Plus size={16} />}>Record Invoice</IOSButton>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 py-2 border-b border-stone-100">
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers'}>Suppliers</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/purchase-orders'}>POs</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/grn'}>GRN</IOSButton>
                        <IOSButton variant="secondary" className="bg-stone-50 border-none h-8 text-xs px-3" onClick={() => window.location.href = '/dashboard/central-store/suppliers/invoices'}>Invoices</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/payments'}>Payments</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/reports'}>Reports</IOSButton>
                    </div>

                    <IOSCard className="p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search by Invoice #, GRN # or Supplier..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 text-sm"
                            />
                        </div>
                    </IOSCard>

                    {isLoading ? (
                        <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-stone-300" /></div>
                    ) : filteredInvoices.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-ios-xl border border-stone-100 italic text-stone-400">No invoices found</div>
                    ) : (
                        <div className="overflow-x-auto rounded-ios-xl border border-stone-100">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-stone-50 text-stone-500 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Invoice Number</th>
                                        <th className="px-4 py-3">Supplier (PIN)</th>
                                        <th className="px-4 py-3">GRN Ref</th>
                                        <th className="px-4 py-3 text-right">Total Amount</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50 bg-white">
                                    {filteredInvoices.map(inv => (
                                        <tr key={inv.id} className="hover:bg-stone-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-stone-700">{inv.invoice_number}</td>
                                            <td className="px-4 py-3 text-xs">
                                                <p className="font-semibold">{inv.supplier_name}</p>
                                                <p className="text-[10px] text-stone-400 font-mono italic">{inv.supplier_pin || 'NO PIN'}</p>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-[10px] text-stone-400">{inv.grn_number || 'N/A'}</td>
                                            <td className="px-4 py-3 text-right font-medium">KES {(inv.total_amount ?? 0).toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <IOSBadge variant="light" color={getStatusColor(inv.status)} className="capitalize text-[10px] py-0 px-2 min-w-[80px] text-center border-none">
                                                    {inv.status.replace('_', ' ')}
                                                </IOSBadge>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const res = await procurementAPI.getInvoice(inv.id);
                                                            if (res.success) {
                                                                setViewInvoice(res.data);
                                                                setIsViewOpen(true);
                                                            }
                                                        } catch (e) { toast.error('Failed to load details'); }
                                                    }}
                                                    className="p-1 text-stone-400 hover:text-[#007AFF]"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <div className="flex items-center justify-between pr-8">
                                <div>
                                    <DialogTitle className="text-xl">Invoice: {viewInvoice?.invoice_number}</DialogTitle>
                                    <DialogDescription>From {viewInvoice?.supplier_name}</DialogDescription>
                                </div>
                                {viewInvoice && (
                                    <IOSBadge variant="light" color={getStatusColor(viewInvoice.status)} className="capitalize">
                                        {viewInvoice.status.replace('_', ' ')}
                                    </IOSBadge>
                                )}
                            </div>
                        </DialogHeader>

                        {viewInvoice && (
                            <div className="space-y-6 mt-4">
                                <div className="grid grid-cols-2 gap-8 text-sm border-stone-100 border-b pb-4">
                                    <div className="space-y-2">
                                        <div><p className="text-[10px] uppercase font-bold text-stone-400">Supplier Details</p><p className="font-black text-stone-800">{viewInvoice.supplier_name}</p><p className="font-mono text-[11px] text-[#007AFF]">{viewInvoice.supplier_pin}</p></div>
                                        <div><p className="text-[10px] uppercase font-bold text-stone-400">Billing Timeline</p><p className="text-stone-600 font-medium">Inv: {viewInvoice.invoice_date ? new Date(viewInvoice.invoice_date).toLocaleDateString() : 'N/A'}</p><p className="text-stone-500 italic">Due: {viewInvoice.due_date ? new Date(viewInvoice.due_date).toLocaleDateString() : 'N/A'}</p></div>
                                    </div>
                                    <div className="bg-stone-50 p-4 rounded-ios-xl space-y-2">
                                        <div className="flex justify-between text-xs"><span className="text-stone-400">Subtotal</span><span className="font-mono">{(viewInvoice.sub_total ?? 0).toLocaleString()}</span></div>
                                        <div className="flex justify-between text-xs"><span className="text-stone-400">Total VAT (16%)</span><span className="font-mono text-emerald-600">+{(viewInvoice.vat_amount ?? 0).toLocaleString()}</span></div>
                                        <div className="flex justify-between text-xs pb-2 border-b border-stone-200"><span className="text-stone-400">Withholding VAT</span><span className="font-mono text-red-500">-{(viewInvoice.wht_amount ?? 0).toLocaleString()}</span></div>
                                        <div className="flex justify-between font-bold text-base pt-1"><span className="text-stone-800">Net Payable</span><span className="text-[#007AFF]">KES {(viewInvoice.total_amount ?? 0).toLocaleString()}</span></div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase text-stone-400">Line Items & VAT Allocation</p>
                                    <div className="overflow-hidden rounded-lg border border-stone-100">
                                        <table className="w-full text-[11px]">
                                            <thead className="bg-stone-50 text-stone-500">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">Description</th>
                                                    <th className="px-3 py-2 text-right">Price</th>
                                                    <th className="px-3 py-2 text-right">VAT</th>
                                                    <th className="px-3 py-2 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {viewInvoice.items?.map((item, idx) => (
                                                    <tr key={idx} className="border-t border-stone-50 hover:bg-stone-25">
                                                        <td className="px-3 py-2">
                                                            <p className="font-bold text-stone-700">{item.item_name}</p>
                                                            <p className="text-[10px] text-stone-400 italic">Qty: {item.quantity}</p>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono">{(item.unit_price ?? 0).toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-right text-emerald-600 font-medium">{(item.vat_amount ?? 0).toLocaleString()} ({item.vat_rate ?? 0}%)</td>
                                                        <td className="px-3 py-2 text-right font-black text-stone-800">{(item.total_price ?? 0).toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-4 border-t border-stone-100">
                                    <IOSButton variant="secondary" onClick={() => setIsViewOpen(false)} className="h-9 px-4 text-xs">Close</IOSButton>
                                    {(viewInvoice.status === 'draft' || viewInvoice.status === 'submitted') && (user?.role === UserRole.AUDITOR || user?.role === UserRole.SUPER_ADMIN) && (
                                        <>
                                            <IOSButton onClick={() => handleApprove(viewInvoice.id)} className="h-9 px-4 text-xs flex-1 border-none shadow-sm" leftIcon={<ShieldCheck size={14} />}>Approve for Payment</IOSButton>
                                            <IOSButton variant="secondary" onClick={() => toast.info('Rejecting...')} className="h-9 px-4 text-xs border-red-50 text-red-500 hover:bg-red-50">Reject</IOSButton>
                                        </>
                                    )}
                                    {viewInvoice.status === 'approved' && (
                                        <div className="flex-1 flex justify-end">
                                            <IOSButton leftIcon={<DollarSign size={14} />} className="h-9 px-6 text-xs" onClick={() => window.location.href = `/dashboard/central-store/suppliers/payments?invoice=${viewInvoice.id}`}>Process Payment</IOSButton>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* RECORD INVOICE MODAL */}
                <Dialog open={isRecordModalOpen} onOpenChange={setIsRecordModalOpen}>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Record Supplier Invoice</DialogTitle>
                            <DialogDescription>Enter invoice details to submit for auditor approval.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Supplier *</Label>
                                    <Select value={newInvoice.supplier_id} onValueChange={(val) => setNewInvoice(prev => ({...prev, supplier_id: val}))}>
                                        <SelectTrigger><SelectValue placeholder="Select Supplier" /></SelectTrigger>
                                        <SelectContent>
                                            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Link to GRN (Optional)</Label>
                                    <Select value={newInvoice.grn_id} onValueChange={handleGRNSelect} disabled={!newInvoice.supplier_id}>
                                        <SelectTrigger><SelectValue placeholder="Select GRN" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No GRN / Direct Invoice</SelectItem>
                                            {grns.map(g => <SelectItem key={g.id} value={g.id}>{g.grn_number} - KES {(g.total_value || 0).toLocaleString()}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Invoice Number *</Label>
                                    <Input value={newInvoice.invoice_number} onChange={e => setNewInvoice(prev => ({...prev, invoice_number: e.target.value}))} placeholder="e.g. INV-12345" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Invoice Date</Label>
                                    <Input type="date" value={newInvoice.invoice_date} onChange={e => setNewInvoice(prev => ({...prev, invoice_date: e.target.value}))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Due Date</Label>
                                    <Input type="date" value={newInvoice.due_date} onChange={e => setNewInvoice(prev => ({...prev, due_date: e.target.value}))} />
                                </div>
                            </div>

                            <div className="border rounded-md mt-4">
                                <div className="bg-stone-50 p-2 border-b flex justify-between items-center">
                                    <Label className="font-bold">Line Items</Label>
                                    <Button variant="ghost" size="sm" onClick={addEmptyItem}><Plus className="h-4 w-4 mr-2" /> Add Item</Button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-stone-50">
                                            <tr>
                                                <th className="text-left p-2 font-medium">Description</th>
                                                <th className="text-right p-2 font-medium w-24">Qty</th>
                                                <th className="text-right p-2 font-medium w-28">Unit Price</th>
                                                <th className="text-right p-2 font-medium w-24">VAT (%)</th>
                                                <th className="text-right p-2 font-medium w-28">Total</th>
                                                <th className="w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoiceItems.length === 0 ? (
                                                <tr><td colSpan={6} className="p-4 text-center text-stone-400">No items added.</td></tr>
                                            ) : invoiceItems.map((item, idx) => {
                                                const total = item.quantity * item.unit_price * (1 + item.vat_rate / 100);
                                                return (
                                                    <tr key={idx} className="border-b">
                                                        <td className="p-2">
                                                            <Input className="h-8 text-xs" value={item.item_name} onChange={e => updateItem(idx, 'item_name', e.target.value)} placeholder="Item name" />
                                                        </td>
                                                        <td className="p-2">
                                                            <Input type="number" min="0" step="0.01" className="h-8 text-xs text-right" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} />
                                                        </td>
                                                        <td className="p-2">
                                                            <Input type="number" min="0" step="0.01" className="h-8 text-xs text-right" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} />
                                                        </td>
                                                        <td className="p-2">
                                                            <Select value={String(item.vat_rate)} onValueChange={v => updateItem(idx, 'vat_rate', Number(v))}>
                                                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="16">16% (Standard)</SelectItem>
                                                                    <SelectItem value="0">0% (Zero Rated)</SelectItem>
                                                                    <SelectItem value="8">8%</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </td>
                                                        <td className="p-2 text-right font-medium text-stone-700">
                                                            {total.toLocaleString()}
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <button onClick={() => removeItem(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14} /></button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-4 bg-stone-50 border-t flex justify-end gap-6 text-sm">
                                    <div className="text-right">
                                        <p className="text-stone-500 mb-1">Subtotal:</p>
                                        <p className="text-stone-500 mb-1">Total VAT:</p>
                                        <p className="font-bold">Net Total:</p>
                                    </div>
                                    <div className="text-right font-mono">
                                        <p className="mb-1">{invoiceItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toLocaleString()}</p>
                                        <p className="mb-1">{invoiceItems.reduce((sum, item) => sum + (item.quantity * item.unit_price * (item.vat_rate / 100)), 0).toLocaleString()}</p>
                                        <p className="font-bold text-[#007AFF]">{invoiceItems.reduce((sum, item) => sum + (item.quantity * item.unit_price * (1 + item.vat_rate / 100)), 0).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Notes</Label>
                                <Input value={newInvoice.notes} onChange={e => setNewInvoice(prev => ({...prev, notes: e.target.value}))} placeholder="Optional notes..." />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsRecordModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                            <Button onClick={handleRecordInvoice} disabled={isSubmitting} className="bg-[#007AFF] text-white">
                                {isSubmitting ? 'Recording...' : 'Record Invoice'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
