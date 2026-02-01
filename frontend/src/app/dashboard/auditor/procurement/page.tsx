'use client';

import React, { useState, useEffect } from 'react';
import {
    ShieldCheck,
    CheckCircle,
    FileText,
    CreditCard,
    Search,
    ArrowRight,
    AlertCircle
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

export default function AuditorProcurementOverview() {
    const [pendingCounts, setPendingCounts] = useState({
        grns: 0,
        invoices: 0,
        payments: 0
    });

    const [pendingApprovals, setPendingApprovals] = useState([]);

    useEffect(() => {
        // Mock data for initial layout
        setPendingCounts({
            grns: 4,
            invoices: 7,
            payments: 3
        });

        setPendingApprovals([
            { id: '1', type: 'GRN', reference: 'GRN240201-01', entity: 'Fresh Foods Ltd', amount: 45000, date: '2024-02-01' },
            { id: '2', type: 'Invoice', reference: 'INV-7890', entity: 'Clean Supplies Co', amount: 12500, date: '2024-01-31' },
            { id: '3', type: 'Invoice', reference: 'INV-4452', entity: 'Global Stationery', amount: 8400, date: '2024-01-31' },
            { id: '4', type: 'Payment', reference: 'PAY240131-01', entity: 'Prime Meats', amount: 67000, date: '2024-01-31' },
        ]);
    }, []);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 flex items-center">
                        <ShieldCheck className="h-7 w-7 mr-2 text-amber-600" />
                        Procurement Verification
                    </h1>
                    <p className="text-stone-500 text-sm">Auditor dashboard for statutory compliance and transactional integrity</p>
                </div>
            </div>

            {/* Approval Queue Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white border-stone-200 hover:border-amber-300 transition-colors shadow-sm cursor-pointer" onClick={() => window.location.href = '/dashboard/auditor/procurement/grn'}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-stone-600">GRN Approvals</CardTitle>
                        <div className="p-1.5 bg-blue-100 rounded-full">
                            <CheckCircle className="h-4 w-4 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-stone-900">{pendingCounts.grns}</div>
                        <p className="text-xs text-stone-400 mt-1">Goods received awaiting verification</p>
                        <div className="mt-4 flex items-center text-xs text-blue-600 font-medium">
                            View Queue <ArrowRight className="h-3 w-3 ml-1" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-stone-200 hover:border-amber-300 transition-colors shadow-sm cursor-pointer" onClick={() => window.location.href = '/dashboard/auditor/procurement/invoices'}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-stone-600">Invoice Verification</CardTitle>
                        <div className="p-1.5 bg-emerald-100 rounded-full">
                            <FileText className="h-4 w-4 text-emerald-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-stone-900">{pendingCounts.invoices}</div>
                        <p className="text-xs text-stone-400 mt-1">Invoices awaiting VAT & total matching</p>
                        <div className="mt-4 flex items-center text-xs text-emerald-600 font-medium">
                            View Queue <ArrowRight className="h-3 w-3 ml-1" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-stone-200 hover:border-amber-300 transition-colors shadow-sm cursor-pointer" onClick={() => window.location.href = '/dashboard/auditor/procurement/payments'}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-stone-600">Payment Approvals</CardTitle>
                        <div className="p-1.5 bg-amber-100 rounded-full">
                            <CreditCard className="h-4 w-4 text-amber-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-stone-900">{pendingCounts.payments}</div>
                        <p className="text-xs text-stone-400 mt-1">Authorized payments awaiting processing</p>
                        <div className="mt-4 flex items-center text-xs text-amber-600 font-medium">
                            View Queue <ArrowRight className="h-3 w-3 ml-1" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Unified Approval Queue */}
            <Card className="bg-white border-stone-200 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg text-stone-800">Unified Approval Queue</CardTitle>
                        <CardDescription>Priority items requiring auditor attention</CardDescription>
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Search reference..."
                            className="pl-9 h-9 w-full rounded-md border border-stone-200 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Reference</TableHead>
                                <TableHead>Entity</TableHead>
                                <TableHead>Amount (KES)</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pendingApprovals.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <Badge variant="outline" className={
                                            item.type === 'GRN' ? 'text-blue-600 border-blue-200 bg-blue-50' :
                                                item.type === 'Invoice' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' :
                                                    'text-amber-600 border-amber-200 bg-amber-50'
                                        }>
                                            {item.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">{item.reference}</TableCell>
                                    <TableCell>{item.entity}</TableCell>
                                    <TableCell className="font-medium">{item.amount.toLocaleString()}</TableCell>
                                    <TableCell className="text-stone-500 text-sm">{item.date}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" className="hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200" asChild>
                                            <Link href={`/dashboard/auditor/procurement/${item.type.toLowerCase()}/${item.id}`}>Verify & Approve</Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Compliance Alerts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-rose-50 border-rose-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-rose-900 text-md flex items-center">
                            <AlertCircle className="h-5 w-5 mr-2 text-rose-600" />
                            Statutory Compliance Alerts
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-start gap-3 p-3 bg-white/50 rounded-lg border border-rose-100">
                            <div className="mt-0.5"><AlertCircle className="h-4 w-4 text-rose-500" /></div>
                            <div>
                                <p className="text-sm font-semibold text-stone-800">Un-invoiced Receipts (GRNI) > 30 Days</p>
                                <p className="text-xs text-stone-500 mt-1">3 entries from "Fresh Foods Ltd" have not been matched to an invoice. Potential liability understatement.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-white/50 rounded-lg border border-rose-100">
                            <div className="mt-0.5"><AlertCircle className="h-4 w-4 text-rose-500" /></div>
                            <div>
                                <p className="text-sm font-semibold text-stone-800">VAT PIN Mismatch</p>
                                <p className="text-xs text-stone-500 mt-1">Invoice INV-9902 from "Apex Solutions" has a PIN that doesn't match the supplier database.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Audit Shortcuts */}
                <Card className="bg-stone-50 border-stone-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-stone-800 text-md">Compliance Shortcuts</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="justify-start h-auto py-3 px-4" asChild>
                            <Link href="/dashboard/auditor/reports/vat" className="flex flex-col items-start gap-1">
                                <span className="font-semibold text-stone-800">VAT Reports</span>
                                <span className="text-[10px] text-stone-500">Extract for iTax filing</span>
                            </Link>
                        </Button>
                        <Button variant="outline" className="justify-start h-auto py-3 px-4" asChild>
                            <Link href="/dashboard/auditor/reports/aging" className="flex flex-col items-start gap-1">
                                <span className="font-semibold text-stone-800">Aging Analysis</span>
                                <span className="text-[10px] text-stone-500">Accounts payable aging</span>
                            </Link>
                        </Button>
                        <Button variant="outline" className="justify-start h-auto py-3 px-4" asChild>
                            <Link href="/dashboard/auditor/reports/grni" className="flex flex-col items-start gap-1">
                                <span className="font-semibold text-stone-800">GRNI Account</span>
                                <span className="text-[10px] text-stone-500">Un-invoiced accruals</span>
                            </Link>
                        </Button>
                        <Button variant="outline" className="justify-start h-auto py-3 px-4" asChild>
                            <Link href="/dashboard/auditor/reports/audit-trail" className="flex flex-col items-start gap-1">
                                <span className="font-semibold text-stone-800">Transaction Audit</span>
                                <span className="text-[10px] text-stone-500">Full immutable trail</span>
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
