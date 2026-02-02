'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    ShoppingCart, Plus, RefreshCw, Eye, Check, X, Clock,
    Search, Filter, Package, Building2, Calendar, FileText,
    Truck, AlertTriangle, CheckCircle, XCircle, Edit, Trash2,
    DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';

interface PurchaseOrder {
    id: string;
    po_number: string;
    supplier_id: string;
    supplier?: { id: string; name: string; contact_person?: string; supplier_code?: string };
    status: string;
    total_amount: number;
    subtotal: number;
    vat_amount: number;
    expected_delivery_date?: string;
    notes?: string;
    items: any[];
    created_at: string;
    created_by_user?: { first_name: string; last_name: string };
    is_confirmed: boolean;
}

export default function ProcurementPurchaseOrdersPage() {
    const { user } = useAuth();
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

    useEffect(() => {
        fetchOrders();
    }, [statusFilter]);

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            // Using the new procurement specific API endpoint
            const response = await api.procurement.getPurchaseOrders(statusFilter);
            if (response.success) {
                setOrders(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching POs:', error);
            toast.error('Failed to load purchase orders');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async (orderId: string) => {
        try {
            const response = await api.procurement.approvePurchaseOrder(orderId);
            if (response.success) {
                toast.success('Purchase order approved');
                fetchOrders();
            }
        } catch (error) {
            toast.error('Failed to approve order');
        }
    };

    const handleCancel = async (orderId: string) => {
        try {
            const response = await api.procurement.cancelPurchaseOrder(orderId);
            if (response.success) {
                toast.success('Purchase order cancelled');
                fetchOrders();
            }
        } catch (error) {
            toast.error('Failed to cancel order');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'draft': return <Badge variant="outline" className="bg-stone-100 text-stone-600">Draft</Badge>;
            case 'pending': return <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
            case 'approved': return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Approved</Badge>;
            case 'ordered': return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Ordered</Badge>;
            case 'received': return <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-200">Received</Badge>;
            case 'partially_received': return <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">Partial</Badge>;
            case 'cancelled': return <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200">Cancelled</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const filteredOrders = orders.filter(o =>
        o.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.PROCUREMENT, UserRole.PURCHASING_MANAGER, UserRole.AUDITOR]}>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <ShoppingCart className="h-6 w-6 text-stone-700" />
                            Purchase Orders
                        </h1>
                        <p className="text-stone-500">Manage procurement cycles and track deliveries</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={fetchOrders} disabled={isLoading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        {[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.PROCUREMENT, UserRole.AUDITOR].includes(user?.role!) && (
                            <Button asChild>
                                <Link href="/dashboard/auditor/procurement/purchase-orders/new">
                                    <Plus className="h-4 w-4 mr-2" />
                                    New Order
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>

                {/* Filters and Search */}
                <Card className="bg-white border-stone-200 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="relative flex-1 min-w-[300px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-stone-400" />
                                <Input
                                    placeholder="Search by PO number or supplier..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 h-10"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-stone-500" />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="h-10 border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                                >
                                    <option value="">All Statuses</option>
                                    <option value="draft">Draft</option>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="ordered">Ordered</option>
                                    <option value="received">Received</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Table */}
                <Card className="bg-white border-stone-200 shadow-sm overflow-hidden">
                    {isLoading ? (
                        <div className="p-12 text-center text-stone-500">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-stone-300" />
                            <p>Loading purchase orders...</p>
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="p-12 text-center text-stone-500">
                            <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p className="text-lg font-medium">No purchase orders found</p>
                            <p className="text-sm mt-1">Try adjusting your search or filters</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-stone-50 hover:bg-stone-50">
                                    <TableHead className="w-[150px]">PO Number</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Amount (KES)</TableHead>
                                    <TableHead>Delivery Expected</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredOrders.map((order) => (
                                    <TableRow key={order.id} className="hover:bg-stone-50/50">
                                        <td className="px-4 py-4 font-mono font-medium text-sm">{order.po_number}</td>
                                        <td className="px-4 py-4">
                                            <div className="font-medium text-stone-900">{order.supplier?.name}</div>
                                            <div className="text-xs text-stone-500">{order.supplier?.supplier_code}</div>
                                        </td>
                                        <td className="px-4 py-4">{getStatusBadge(order.status)}</td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="font-semibold text-stone-900">{order.total_amount?.toLocaleString()}</div>
                                            <div className="text-[10px] text-stone-400">VAT: {order.vat_amount?.toLocaleString()}</div>
                                        </td>
                                        <td className="px-4 py-4 text-sm text-stone-600">
                                            {order.expected_delivery_date ? formatDate(order.expected_delivery_date) : (
                                                <span className="text-stone-300 italic">Not set</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => { setSelectedOrder(order); setIsViewModalOpen(true); }} className="text-stone-600">
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                {order.status === 'pending' && [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.PURCHASING_MANAGER].includes(user?.role!) && (
                                                    <Button variant="ghost" size="sm" onClick={() => handleApprove(order.id)} className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {['draft', 'pending'].includes(order.status) && [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.PROCUREMENT].includes(user?.role!) && (
                                                    <Button variant="ghost" size="sm" onClick={() => handleCancel(order.id)} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </Card>

                {/* View Modal */}
                <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <div className="flex justify-between items-start">
                                <DialogTitle className="text-sm font-mono text-stone-400">PURCHASE ORDER: {selectedOrder?.po_number}</DialogTitle>
                                <div className="mr-6">{getStatusBadge(selectedOrder?.status!)}</div>
                            </div>
                        </DialogHeader>
                        {selectedOrder && (
                            <div className="space-y-6 py-4">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Supplier</p>
                                        <p className="font-semibold text-stone-900">{selectedOrder.supplier?.name}</p>
                                        <p className="text-xs text-stone-500">VAT PIN: {selectedOrder.supplier?.supplier_code}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Expected Delivery</p>
                                        <p className="font-medium text-stone-700">{selectedOrder.expected_delivery_date ? formatDate(selectedOrder.expected_delivery_date) : 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Created By</p>
                                        <p className="font-medium text-stone-700">{selectedOrder.created_by_user?.first_name} {selectedOrder.created_by_user?.last_name}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Created At</p>
                                        <p className="font-medium text-stone-700">{formatDate(selectedOrder.created_at)}</p>
                                    </div>
                                </div>

                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-stone-50">
                                            <TableRow>
                                                <TableHead>Item</TableHead>
                                                <TableHead className="text-right">Qty</TableHead>
                                                <TableHead className="text-right">Unit Price</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedOrder.items?.map((item, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-medium">{item.item?.item_name || 'Stock Item'}</TableCell>
                                                    <TableCell className="text-right">{item.quantity} {item.item?.unit || 'pcs'}</TableCell>
                                                    <TableCell className="text-right">{item.unit_price?.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right font-semibold">{item.total?.toLocaleString()}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                <div className="flex justify-end">
                                    <div className="w-64 space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-stone-500">Subtotal:</span>
                                            <span className="font-medium">KES {selectedOrder.subtotal?.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-stone-500">VAT (16%):</span>
                                            <span className="font-medium">KES {selectedOrder.vat_amount?.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-lg pt-2 border-t font-bold text-stone-900">
                                            <span>Total:</span>
                                            <span>KES {selectedOrder.total_amount?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                {selectedOrder.notes && (
                                    <div className="bg-stone-50 p-4 rounded-lg border border-stone-100">
                                        <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">Notes</p>
                                        <p className="text-sm text-stone-700">{selectedOrder.notes}</p>
                                    </div>
                                )}

                                <div className="flex justify-between items-center pt-4 border-t">
                                    <div className="flex items-center gap-2">
                                        {selectedOrder.is_confirmed ? (
                                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 flex items-center gap-1">
                                                <CheckCircle className="h-3 w-3" /> Supplier Confirmed
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-stone-400 border-stone-100">Pending Confirmation</Badge>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>Close</Button>
                                        {selectedOrder.status === 'pending' && [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.PURCHASING_MANAGER].includes(user?.role!) && (
                                            <Button className="bg-stone-800" onClick={() => handleApprove(selectedOrder.id)}>Approve PO</Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </ProtectedRoute>
    );
}
