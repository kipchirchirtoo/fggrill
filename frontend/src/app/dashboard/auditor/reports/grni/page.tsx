'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Package,
    Download,
    RefreshCw,
    AlertCircle,
    Warehouse,
    History,
    ArrowRight,
    Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { api } from '@/lib/api';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface GRNIEntry {
    grn_id: string;
    grn_number: string;
    received_date: string;
    supplier_name: string;
    days_outstanding: number;
    total_received_value: number;
    total_invoiced_value: number;
    grni_balance: number;
}

export default function AuditorGRNIValuationPage() {
    const { user } = useAuth();
    const [grniData, setGrniData] = useState<GRNIEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchGRNIValuation();
    }, []);

    const fetchGRNIValuation = async () => {
        setIsLoading(true);
        try {
            const response = await api.procurement.getGRNIReport();
            if (response.success) {
                setGrniData(response.data || []);
            }
        } catch (error) {
            toast.error('Failed to load GRNI valuation');
        } finally {
            setIsLoading(false);
        }
    };

    const totalBalance = grniData.reduce((sum, item) => sum + item.grni_balance, 0);

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Warehouse className="h-7 w-7 text-blue-600" />
                            GRNI Valuation Register
                        </h1>
                        <p className="text-stone-500 text-sm">Tracking Goods Received Not Invoiced (Accrued Liabilities)</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={fetchGRNIValuation} disabled={isLoading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Global Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-blue-50 border-blue-200 col-span-2">
                        <CardHeader className="py-4 px-6 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Total Accrued Liability (GRNI)</CardTitle>
                                <p className="text-3xl font-black text-blue-900 mt-1 font-serif">KES {totalBalance.toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-white rounded-full border border-blue-100 shadow-sm">
                                <Receipt className="h-8 w-8 text-blue-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="px-6 pb-6">
                            <p className="text-sm text-blue-800 leading-relaxed max-w-2xl">
                                This represents inventory physically received and approved into stores for which a valid supplier invoice has not yet been processed. In accounting, this is a current liability that must be cleared during month-end closing.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className={`${grniData.some(i => i.days_outstanding > 30) ? 'bg-rose-50 border-rose-200' : 'bg-stone-50 border-stone-200'}`}>
                        <CardHeader className="py-4 px-6">
                            <CardTitle className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Aging Alert</CardTitle>
                        </CardHeader>
                        <CardContent className="px-6 pb-6 text-center">
                            <div className="text-3xl font-black text-stone-800">
                                {grniData.filter(i => i.days_outstanding > 30).length}
                            </div>
                            <p className="text-[10px] font-bold text-stone-400 uppercase mt-1">Entries Over 30 Days</p>
                            {grniData.some(i => i.days_outstanding > 30) && (
                                <div className="mt-4 flex items-center justify-center gap-2 text-rose-600 font-bold text-xs">
                                    <AlertCircle className="h-4 w-4" /> Action Required
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Detailed Register */}
                <Card className="bg-white border-stone-200 shadow-sm overflow-hidden">
                    <CardHeader className="bg-stone-50 border-b">
                        <h3 className="text-lg font-bold">Accrual Register</h3>
                    </CardHeader>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-stone-50">
                                <TableHead>GRN Number</TableHead>
                                <TableHead>Received Date</TableHead>
                                <TableHead>Supplier</TableHead>
                                <TableHead className="text-center">Days Aging</TableHead>
                                <TableHead className="text-right">Received Val</TableHead>
                                <TableHead className="text-right">Invoiced Val</TableHead>
                                <TableHead className="text-right font-bold text-blue-900">GRNI Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center">
                                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-stone-200" />
                                    </TableCell>
                                </TableRow>
                            ) : grniData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center text-stone-400">
                                        Excellent! All delivery receipts have been matched to invoices.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                grniData.map((item) => (
                                    <TableRow key={item.grn_id} className="hover:bg-stone-50/50">
                                        <td className="font-mono text-xs font-bold">{item.grn_number}</td>
                                        <td className="text-xs text-stone-600">{formatDate(item.received_date)}</td>
                                        <td className="font-medium text-stone-800">{item.supplier_name}</td>
                                        <td className="text-center">
                                            <Badge variant="outline" className={
                                                item.days_outstanding > 30 ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                    item.days_outstanding > 15 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                        'bg-emerald-50 text-emerald-700 border-emerald-100'
                                            }>
                                                {item.days_outstanding} Days
                                            </Badge>
                                        </td>
                                        <td className="text-right text-xs">{item.total_received_value.toLocaleString()}</td>
                                        <td className="text-right text-xs text-stone-400">{item.total_invoiced_value.toLocaleString()}</td>
                                        <td className="text-right text-sm font-black text-blue-900 bg-blue-50/30">{item.grni_balance.toLocaleString()}</td>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        {grniData.length > 0 && (
                            <tfoot className="bg-stone-50 font-bold border-t-2">
                                <TableRow>
                                    <TableCell colSpan={6} className="text-right text-xs font-black uppercase tracking-widest text-stone-400">Total Accrued Balance</TableCell>
                                    <TableCell className="text-right text-sm font-black text-blue-900 font-serif">KES {totalBalance.toLocaleString()}</TableCell>
                                </TableRow>
                            </tfoot>
                        )}
                    </Table>
                </Card>

                {/* Audit Guidance */}
                <Card className="border-l-4 border-l-blue-600 bg-white">
                    <CardContent className="p-4 flex gap-4">
                        <History className="h-6 w-6 text-blue-600 shrink-0" />
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-stone-800 uppercase tracking-wider">Month-End Audit Procedure</p>
                            <p className="text-xs text-stone-500 leading-relaxed">
                                Auditors should cross-reference this register with physical stock counts. Any entry over 45 days should be investigated for missing supplier invoices or pricing disputes. Clearing the GRNI balance is a prerequisite for financial closure.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </ProtectedRoute>
    );
}
