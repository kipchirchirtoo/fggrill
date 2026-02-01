'use client';

import React, { useState, useEffect } from 'react';
import {
    ShoppingCart,
    Package,
    Users,
    FileText,
    TrendingUp,
    AlertCircle,
    Clock,
    CheckCircle2,
    XCircle,
    Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function ProcurementDashboard() {
    const [stats, setStats] = useState({
        pendingPOs: 0,
        openGRNIs: 0,
        pendingInvoices: 0,
        lowStockItems: 0
    });

    const [recentPOs, setRecentPOs] = useState([]);

    // Mock data for initial layout - will be replaced with API calls
    useEffect(() => {
        setStats({
            pendingPOs: 5,
            openGRNIs: 12,
            pendingInvoices: 8,
            lowStockItems: 14
        });

        setRecentPOs([
            { id: '1', po_number: 'PO240201001', supplier: 'Fresh Foods Ltd', total: 45000, status: 'pending', date: '2024-02-01' },
            { id: '2', po_number: 'PO240131004', supplier: 'Clean Supplies Co', total: 12500, status: 'approved', date: '2024-01-31' },
            { id: '3', po_number: 'PO240131002', supplier: 'Global Stationery', total: 8400, status: 'received', date: '2024-01-31' },
        ]);
    }, []);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900">Procurement Overview</h1>
                    <p className="text-stone-500 text-sm">Manage your supply chain and accounts payable</p>
                </div>
                <div className="flex gap-3">
                    <Button asChild>
                        <Link href="/dashboard/procurement/purchase-orders/new">
                            <Plus className="h-4 w-4 mr-2" />
                            New Purchase Order
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white border-stone-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-stone-600">Pending POs</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-stone-900">{stats.pendingPOs}</div>
                        <p className="text-xs text-stone-400 mt-1">Awaiting approval</p>
                    </CardContent>
                </Card>

                <Card className="bg-white border-stone-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-stone-600">Open GRNI</CardTitle>
                        <Package className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-stone-900">{stats.openGRNIs}</div>
                        <p className="text-xs text-stone-400 mt-1">Received, not invoiced</p>
                    </CardContent>
                </Card>

                <Card className="bg-white border-stone-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-stone-600">Pending Invoices</CardTitle>
                        <FileText className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-stone-900">{stats.pendingInvoices}</div>
                        <p className="text-xs text-stone-400 mt-1">Ready for payment</p>
                    </CardContent>
                </Card>

                <Card className="bg-white border-stone-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-stone-600">Low Stock</CardTitle>
                        <AlertCircle className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-stone-900">{stats.lowStockItems}</div>
                        <p className="text-xs text-stone-400 mt-1">Items below reorder level</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Purchase Orders */}
                <Card className="lg:col-span-2 bg-white border-stone-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Recent Purchase Orders</CardTitle>
                        <CardDescription>Latest procurement activities</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>PO Number</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Total (KES)</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentPOs.map((po) => (
                                    <TableRow key={po.id}>
                                        <TableCell className="font-medium">{po.po_number}</TableCell>
                                        <TableCell>{po.supplier}</TableCell>
                                        <TableCell>{po.total.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                po.status === 'approved' ? 'success' :
                                                    po.status === 'received' ? 'info' :
                                                        'warning'
                                            }>
                                                {po.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href={`/dashboard/procurement/purchase-orders/${po.id}`}>View</Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Quick Actions & Links */}
                <div className="space-y-6">
                    <Card className="bg-white border-stone-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Quick Access</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button variant="outline" className="w-full justify-start text-stone-600" asChild>
                                <Link href="/dashboard/procurement/suppliers">
                                    <Users className="h-4 w-4 mr-2" />
                                    Supplier Directory
                                </Link>
                            </Button>
                            <Button variant="outline" className="w-full justify-start text-stone-600" asChild>
                                <Link href="/dashboard/procurement/items">
                                    <Package className="h-4 w-4 mr-2" />
                                    Item Master List
                                </Link>
                            </Button>
                            <Button variant="outline" className="w-full justify-start text-stone-600" asChild>
                                <Link href="/dashboard/procurement/reports/aging">
                                    <TrendingUp className="h-4 w-4 mr-2" />
                                    Aging Analysis
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="bg-amber-50 border-amber-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-amber-900 flex items-center">
                                <ShieldCheck className="h-5 w-5 mr-2 text-amber-600" />
                                Compliance Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-stone-600">KRA VAT PINs Verified</span>
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-stone-600">Audit Logs Active</span>
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-stone-600">Open GRNIs {stats.openGRNIs > 10 ? '(Attention!)' : ''}</span>
                                    {stats.openGRNIs > 10 ? <AlertCircle className="h-4 w-4 text-rose-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
import { ShieldCheck } from 'lucide-react';
