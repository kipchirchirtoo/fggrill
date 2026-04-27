'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    ShoppingCart, RefreshCw, Eye, Check, X, Clock,
    Search, Filter, Package, Building2, Calendar, FileText,
    Truck, AlertTriangle, CheckCircle, XCircle, Download, Printer,
    ShieldCheck, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { downloadPurchaseOrderPDF, printPurchaseOrderPDF } from '@/lib/purchase-order-pdf';
import { API_URL } from '@/lib/config';


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
    branch_name?: string; // Optional if we fetch with branch info
}

interface POItem {
    id?: string;
    item_id: number;
    item?: { id: number; name: string; sku: string };
    quantity: number;
    unit_price: number;
    total: number;
}

export default function AuditorPurchasesPage() {
    const { user } = useAuth();
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

    useEffect(() => {
        fetchOrders();
    }, [statusFilter]);

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            // Auditors can see all modules - don't filter by source_module
            const response = await fetch(`${API_URL}/api/procurement/purchase-orders${statusFilter ? `?status=${statusFilter}` : ''}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setOrders(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
            toast.error('Failed to load purchase orders');
        } finally {
            setIsLoading(false);
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

    const filteredOrders = orders.filter(o =>
        o.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
                                <ShieldCheck className="h-6 w-6 text-emerald-600" />
                                Purchase Audit Oversight
                            </h1>
                            <p className="text-gray-500 text-sm">Reviewing all company procurement and purchase orders</p>
                        </div>
                        <IOSButton variant="outline" onClick={fetchOrders} disabled={isLoading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh Data
                        </IOSButton>
                    </div>

                    {/* Filters */}
                    <div className="flex gap-4 items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search PO#, Supplier..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-11 bg-white border-ios-gray-200"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="h-11 border-ios-gray-200 rounded-ios-lg px-3 text-sm bg-white"
                        >
                            <option value="">All Statuses</option>
                            <option value="PENDING">Pending Approval</option>
                            <option value="APPROVED">Approved</option>
                            <option value="ORDERED">Ordered</option>
                            <option value="RECEIVED">Received</option>
                            <option value="CANCELLED">Cancelled</option>
                        </select>
                    </div>

                    {/* List */}
                    <IOSCard className="overflow-hidden border-none shadow-ios-soft">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100">
                                        <th className="px-6 py-4 text-left font-semibold text-gray-600 uppercase tracking-wider text-[11px]">PO Number</th>
                                        <th className="px-6 py-4 text-left font-semibold text-gray-600 uppercase tracking-wider text-[11px]">Supplier</th>
                                        <th className="px-6 py-4 text-left font-semibold text-gray-600 uppercase tracking-wider text-[11px]">Status</th>
                                        <th className="px-6 py-4 text-right font-semibold text-gray-600 uppercase tracking-wider text-[11px]">Total Value</th>
                                        <th className="px-6 py-4 text-left font-semibold text-gray-600 uppercase tracking-wider text-[11px]">Date Created</th>
                                        <th className="px-6 py-4 text-right font-semibold text-gray-600 uppercase tracking-wider text-[11px]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {isLoading ? (
                                        <tr><td colSpan={6} className="text-center py-20 text-gray-400 font-medium">Fetching procurement data...</td></tr>
                                    ) : filteredOrders.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-20">
                                            <div className="flex flex-col items-center gap-2 opacity-30">
                                                <ShoppingCart className="h-12 w-12" />
                                                <p className="font-medium text-lg text-gray-900">No purchase orders found</p>
                                            </div>
                                        </td></tr>
                                    ) : filteredOrders.map((order) => (
                                        <tr key={order.id} className="hover:bg-ios-gray-50 group transition-colors duration-200">
                                            <td className="px-6 py-5 font-mono font-bold text-blue-600">{order.po_number}</td>
                                            <td className="px-6 py-5">
                                                <div className="font-semibold text-gray-900">{order.supplier?.name || '-'}</div>
                                                <div className="text-[11px] text-gray-500 uppercase font-medium">{order.supplier?.contact_person || 'No Contact'}</div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <IOSBadge className={getStatusColor(order.status)}>
                                                    {order.status}
                                                </IOSBadge>
                                            </td>
                                            <td className="px-6 py-5 text-right font-bold text-gray-900">
                                                KES {order.total_amount?.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-5 text-gray-500 text-[13px]">
                                                {formatDate(order.created_at)}
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => { setSelectedOrder(order); setIsViewModalOpen(true); }}
                                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-ios-lg transition-all"
                                                        title="Audit View"
                                                    >
                                                        <Eye className="h-5 w-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => downloadPurchaseOrderPDF(order)}
                                                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-ios-lg transition-all"
                                                        title="Download Official PO"
                                                    >
                                                        <Download className="h-5 w-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => printPurchaseOrderPDF(order)}
                                                        className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-ios-lg transition-all"
                                                        title="Quick Print"
                                                    >
                                                        <Printer className="h-5 w-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </IOSCard>
                </div>

                {/* View Modal */}
                <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                    <DialogContent className="max-w-3xl border-none shadow-2xl p-0 overflow-hidden rounded-ios-2xl">
                        <div className="bg-gray-50/80 p-6 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-xl font-extrabold text-gray-900 font-ios-system tracking-tight">
                                    Purchase Order Detail
                                </DialogTitle>
                                <div className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Audit Mode: Global Visibility</div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-sm font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{selectedOrder?.po_number}</span>
                            </div>
                        </div>

                        {selectedOrder && (
                            <div className="p-8 space-y-8 max-h-[75vh] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Vendor Information</h4>
                                        <p className="font-bold text-gray-900 text-lg leading-tight">{selectedOrder.supplier?.name}</p>
                                        <p className="text-gray-500 text-sm mt-1">{selectedOrder.supplier?.contact_person}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Status & Control</h4>
                                        <div className="flex items-center gap-2">
                                            <IOSBadge className={`${getStatusColor(selectedOrder.status)} py-1 px-3 text-sm`}>{selectedOrder.status}</IOSBadge>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Order Timeline</h4>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Created:</span>
                                                <span className="font-bold text-gray-900">{formatDate(selectedOrder.created_at)}</span>
                                            </div>
                                            {selectedOrder.expected_delivery && (
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-400">Expected:</span>
                                                    <span className="font-bold text-amber-600">{formatDate(selectedOrder.expected_delivery)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Financial Totals</h4>
                                        <p className="text-2xl font-black text-gray-900 tracking-tighter">KES {selectedOrder.total_amount?.toLocaleString()}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Inclusive of VAT (16%)</p>
                                    </div>
                                </div>

                                <div className="border-t border-ios-gray-100 pt-6">
                                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-4">SKU / Item Breakdown</h4>
                                    <div className="rounded-ios-xl border border-ios-gray-100 overflow-hidden shadow-sm">
                                        <table className="w-full text-sm">
                                            <thead className="bg-ios-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left font-bold text-gray-600 text-[11px]">DESCRIPTION</th>
                                                    <th className="px-4 py-3 text-right font-bold text-gray-600 text-[11px]">QTY</th>
                                                    <th className="px-4 py-3 text-right font-bold text-gray-600 text-[11px]">UNIT PRICE</th>
                                                    <th className="px-4 py-3 text-right font-bold text-gray-600 text-[11px]">SUBTOTAL</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-ios-gray-50 bg-white">
                                                {(selectedOrder.items || []).map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-ios-gray-50 transition-colors">
                                                        <td className="px-4 py-4 font-bold text-gray-800">
                                                            {item.item?.name || `Item #${item.item_id}`}
                                                            <div className="text-[10px] text-gray-400 font-medium tracking-wider leading-none mt-1">SKU: {item.item?.sku || 'N/A'}</div>
                                                        </td>
                                                        <td className="px-4 py-4 text-right font-extrabold text-blue-600">{item.quantity}</td>
                                                        <td className="px-4 py-4 text-right text-gray-500 font-medium">KES {item.unit_price?.toLocaleString()}</td>
                                                        <td className="px-4 py-4 text-right font-bold text-gray-900">KES {item.total?.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {selectedOrder.notes && (
                                    <div className="bg-ios-gray-50 p-4 rounded-ios-lg border border-ios-gray-100">
                                        <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Special Instructions / Notes</h4>
                                        <p className="text-sm text-gray-700 italic leading-relaxed">"{selectedOrder.notes}"</p>
                                    </div>
                                )}

                                <div className="flex gap-4 border-t border-ios-gray-100 pt-8 mt-4">
                                    <IOSButton className="flex-1" leftIcon={<Download />} onClick={() => downloadPurchaseOrderPDF(selectedOrder)}>Download Official Copy</IOSButton>
                                    <IOSButton className="flex-1" variant="outline" leftIcon={<Printer />} onClick={() => printPurchaseOrderPDF(selectedOrder)}>Print for Filing</IOSButton>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
