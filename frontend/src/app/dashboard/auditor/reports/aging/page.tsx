'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import {
    BarChart3,
    Download,
    RefreshCw,
    AlertCircle,
    TrendingDown,
    Clock,
    ArrowUpRight,
    CheckCircle2,
    AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';

interface AgingEntry {
    supplier_id: string;
    supplier_name: string;
    current_balance: number;
    "1-30_days": number;
    "31-60_days": number;
    "61-90_days": number;
    "over_90_days": number;
    total_payable: number;
}

export default function AuditorAgingAnalysisPage() {
    const { user } = useAuth();
    const [agingData, setAgingData] = useState<AgingEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchAgingAnalysis();
    }, []);

    const fetchAgingAnalysis = async () => {
        setIsLoading(true);
        try {
            const response = await api.procurement.getAgingAnalysis();
            if (response.success) {
                setAgingData(response.data || []);
            }
        } catch (error) {
            toast.error('Failed to load aging analysis');
        } finally {
            setIsLoading(false);
        }
    };

    const totals = agingData.reduce((acc, curr) => ({
        current: acc.current + curr.current_balance,
        p30: acc.p30 + curr["1-30_days"],
        p60: acc.p60 + curr["31-60_days"],
        p90: acc.p90 + curr["61-90_days"],
        pPlus: acc.pPlus + curr.over_90_days,
        total: acc.total + curr.total_payable
    }), { current: 0, p30: 0, p60: 0, p90: 0, pPlus: 0, total: 0 });

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <BarChart3 className="h-7 w-7 text-amber-600" />
                            Accounts Payable Aging Analysis
                        </h1>
                        <p className="text-stone-500 text-sm">Strategic overview of supplier liabilities and payment timelines</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={fetchAgingAnalysis} disabled={isLoading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Global Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-emerald-50 border-emerald-200">
                        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-[10px] font-bold text-emerald-700 uppercase">Current (0-30d)</CardTitle>
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <p className="text-xl font-black text-stone-900">KES {totals.p30.toLocaleString()}</p>
                            <p className="text-[10px] text-emerald-600 mt-1 font-medium">{((totals.p30 / (totals.total || 1)) * 100).toFixed(1)}% of total</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-amber-50 border-amber-200">
                        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-[10px] font-bold text-amber-700 uppercase">Due (31-60d)</CardTitle>
                            <Clock className="h-3 w-3 text-amber-600" />
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <p className="text-xl font-black text-stone-900">KES {totals.p60.toLocaleString()}</p>
                            <p className="text-[10px] text-amber-600 mt-1 font-medium">{((totals.p60 / (totals.total || 1)) * 100).toFixed(1)}% of total</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-orange-50 border-orange-200">
                        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-[10px] font-bold text-orange-700 uppercase">Overdue (61-90d)</CardTitle>
                            <AlertTriangle className="h-3 w-3 text-orange-600" />
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <p className="text-xl font-black text-stone-900">KES {totals.p90.toLocaleString()}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-rose-50 border-rose-200">
                        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-[10px] font-bold text-rose-700 uppercase">Critical (90d+)</CardTitle>
                            <AlertCircle className="h-3 w-3 text-rose-600" />
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <p className="text-xl font-black text-rose-900">KES {totals.pPlus.toLocaleString()}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Detailed Aging Table */}
                <Card className="bg-white border-stone-200 shadow-sm overflow-hidden">
                    <CardHeader className="bg-stone-50 border-b">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-lg">Detailed Supplier Aging</CardTitle>
                                <CardDescription>Breakdown by supplier and aging bucket</CardDescription>
                            </div>
                            <div className="flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-full border border-stone-200">
                                <span className="text-xs font-bold text-stone-500 uppercase">Total Liability:</span>
                                <span className="text-sm font-black text-stone-900 font-serif">KES {totals.total.toLocaleString()}</span>
                            </div>
                        </div>
                    </CardHeader>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-stone-50">
                                <TableHead>Supplier Name</TableHead>
                                <TableHead className="text-right">Current</TableHead>
                                <TableHead className="text-right">1 - 30 Days</TableHead>
                                <TableHead className="text-right">31 - 60 Days</TableHead>
                                <TableHead className="text-right">61 - 90 Days</TableHead>
                                <TableHead className="text-right text-rose-600">Over 90 Days</TableHead>
                                <TableHead className="text-right font-bold text-stone-900">Total Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center">
                                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-stone-200" />
                                    </TableCell>
                                </TableRow>
                            ) : agingData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center text-stone-400">
                                        No outstanding liabilities found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                agingData.map((item) => (
                                    <TableRow key={item.supplier_id} className="hover:bg-stone-50/50">
                                        <td className="font-medium text-stone-800">{item.supplier_name}</td>
                                        <td className="text-right text-xs text-stone-500">{item.current_balance.toLocaleString()}</td>
                                        <td className="text-right text-xs font-medium text-emerald-600">{item["1-30_days"].toLocaleString()}</td>
                                        <td className="text-right text-xs font-medium text-amber-600">{item["31-60_days"].toLocaleString()}</td>
                                        <td className="text-right text-xs font-medium text-orange-600">{item["61-90_days"].toLocaleString()}</td>
                                        <td className="text-right text-xs font-bold text-rose-600">{item.over_90_days.toLocaleString()}</td>
                                        <td className="text-right text-sm font-black text-stone-900 bg-stone-50/50">{item.total_payable.toLocaleString()}</td>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        {agingData.length > 0 && (
                            <tfoot className="bg-stone-100/50 font-bold border-t-2">
                                <TableRow>
                                    <TableCell className="text-stone-500 uppercase text-[10px] tracking-widest font-black">Consolidated Totals</TableCell>
                                    <TableCell className="text-right text-xs">{totals.current.toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-xs text-emerald-700">{totals.p30.toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-xs text-amber-700">{totals.p60.toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-xs text-orange-700">{totals.p90.toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-xs text-rose-700">{totals.pPlus.toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-sm font-black text-stone-900 font-serif">KES {totals.total.toLocaleString()}</TableCell>
                                </TableRow>
                            </tfoot>
                        )}
                    </Table>
                </Card>

                {/* Auditor Analysis Note */}
                <div className="p-4 bg-stone-800 text-white rounded-lg shadow-lg border border-stone-700 flex gap-4">
                    <TrendingDown className="h-6 w-6 text-emerald-400 shrink-0" />
                    <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Liquidity & Credit Risk Audit</p>
                        <p className="text-sm leading-relaxed text-stone-300">
                            The AP Aging Analysis highlights potential cash flow strain. Critical (90d+) balances should be reviewed for disputes or payment blocks. High concentrations in the 31-60 day bucket may indicate upcoming liquidity pressure on the bank accounts.
                        </p>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
