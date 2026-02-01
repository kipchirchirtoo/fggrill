'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import {
    ShoppingCart, RefreshCw, Check, X, Clock,
    Package, Building2, Calendar, FileText,
    Truck, CheckCircle, ArrowLeft, Printer,
    DollarSign, User
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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

export default function PODetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [order, setOrder] = useState<PurchaseOrder | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (params.id) {
            fetchOrder();
        }
    }, [params.id]);

    const fetchOrder = async () => {
        setIsLoading(true);
        try {
            const response = await api.procurement.getPurchaseOrder(params.id as string);
            if (response.success) {
                setOrder(response.data);
            } else {
                toast.error('Failed to load purchase order');
            }
        } catch (error) {
            console.error('Error fetching PO:', error);
            toast.error('Error connecting to server');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!order) return;
        try {
            const response = await api.procurement.approvePurchaseOrder(order.id);
            if (response.success) {
                toast.success('Purchase order approved');
                fetchOrder();
            }
        } catch (error) {
            toast.error('Failed to approve order');
        }
    };

    const handleCancel = async () => {
        if (!order) return;
        try {
            const response = await api.procurement.cancelPurchaseOrder(order.id);
            if (response.success) {
                toast.success('Purchase order cancelled');
                fetchOrder();
            }
        } catch (error) {
            toast.error('Failed to cancel order');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'draft': return <Badge variant="outline" className="bg-stone-100 text-stone-600">Draft</Badge>;
            case 'pending': return <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">Pending Approval</Badge>;
            case 'approved': return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Approved</Badge>;
            case 'ordered': return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Ordered</Badge>;
            case 'received': return <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-200">Received</Badge>;
            case 'partially_received': return <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">Partially Received</Badge>;
            case 'cancelled': return <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200">Cancelled</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-[60vh] text-stone-500">
                    <RefreshCw className="h-8 w-8 animate-spin mb-4" />
                    <p>Loading order details...</p>
                </div>
            </DashboardLayout>
        );
    }

    if (!order) {
        return (
            <DashboardLayout>
                <div className="p-6 text-center">
                    <h2 className="text-xl font-bold">Order Not Found</h2>
                    <Button asChild className="mt-4">
                        <Link href="/dashboard/procurement/purchase-orders">Back to Orders</Link>
                    </Button>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.PROCUREMENT, UserRole.PURCHASING_MANAGER, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="p-6 space-y-6 max-w-5xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="sm" onClick={() => router.back()}>
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold font-mono tracking-tight text-stone-900">
                                    {order.po_number}
                                </h1>
                                <div className="flex items-center gap-2 mt-1">
                                    {getStatusBadge(order.status)}
                                    <span className="text-stone-400 text-xs">•</span>
                                    <span className="text-stone-500 text-sm">Created {formatDate(order.created_at)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => window.print()}>
                                <Printer className="h-4 w-4 mr-2" />
                                Print
                            </Button>
                            {order.status === 'pending' && [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.PURCHASING_MANAGER].includes(user?.role!) && (
                                <Button onClick={handleApprove} className="bg-emerald-600 hover:bg-emerald-700">
                                    Approve PO
                                </Button>
                            )}
                            {['draft', 'pending'].includes(order.status) && [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.PROCUREMENT].includes(user?.role!) && (
                                <Button variant="ghost" onClick={handleCancel} className="text-rose-600 hover:bg-rose-50">
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Summary Cards */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border border-stone-200 bg-white">
                                    <div className="flex items-center gap-2 text-stone-400 text-xs font-bold uppercase tracking-wider mb-2">
                                        <Building2 className="h-3 w-3" />
                                        Supplier Information
                                    </div>
                                    <p className="font-bold text-stone-900 text-lg">{order.supplier?.name}</p>
                                    <p className="text-sm text-stone-500 mt-1">Code: {order.supplier?.supplier_code || 'N/A'}</p>
                                    <p className="text-sm text-stone-500">Contact: {order.supplier?.contact_person || 'N/A'}</p>
                                </div>
                                <div className="p-4 rounded-xl border border-stone-200 bg-white">
                                    <div className="flex items-center gap-2 text-stone-400 text-xs font-bold uppercase tracking-wider mb-2">
                                        <Calendar className="h-3 w-3" />
                                        Delivery Timeline
                                    </div>
                                    <p className="font-bold text-stone-900 text-lg">
                                        {order.expected_delivery_date ? formatDate(order.expected_delivery_date) : 'Flexible'}
                                    </p>
                                    <p className="text-xs text-stone-500 mt-2 flex items-center gap-1">
                                        {order.is_confirmed ? (
                                            <><CheckCircle className="h-3 w-3 text-emerald-500" /> Supplier confirmed</>
                                        ) : (
                                            <><Clock className="h-3 w-3 text-amber-500" /> Awaiting confirmation</>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
                                <div className="p-4 border-b border-stone-100 bg-stone-50/50">
                                    <h3 className="font-bold text-stone-900 flex items-center gap-2">
                                        <Package className="h-4 w-4 text-stone-600" />
                                        Order Items
                                    </h3>
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Item Details</TableHead>
                                            <TableHead className="text-right">Quantity</TableHead>
                                            <TableHead className="text-right">Unit Price</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {order.items?.map((item, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>
                                                    <p className="font-medium text-stone-900">{item.item?.item_name || 'Stock Item'}</p>
                                                    <p className="text-[10px] text-stone-400 font-mono">SKU: {item.item?.sku || 'N/A'}</p>
                                                </TableCell>
                                                <TableCell className="text-right">{item.quantity} {item.item?.unit || 'pcs'}</TableCell>
                                                <TableCell className="text-right">{item.unit_price?.toLocaleString()}</TableCell>
                                                <TableCell className="text-right font-bold text-stone-900">{item.total?.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <div className="p-6 bg-stone-50/30 border-t border-stone-100 flex justify-end">
                                    <div className="w-64 space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-stone-500">Subtotal:</span>
                                            <span className="font-medium">KES {order.subtotal?.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-stone-500">VAT (16%):</span>
                                            <span className="font-medium">KES {order.vat_amount?.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xl pt-2 border-t font-black text-stone-900">
                                            <span>Total:</span>
                                            <span>KES {order.total_amount?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            <div className="p-5 rounded-xl border border-stone-200 bg-white shadow-sm space-y-4">
                                <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">Audit Information</h3>
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                                            <User className="h-4 w-4 text-stone-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-stone-400 uppercase font-bold tracking-tight">Prepared By</p>
                                            <p className="text-sm font-medium text-stone-900">
                                                {order.created_by_user?.first_name} {order.created_by_user?.last_name}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                                            <FileText className="h-4 w-4 text-stone-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-stone-400 uppercase font-bold tracking-tight">Compliance</p>
                                            <p className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                                                <CheckCircle className="h-3 w-3" /> System Verified
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {order.notes && (
                                <div className="p-5 rounded-xl border border-stone-200 bg-amber-50 shadow-sm">
                                    <div className="flex items-center gap-2 font-bold text-amber-900 text-xs uppercase tracking-wider mb-2">
                                        <FileText className="h-3 w-3 flex-shrink-0" />
                                        Order Notes
                                    </div>
                                    <p className="text-sm text-amber-800 leading-relaxed">
                                        {order.notes}
                                    </p>
                                </div>
                            )}

                            <div className="p-5 rounded-xl border border-stone-200 bg-stone-900 text-white shadow-sm">
                                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Quick Actions</p>
                                <div className="space-y-2">
                                    <Button variant="outline" className="w-full justify-start bg-white/5 border-white/10 hover:bg-white/10 text-white" asChild>
                                        <Link href={`/dashboard/procurement/suppliers/${order.supplier_id}`}>
                                            View Supplier File
                                        </Link>
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start bg-white/5 border-white/10 hover:bg-white/10 text-white">
                                        Email to Supplier
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
