'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { procurementAPI } from '@/lib/api';
import { FileText, Plus, Search, RefreshCw, Eye, CheckCircle2, ShieldCheck, Receipt, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface InvoiceItem {
    id?: string;
    item_id: string;
    item_name?: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
    vat_amount: number;
    total_price: number;
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

    const fetchInvoices = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await procurementAPI.getInvoices();
            if (response.success) setInvoices(response.data || []);
        } catch (error) { console.error('Error fetching invoices:', error); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

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
                                <IOSButton onClick={() => toast.info('Redirecting to Invoice Entry...')} leftIcon={<Plus size={16} />}>Record Invoice</IOSButton>
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
                                            <td className="px-4 py-3 text-right font-medium">KES {inv.total_amount.toLocaleString()}</td>
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
                                        <div><p className="text-[10px] uppercase font-bold text-stone-400">Billing Timeline</p><p className="text-stone-600 font-medium">Inv: {new Date(viewInvoice.invoice_date).toLocaleDateString()}</p><p className="text-stone-500 italic">Due: {new Date(viewInvoice.due_date).toLocaleDateString()}</p></div>
                                    </div>
                                    <div className="bg-stone-50 p-4 rounded-ios-xl space-y-2">
                                        <div className="flex justify-between text-xs"><span className="text-stone-400">Subtotal</span><span className="font-mono">{viewInvoice.sub_total.toLocaleString()}</span></div>
                                        <div className="flex justify-between text-xs"><span className="text-stone-400">Total VAT (16%)</span><span className="font-mono text-emerald-600">+{viewInvoice.vat_amount.toLocaleString()}</span></div>
                                        <div className="flex justify-between text-xs pb-2 border-b border-stone-200"><span className="text-stone-400">Withholding VAT</span><span className="font-mono text-red-500">-{viewInvoice.wht_amount.toLocaleString()}</span></div>
                                        <div className="flex justify-between font-bold text-base pt-1"><span className="text-stone-800">Net Payable</span><span className="text-[#007AFF]">KES {viewInvoice.total_amount.toLocaleString()}</span></div>
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
                                                        <td className="px-3 py-2 text-right font-mono">{item.unit_price.toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-right text-emerald-600 font-medium">{item.vat_amount.toLocaleString()} ({item.vat_rate}%)</td>
                                                        <td className="px-3 py-2 text-right font-black text-stone-800">{item.total_price.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-4 border-t border-stone-100">
                                    <IOSButton variant="secondary" onClick={() => setIsViewOpen(false)} className="h-9 px-4 text-xs">Close</IOSButton>
                                    {viewInvoice.status === 'submitted' && (user?.role === UserRole.AUDITOR || user?.role === UserRole.SUPER_ADMIN) && (
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
            </DashboardLayout>
        </ProtectedRoute>
    );
}
