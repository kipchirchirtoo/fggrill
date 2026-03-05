'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from "@/components/ui/minimal/button";
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import {
    ShoppingCart, Plus, RefreshCw, Eye, Check, X, Clock,
    Search, Filter, Package, Building2, Calendar, FileText,
    Truck, AlertTriangle, CheckCircle, XCircle, Edit, Trash2,
    Download, Printer, Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { downloadPurchaseOrderPDF, printPurchaseOrderPDF } from '@/lib/purchase-order-pdf';
import { downloadInvoicePDF, printInvoicePDF } from '@/lib/invoice-pdf';
import { procurementAPI, storeAPI } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface InvoiceItem {
    id?: string;
    item_id: string;
    item_name?: string;
    description?: string;
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
    created_at: string;
}

interface PurchaseOrder {
    id: string;
    po_number: string;
    supplier_id: number;
    supplier?: { id: number; name: string; contact_person?: string };
    status: string;
    total_amount: number;
    expected_delivery?: string;
    notes?: string;
    items: POItem[];
    created_at: string;
    created_by?: string;
}

interface POItem {
    id?: string;
    item_id: number;
    item?: { id: number; name: string; sku: string };
    quantity: number;
    unit_price: number;
    total: number;
}

interface Supplier {
    id: number;
    name: string;
    contact_person?: string;
    phone?: string;
}

interface StoreItem {
    id: number;
    name: string;
    sku: string;
    cost_price?: number;
}

export default function BranchPurchasesPage() {
    const { user } = useAuth();
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [items, setItems] = useState<StoreItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const searchParams = useSearchParams();
    const router = useRouter();
    const tabParam = searchParams.get('tab') as 'orders' | 'invoices' | null;

    const [activeTab, setActiveTab] = useState<'orders' | 'invoices'>(tabParam || 'orders');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
    const [isViewInvoiceOpen, setIsViewInvoiceOpen] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        supplier_id: '',
        expected_delivery: '',
        notes: '',
        items: [{ _id: Math.random().toString(36).substr(2, 9), item_id: '', quantity: 1, unit_price: 0, vat_rate: 16 }]
    });

    const [invoiceFormData, setInvoiceFormData] = useState({
        supplier_id: '',
        invoice_number: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: '',
        items: [{ _id: Math.random().toString(36).substr(2, 9), description: '', quantity: 1, unit_price: 0, vat_rate: 16 }],
        other_supplier_name: '',
        manual_supplier_pin: ''
    });

    useEffect(() => {
        fetchData();
    }, [statusFilter]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [ordersRes, invoicesRes, suppliersRes, itemsRes] = await Promise.all([
                procurementAPI.getPurchaseOrders(statusFilter ? { status: statusFilter } : {}),
                procurementAPI.getInvoices(),
                storeAPI.getSuppliers(),
                storeAPI.getItems()
            ]);

            if (ordersRes.success) setOrders(ordersRes.data || []);
            if (invoicesRes.success) setInvoices(invoicesRes.data || []);
            if (suppliersRes.success) setSuppliers(suppliersRes.data || []);
            if (itemsRes.success) setItems(itemsRes.data || []);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateOrder = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/procurement/purchase-orders`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...formData,
                    items: formData.items.filter(i => i.item_id).map(i => ({
                        item_id: parseInt(i.item_id),
                        quantity: i.quantity,
                        unit_price: i.unit_price,
                        total: i.quantity * i.unit_price
                    }))
                })
            });

            if (response.ok) {
                toast.success('Purchase order created');
                setIsCreateModalOpen(false);
                setFormData({ supplier_id: '', expected_delivery: '', notes: '', items: [{ _id: Math.random().toString(36).substr(2, 9), item_id: '', quantity: 1, unit_price: 0, vat_rate: 16 }] });
                fetchData();
            } else {
                const err = await response.json();
                toast.error(err.error || 'Failed to create order');
            }
        } catch (error) {
            toast.error('Failed to create order');
        }
    };

    const handleCreateInvoice = async () => {
        try {
            const payload = {
                ...invoiceFormData,
                items: invoiceFormData.items.map(i => ({
                    ...i,
                    vat_amount: (i.quantity * i.unit_price) * (i.vat_rate / 100),
                    total_price: (i.quantity * i.unit_price) * (1 + i.vat_rate / 100)
                }))
            };

            const response = await procurementAPI.createInvoice(payload);

            if (response.success) {
                toast.success('Invoice recorded successfully');
                setIsInvoiceModalOpen(false);
                setInvoiceFormData({
                    supplier_id: '',
                    invoice_number: '',
                    invoice_date: new Date().toISOString().split('T')[0],
                    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    notes: '',
                    items: [{ _id: Math.random().toString(36).substr(2, 9), description: '', quantity: 1, unit_price: 0, vat_rate: 16 }],
                    other_supplier_name: '',
                    manual_supplier_pin: ''
                });
                fetchData();
            } else {
                toast.error(response.message || 'Failed to record invoice');
            }
        } catch (error) {
            toast.error('Failed to create invoice');
        }
    };

    const getStatusColor = (status: string) => {
        const s = status.toUpperCase();
        const colors: Record<string, string> = {
            'DRAFT': 'bg-gray-100 text-gray-700',
            'PENDING': 'bg-amber-100 text-amber-700',
            'APPROVED': 'bg-emerald-100 text-emerald-700',
            'ORDERED': 'bg-blue-100 text-blue-700',
            'RECEIVED': 'bg-stone-100 text-stone-700',
            'CANCELLED': 'bg-rose-100 text-rose-700'
        };
        return colors[s] || 'bg-gray-100';
    };

    const getStatusIcon = (status: string) => {
        const s = status.toUpperCase();
        const icons: Record<string, any> = {
            'DRAFT': <FileText className="h-4 w-4" />,
            'PENDING': <Clock className="h-4 w-4" />,
            'APPROVED': <CheckCircle className="h-4 w-4" />,
            'ORDERED': <Truck className="h-4 w-4" />,
            'RECEIVED': <Package className="h-4 w-4" />,
            'CANCELLED': <XCircle className="h-4 w-4" />
        };
        return icons[s] || <Clock className="h-4 w-4" />;
    };

    const filteredOrders = orders.filter(o =>
        o.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalOrderValue = formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    const canCreate = user?.role === UserRole.BRANCH_ACCOUNTANT || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER;

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_ACCOUNTANT]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <ShoppingCart className="h-6 w-6 text-gray-900" />
                                Branch Purchases
                            </h1>
                            <p className="text-gray-600">Record and manage branch purchase orders</p>
                        </div>
                        <div className="flex gap-3">
                            <IOSButton variant="outline" onClick={fetchData} disabled={isLoading}>
                                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                Refresh
                            </IOSButton>
                            {canCreate && (
                                <IOSButton onClick={() => activeTab === 'orders' ? setIsCreateModalOpen(true) : setIsInvoiceModalOpen(true)} leftIcon={<Plus />}>
                                    {activeTab === 'orders' ? 'New Purchase' : 'Record Invoice'}
                                </IOSButton>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 border-b border-stone-100 pb-px">
                        <button
                            onClick={() => { setActiveTab('orders'); router.push('/dashboard/branch-accounting/purchases?tab=orders'); }}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'orders' ? 'border-[#007AFF] text-[#007AFF]' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
                        >
                            Purchase Orders
                        </button>
                        <button
                            onClick={() => { setActiveTab('invoices'); router.push('/dashboard/branch-accounting/purchases?tab=invoices'); }}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'invoices' ? 'border-[#007AFF] text-[#007AFF]' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
                        >
                            Supplier Invoices
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <IOSCard className="p-4">
                            <div className="flex items-center gap-3">
                                <Clock className="h-8 w-8 text-amber-500" />
                                <div>
                                    <p className="text-sm text-gray-500">Pending Approval</p>
                                    <p className="text-2xl font-bold">{orders.filter(o => o.status.toUpperCase() === 'PENDING' || o.status.toUpperCase() === 'DRAFT').length}</p>
                                </div>
                            </div>
                        </IOSCard>
                        <IOSCard className="p-4">
                            <div className="flex items-center gap-3">
                                <CheckCircle className="h-8 w-8 text-emerald-500" />
                                <div>
                                    <p className="text-sm text-gray-500">Approved</p>
                                    <p className="text-2xl font-bold">{orders.filter(o => o.status.toUpperCase() === 'APPROVED').length}</p>
                                </div>
                            </div>
                        </IOSCard>
                        <IOSCard className="p-4">
                            <div className="flex items-center gap-3">
                                <Package className="h-8 w-8 text-blue-500" />
                                <div>
                                    <p className="text-sm text-gray-500">Received</p>
                                    <p className="text-2xl font-bold">{orders.filter(o => o.status.toUpperCase() === 'RECEIVED').length}</p>
                                </div>
                            </div>
                        </IOSCard>
                        <IOSCard className="p-4">
                            <div className="flex items-center gap-3">
                                <FileText className="h-8 w-8 text-stone-500" />
                                <div>
                                    <p className="text-sm text-gray-500">Total {activeTab === 'orders' ? 'Orders' : 'Invoices'}</p>
                                    <p className="text-2xl font-bold">{activeTab === 'orders' ? orders.length : invoices.length}</p>
                                </div>
                            </div>
                        </IOSCard>
                    </div>

                    {/* Filters */}
                    <IOSCard className="p-4">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                                <Input
                                    placeholder={activeTab === 'orders' ? "Search by PO# or Supplier..." : "Search by Invoice# or Supplier..."}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            {activeTab === 'orders' && (
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="border rounded-ios-lg px-3 py-2 text-sm"
                                >
                                    <option value="">All Status</option>
                                    <option value="DRAFT">Draft</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="APPROVED">Approved</option>
                                    <option value="RECEIVED">Received</option>
                                    <option value="CANCELLED">Cancelled</option>
                                </select>
                            )}
                        </div>
                    </IOSCard>

                    {/* Table View */}
                    {activeTab === 'orders' ? (
                        <IOSCard>
                            {isLoading ? (
                                <div className="p-12 text-center text-gray-500">Loading purchases...</div>
                            ) : filteredOrders.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">
                                    <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                    <p>No purchases found</p>
                                    {canCreate && <IOSButton className="mt-4" onClick={() => setIsCreateModalOpen(true)}>Record New Purchase</IOSButton>}
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {filteredOrders.map((order) => (
                                                <tr key={order.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-4 font-mono text-sm font-medium">{order.po_number}</td>
                                                    <td className="px-4 py-4">{order.supplier?.name || '-'}</td>
                                                    <td className="px-4 py-4">
                                                        <IOSBadge className={getStatusColor(order.status)}>
                                                            <span className="flex items-center gap-1">{getStatusIcon(order.status)} {order.status}</span>
                                                        </IOSBadge>
                                                    </td>
                                                    <td className="px-4 py-4 text-right font-medium">KES {order.total_amount?.toLocaleString() || 0}</td>
                                                    <td className="px-4 py-4 text-sm text-gray-500">{formatDate(order.created_at)}</td>
                                                    <td className="px-4 py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                onClick={() => { setSelectedOrder(order); setIsViewModalOpen(true); }}
                                                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                                title="View Details"
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => downloadPurchaseOrderPDF(order)}
                                                                className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                                                title="Download PDF"
                                                            >
                                                                <Download className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => printPurchaseOrderPDF(order)}
                                                                className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                                                                title="Print"
                                                            >
                                                                <Printer className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </IOSCard>
                    ) : (
                        <IOSCard>
                            {isLoading ? (
                                <div className="p-12 text-center text-gray-500">Loading invoices...</div>
                            ) : invoices.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">
                                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                    <p>No invoices recorded</p>
                                    {canCreate && <IOSButton className="mt-4" onClick={() => setIsInvoiceModalOpen(true)}>Record New Invoice</IOSButton>}
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inv Number</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {invoices.filter(inv =>
                                                inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                inv.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
                                            ).map((inv) => (
                                                <tr key={inv.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-4 font-mono text-sm font-medium">{inv.invoice_number}</td>
                                                    <td className="px-4 py-4">{inv.supplier?.name || inv.other_supplier_name || inv.supplier_name || '-'}</td>
                                                    <td className="px-4 py-4">
                                                        <IOSBadge className={inv.status === 'approved' || inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}>
                                                            {inv.status}
                                                        </IOSBadge>
                                                    </td>
                                                    <td className="px-4 py-4 text-right font-medium">
                                                        {inv.total_amount ? `KES ${inv.total_amount.toLocaleString()}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-gray-500">{formatDate(inv.invoice_date)}</td>
                                                    <td className="px-4 py-4 text-right">
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    const res = await procurementAPI.getInvoice(inv.id);
                                                                    if (res.success) {
                                                                        setViewInvoice(res.data);
                                                                        setIsViewInvoiceOpen(true);
                                                                    }
                                                                } catch (e) { toast.error('Failed to load invoice'); }
                                                            }}
                                                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </IOSCard>
                    )}
                </div>

                {/* Create Modal */}
                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogContent className="max-w-5xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Plus className="h-5 w-5" />
                                New Purchase Order
                            </DialogTitle>
                        </DialogHeader>
                        <DialogBody>
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5 text-gray-700">Supplier *</label>
                                        <select
                                            value={formData.supplier_id}
                                            onChange={(e) => setFormData(prev => ({ ...prev, supplier_id: e.target.value }))}
                                            className="w-full border rounded-ios-lg px-3 py-2 text-sm bg-white"
                                        >
                                            <option key="select-supplier-placeholder" value="">Select Supplier</option>
                                            {suppliers.map((s) => (
                                                <option key={`po-supplier-${s.id}`} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5 text-gray-700">Expected Delivery</label>
                                        <Input
                                            type="date"
                                            value={formData.expected_delivery}
                                            onChange={(e) => setFormData(prev => ({ ...prev, expected_delivery: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="block text-sm font-medium text-gray-700">Purchase Items *</label>
                                        <IOSButton size="sm" variant="outline" onClick={() => setFormData(p => ({ ...p, items: [...p.items, { _id: Math.random().toString(36).substr(2, 9), item_id: '', quantity: 1, unit_price: 0, vat_rate: 16 }] }))} leftIcon={<Plus />}>Add Item</IOSButton>
                                    </div>
                                    <div className="space-y-3 border rounded-ios-lg p-4 bg-gray-50/50">
                                        {formData.items.map((item, index) => (
                                            <div key={item._id} className="flex items-center gap-3">
                                                <div className="flex-1">
                                                    <select
                                                        value={item.item_id}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            const selectedItem = items.find(it => it.id === parseInt(val));
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                items: prev.items.map((it, i) => i === index ? { ...it, item_id: val, unit_price: selectedItem?.cost_price || 0 } : it)
                                                            }));
                                                        }}
                                                        className="w-full border rounded-ios-lg px-3 py-2 text-sm bg-white"
                                                    >
                                                        <option key="select-item-placeholder" value="">Select Item</option>
                                                        {items.map((it) => (
                                                            <option key={it.id} value={it.id}>{it.name} ({it.sku})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="w-24">
                                                    <Input
                                                        type="number"
                                                        placeholder="Qty"
                                                        value={item.quantity}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value) || 0;
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                items: prev.items.map((it, i) => i === index ? { ...it, quantity: val } : it)
                                                            }));
                                                        }}
                                                    />
                                                </div>
                                                <div className="w-32">
                                                    <Input
                                                        type="number"
                                                        placeholder="Price"
                                                        value={item.unit_price}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                items: prev.items.map((it, i) => i === index ? { ...it, unit_price: val } : it)
                                                            }));
                                                        }}
                                                    />
                                                </div>
                                                <div className="w-24">
                                                    <select
                                                        value={item.vat_rate || 16}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                items: prev.items.map((it, i) => i === index ? { ...it, vat_rate: val } : it)
                                                            }));
                                                        }}
                                                        className="w-full border rounded-ios-lg px-2 py-2 text-sm bg-white"
                                                    >
                                                        <option value={16}>16% VAT</option>
                                                        <option value={0}>0% VAT</option>
                                                    </select>
                                                </div>
                                                <div className="w-32 text-right font-medium text-sm">
                                                    KES {(item.quantity * item.unit_price * (1 + (item.vat_rate || 0) / 100)).toLocaleString()}
                                                </div>
                                                {formData.items.length > 1 && (
                                                    <button onClick={() => setFormData(p => ({ ...p, items: p.items.filter((_, i) => i !== index) }))} className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <div className="flex justify-end pt-3 border-t">
                                            <div className="text-right space-y-1">
                                                <p className="text-sm text-gray-500">Subtotal: KES {formData.items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0).toLocaleString()}</p>
                                                <p className="text-sm text-gray-500">VAT: KES {formData.items.reduce((sum, i) => sum + (i.quantity * i.unit_price * ((i.vat_rate || 0) / 100)), 0).toLocaleString()}</p>
                                                <p className="text-xl font-bold">Total: KES {formData.items.reduce((sum, i) => sum + (i.quantity * i.unit_price * (1 + (i.vat_rate || 0) / 100)), 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-gray-700">Notes</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                        className="w-full border rounded-ios-lg px-3 py-2 text-sm bg-white"
                                        rows={3}
                                        placeholder="Additional notes for the supplier..."
                                    />
                                </div>
                            </div>
                        </DialogBody>
                        <DialogFooter>
                            <IOSButton variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</IOSButton>
                            <IOSButton
                                onClick={handleCreateOrder}
                                disabled={!formData.supplier_id || !formData.items.some(i => i.item_id && i.quantity > 0)}
                            >
                                Create Purchase Order
                            </IOSButton>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* View Modal */}
                <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                    <DialogContent className="max-w-4xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Purchase Order: {selectedOrder?.po_number}
                            </DialogTitle>
                        </DialogHeader>
                        <DialogBody>
                            {selectedOrder && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6 bg-gray-50/50 p-4 rounded-ios-lg border">
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Supplier</p>
                                            <p className="font-semibold text-gray-900">{selectedOrder.supplier?.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Status</p>
                                            <IOSBadge className={getStatusColor(selectedOrder.status)}>
                                                {selectedOrder.status}
                                            </IOSBadge>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Created Date</p>
                                            <p className="font-medium text-gray-900">{formatDate(selectedOrder.created_at)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Expected Delivery</p>
                                            <p className="font-medium text-gray-900">{selectedOrder.expected_delivery ? formatDate(selectedOrder.expected_delivery) : 'Not specified'}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                            <Package className="h-4 w-4" />
                                            Order Items
                                        </p>
                                        <div className="border rounded-ios-lg overflow-hidden bg-white shadow-sm">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 border-b">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left font-medium text-gray-600">Item Description</th>
                                                        <th className="px-4 py-3 text-right font-medium text-gray-600">Quantity</th>
                                                        <th className="px-4 py-3 text-right font-medium text-gray-600">Unit Price</th>
                                                        <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {(selectedOrder.items || []).map((item, idx) => (
                                                        <tr key={item.id || idx} className="hover:bg-gray-50/50 transition-colors">
                                                            <td className="px-4 py-3 text-gray-900 font-medium">{item.item?.name || `Item #${item.item_id}`}</td>
                                                            <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                                                            <td className="px-4 py-3 text-right text-gray-700">KES {item.unit_price?.toLocaleString()}</td>
                                                            <td className="px-4 py-3 text-right font-bold text-gray-900">KES {item.total?.toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="bg-gray-50/80 border-t">
                                                    <tr>
                                                        <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gray-600">Total Order Amount</td>
                                                        <td className="px-4 py-3 text-right font-bold text-lg text-blue-600">KES {selectedOrder.total_amount?.toLocaleString()}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>

                                    {selectedOrder.notes && (
                                        <div className="bg-blue-50/30 p-4 rounded-ios-lg border border-blue-100/50">
                                            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                <FileText className="h-3.5 w-3.5" />
                                                Internal Notes
                                            </p>
                                            <p className="text-sm text-gray-700 leading-relaxed italic">"{selectedOrder.notes}"</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </DialogBody>
                        <DialogFooter className="gap-2">
                            <IOSButton variant="outline" onClick={() => setIsViewModalOpen(false)}>Close</IOSButton>
                            {selectedOrder && (
                                <div className="flex gap-2">
                                    <IOSButton
                                        variant="outline"
                                        onClick={() => downloadPurchaseOrderPDF(selectedOrder)}
                                        leftIcon={<Download className="h-4 w-4" />}
                                    >
                                        Download PDF
                                    </IOSButton>
                                    <IOSButton
                                        variant="primary"
                                        onClick={() => printPurchaseOrderPDF(selectedOrder)}
                                        leftIcon={<Printer className="h-4 w-4" />}
                                    >
                                        Print PO
                                    </IOSButton>
                                </div>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>

            {/* Create Invoice Modal */}
            <Dialog open={isInvoiceModalOpen} onOpenChange={setIsInvoiceModalOpen}>
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Record Supplier Invoice
                        </DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-gray-700">Supplier *</label>
                                    <select
                                        value={invoiceFormData.supplier_id}
                                        onChange={(e) => setInvoiceFormData(prev => ({ ...prev, supplier_id: e.target.value }))}
                                        className="w-full border rounded-ios-lg px-3 py-2 text-sm bg-white"
                                    >
                                        <option key="inv-supplier-placeholder" value="">Select Supplier</option>
                                        {suppliers.map((s) => (
                                            <option key={`supplier-${s.id}`} value={String(s.id)}>{s.name}</option>
                                        ))}
                                        <option key="inv-supplier-other" value="other">- Other (Manual Entry) -</option>
                                    </select>
                                </div>
                                {invoiceFormData.supplier_id === 'other' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium mb-1.5 text-gray-700">Supplier Name *</label>
                                            <Input
                                                value={invoiceFormData.other_supplier_name}
                                                onChange={(e) => setInvoiceFormData(prev => ({ ...prev, other_supplier_name: e.target.value }))}
                                                placeholder="Enter supplier name"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1.5 text-gray-700">Supplier PIN (Optional)</label>
                                            <Input
                                                value={invoiceFormData.manual_supplier_pin}
                                                onChange={(e) => setInvoiceFormData(prev => ({ ...prev, manual_supplier_pin: e.target.value }))}
                                                placeholder="KRA PIN"
                                            />
                                        </div>
                                    </>
                                )}
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-gray-700">Invoice Number *</label>
                                    <Input
                                        value={invoiceFormData.invoice_number}
                                        onChange={(e) => setInvoiceFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                                        placeholder="INV/2024/001"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-gray-700">Invoice Date</label>
                                    <Input
                                        type="date"
                                        value={invoiceFormData.invoice_date}
                                        onChange={(e) => setInvoiceFormData(prev => ({ ...prev, invoice_date: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-gray-700">Due Date</label>
                                    <Input
                                        type="date"
                                        value={invoiceFormData.due_date}
                                        onChange={(e) => setInvoiceFormData(prev => ({ ...prev, due_date: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block text-sm font-medium text-gray-700">Invoice Items *</label>
                                    <IOSButton size="sm" variant="outline" onClick={() => setInvoiceFormData(p => ({ ...p, items: [...p.items, { _id: Math.random().toString(36).substr(2, 9), description: '', quantity: 1, unit_price: 0, vat_rate: 16 }] }))} leftIcon={<Plus />}>Add Item</IOSButton>
                                </div>
                                <div className="space-y-3 border rounded-ios-lg p-4 bg-gray-50/50">
                                    {invoiceFormData.items.map((item, index) => (
                                        <div key={item._id} className="flex items-center gap-3">
                                            <Input
                                                placeholder="Description"
                                                value={item.description}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setInvoiceFormData(prev => ({
                                                        ...prev,
                                                        items: prev.items.map((it, i) => i === index ? { ...it, description: val } : it)
                                                    }));
                                                }}
                                                className="flex-1 bg-white"
                                            />
                                            <div className="w-20">
                                                <Input
                                                    type="number"
                                                    placeholder="Qty"
                                                    value={item.quantity}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        setInvoiceFormData(prev => ({
                                                            ...prev,
                                                            items: prev.items.map((it, i) => i === index ? { ...it, quantity: val } : it)
                                                        }));
                                                    }}
                                                />
                                            </div>
                                            <div className="w-32">
                                                <Input
                                                    type="number"
                                                    placeholder="Price"
                                                    value={item.unit_price}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        setInvoiceFormData(prev => ({
                                                            ...prev,
                                                            items: prev.items.map((it, i) => i === index ? { ...it, unit_price: val } : it)
                                                        }));
                                                    }}
                                                />
                                            </div>
                                            <div className="w-24">
                                                <select
                                                    value={item.vat_rate}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        setInvoiceFormData(prev => ({
                                                            ...prev,
                                                            items: prev.items.map((it, i) => i === index ? { ...it, vat_rate: val } : it)
                                                        }));
                                                    }}
                                                    className="w-full border rounded-ios-lg px-2 py-2 text-sm bg-white"
                                                >
                                                    <option value={16}>16% VAT</option>
                                                    <option value={0}>0% VAT</option>
                                                </select>
                                            </div>
                                            {invoiceFormData.items.length > 1 && (
                                                <button onClick={() => setInvoiceFormData(p => ({ ...p, items: p.items.filter((_, i) => i !== index) }))} className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <div className="flex justify-end pt-3 border-t">
                                        <div className="text-right space-y-1">
                                            <p className="text-sm text-gray-500">Subtotal: KES {invoiceFormData.items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0).toLocaleString()}</p>
                                            <p className="text-sm text-gray-500">VAT: KES {invoiceFormData.items.reduce((sum, i) => sum + (i.quantity * i.unit_price * (i.vat_rate / 100)), 0).toLocaleString()}</p>
                                            <p className="text-xl font-bold">Total: KES {invoiceFormData.items.reduce((sum, i) => sum + (i.quantity * i.unit_price * (1 + i.vat_rate / 100)), 0).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-gray-700">Notes</label>
                                <textarea
                                    value={invoiceFormData.notes}
                                    onChange={(e) => setInvoiceFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full border rounded-ios-lg px-3 py-2 text-sm bg-white"
                                    rows={3}
                                    placeholder="Additional notes..."
                                />
                            </div>
                        </div>
                    </DialogBody>
                    <DialogFooter>
                        <IOSButton variant="outline" onClick={() => setIsInvoiceModalOpen(false)}>Cancel</IOSButton>
                        <IOSButton
                            onClick={handleCreateInvoice}
                            disabled={
                                (!invoiceFormData.supplier_id && !invoiceFormData.other_supplier_name) ||
                                (invoiceFormData.supplier_id === 'other' && !invoiceFormData.other_supplier_name) ||
                                !invoiceFormData.invoice_number ||
                                invoiceFormData.items.some(i => !i.description || i.quantity <= 0)
                            }
                        >
                            Record Invoice
                        </IOSButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Invoice Modal */}
            <Dialog open={isViewInvoiceOpen} onOpenChange={setIsViewInvoiceOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Invoice: {viewInvoice?.invoice_number}
                        </DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        {viewInvoice && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6 bg-gray-50/50 p-4 rounded-ios-lg border">
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Supplier</p>
                                        <p className="font-semibold text-gray-900">{viewInvoice.supplier?.name || viewInvoice.other_supplier_name || viewInvoice.supplier_name || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Status</p>
                                        <IOSBadge className="bg-blue-100 text-blue-700">{viewInvoice.status}</IOSBadge>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Invoice Date</p>
                                        <p className="font-medium text-gray-900">{formatDate(viewInvoice.invoice_date)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Due Date</p>
                                        <p className="font-medium text-gray-900">{formatDate(viewInvoice.due_date)}</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <Receipt className="h-4 w-4" />
                                        Invoice Breakdown
                                    </p>
                                    <div className="border rounded-ios-lg overflow-hidden bg-white shadow-sm">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 border-b">
                                                <tr>
                                                    <th className="px-4 py-3 text-left font-medium text-gray-600">Description</th>
                                                    <th className="px-4 py-3 text-right font-medium text-gray-600">Qty</th>
                                                    <th className="px-4 py-3 text-right font-medium text-gray-600">Unit Price</th>
                                                    <th className="px-4 py-3 text-right font-medium text-gray-600">VAT</th>
                                                    <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {(viewInvoice.items || []).map((item, idx) => (
                                                    <tr key={item.id || idx} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-4 py-3 text-gray-900 font-medium">{item.description || item.item?.name || 'Item'}</td>
                                                        <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                                                        <td className="px-4 py-3 text-right text-gray-700">KES {item.unit_price?.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right text-gray-700">{item.vat_rate}%</td>
                                                        <td className="px-4 py-3 text-right font-bold text-gray-900">KES {item.total_amount?.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50/80 border-t">
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-600">Subtotal</td>
                                                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                                                        KES {(viewInvoice.subtotal || (viewInvoice.items || []).reduce((s, i) => s + (i.quantity * i.unit_price), 0))?.toLocaleString()}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-600">VAT Amount</td>
                                                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                                                        KES {(viewInvoice.vat_amount || (viewInvoice.items || []).reduce((s, i) => s + (i.vat_amount || (i.quantity * i.unit_price * i.vat_rate / 100)), 0))?.toLocaleString()}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-600">Grand Total</td>
                                                    <td className="px-4 py-3 text-right font-bold text-lg text-blue-600">
                                                        KES {(viewInvoice.total_amount || (viewInvoice.items || []).reduce((s, i) => s + (i.total_amount || (i.quantity * i.unit_price * (1 + i.vat_rate / 100))), 0))?.toLocaleString()}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </DialogBody>
                    <DialogFooter className="flex justify-between items-center">
                        <div className="flex gap-2">
                            <IOSButton 
                                size="sm" 
                                variant="outline" 
                                onClick={async () => {
                                    if (viewInvoice) {
                                        try {
                                            await downloadInvoicePDF(viewInvoice);
                                        } catch (error) {
                                            console.error('Error downloading invoice:', error);
                                            toast.error('Failed to download invoice PDF');
                                        }
                                    }
                                }} 
                                leftIcon={<Download />}
                            >
                                Download
                            </IOSButton>
                            <IOSButton 
                                size="sm" 
                                variant="outline" 
                                onClick={async () => {
                                    if (viewInvoice) {
                                        try {
                                            await printInvoicePDF(viewInvoice);
                                        } catch (error) {
                                            console.error('Error printing invoice:', error);
                                            toast.error('Failed to print invoice PDF');
                                        }
                                    }
                                }} 
                                leftIcon={<Printer />}
                            >
                                Print
                            </IOSButton>
                        </div>
                        <IOSButton variant="outline" onClick={() => setIsViewInvoiceOpen(false)}>Close</IOSButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </ProtectedRoute>
    );
}
