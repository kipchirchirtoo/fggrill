'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import {
    FileSpreadsheet,
    Download,
    Filter,
    RefreshCw,
    Calendar,
    Search,
    Building,
    Scale
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
import { Input } from '@/components/ui/input';

interface VATEntry {
    id: string;
    invoice_date: string;
    invoice_number: string;
    supplier_name: string;
    pin_number: string;
    description: string;
    amount_net: number;
    amount_tax: number;
    amount_total: number;
    vat_rate: number;
}

export default function AuditorVATReportPage() {
    const { user } = useAuth();
    const [reportData, setReportData] = useState<VATEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchVATReport();
    }, [dateRange]);

    const fetchVATReport = async () => {
        setIsLoading(true);
        try {
            const response = await api.procurement.getVATReport(dateRange.start, dateRange.end);
            if (response.success) {
                setReportData(response.data || []);
            }
        } catch (error) {
            toast.error('Failed to load VAT report');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = () => {
        // CSV Export Logic
        const headers = ['Date', 'Supplier', 'PIN', 'Invoice #', 'Description', 'Net Amount', 'VAT Amount', 'Total'];
        const rows = reportData.map(entry => [
            formatDate(entry.invoice_date),
            entry.supplier_name,
            entry.pin_number,
            entry.invoice_number,
            entry.description,
            entry.amount_net,
            entry.amount_tax,
            entry.amount_total
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `VAT_Input_Report_${dateRange.start}_to_${dateRange.end}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const totalNet = reportData.reduce((sum, item) => sum + item.amount_net, 0);
    const totalVAT = reportData.reduce((sum, item) => sum + item.amount_tax, 0);
    const totalGross = reportData.reduce((sum, item) => sum + item.amount_total, 0);

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <FileSpreadsheet className="h-7 w-7 text-emerald-600" />
                            Statutory VAT Input Register
                        </h1>
                        <p className="text-stone-500 text-sm">Official register for KRA iTax filing and compliance auditing</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={handleExport} disabled={reportData.length === 0}>
                            <Download className="h-4 w-4 mr-2" />
                            Export CSV
                        </Button>
                        <Button variant="outline" onClick={fetchVATReport} disabled={isLoading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <Card className="bg-white border-stone-200 shadow-sm">
                    <CardContent className="p-4 flex flex-wrap items-end gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-1">Start Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <Input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    className="pl-9 h-10 w-44"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-1">End Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <Input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    className="pl-9 h-10 w-44"
                                />
                            </div>
                        </div>
                        <div className="flex-1"></div>
                        <div className="bg-stone-50 border border-stone-200 rounded-lg p-2 flex gap-6 px-6">
                            <div className="text-center">
                                <p className="text-[9px] font-bold text-stone-400 uppercase">Input VAT Total</p>
                                <p className="text-lg font-black text-emerald-600 font-serif">KES {totalVAT.toLocaleString()}</p>
                            </div>
                            <div className="w-px bg-stone-200 my-1"></div>
                            <div className="text-center">
                                <p className="text-[9px] font-bold text-stone-400 uppercase">Gross Claims</p>
                                <p className="text-lg font-black text-stone-800 font-serif">KES {totalGross.toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Report Table */}
                <Card className="bg-white border-stone-200 shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-stone-50">
                            <TableRow>
                                <TableHead className="w-[100px]">Date</TableHead>
                                <TableHead>Supplier Details</TableHead>
                                <TableHead>Invoice Ref</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Net Amt</TableHead>
                                <TableHead className="text-right">VAT (16%)</TableHead>
                                <TableHead className="text-right font-bold">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center">
                                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-stone-200 mb-2" />
                                        <p className="text-stone-400">Generating VAT register...</p>
                                    </TableCell>
                                </TableRow>
                            ) : reportData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center text-stone-400">
                                        <p>No VAT entries found for selected period.</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reportData.map((entry) => (
                                    <TableRow key={entry.id} className="hover:bg-stone-50/50">
                                        <td className="text-xs text-stone-600">{formatDate(entry.invoice_date)}</td>
                                        <td>
                                            <div className="text-xs font-bold text-stone-900">{entry.supplier_name}</div>
                                            <div className="text-[10px] text-emerald-600 font-mono">PIN: {entry.pin_number}</div>
                                        </td>
                                        <td className="font-mono text-xs">{entry.invoice_number}</td>
                                        <td className="text-[10px] text-stone-500 max-w-[200px] truncate">{entry.description}</td>
                                        <td className="text-right text-xs">{entry.amount_net.toLocaleString()}</td>
                                        <td className="text-right text-xs text-emerald-600 font-medium">{entry.amount_tax.toLocaleString()}</td>
                                        <td className="text-right text-xs font-bold">{entry.amount_total.toLocaleString()}</td>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        {reportData.length > 0 && (
                            <tfoot className="bg-stone-50 border-t-2">
                                <TableRow>
                                    <TableCell colSpan={4} className="text-right font-black text-xs uppercase tracking-widest">Totals</TableCell>
                                    <TableCell className="text-right font-bold text-xs">{totalNet.toLocaleString()}</TableCell>
                                    <TableCell className="text-right font-bold text-xs text-emerald-600">{totalVAT.toLocaleString()}</TableCell>
                                    <TableCell className="text-right font-black text-xs">KES {totalGross.toLocaleString()}</TableCell>
                                </TableRow>
                            </tfoot>
                        )}
                    </Table>
                </Card>

                {/* Audit Note */}
                <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <Scale className="h-5 w-5 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                        <span className="font-bold">KRA Compliance Notice:</span> This register includes only verified and auditor-approved invoices. To claim VAT Input, ensure all entries have a valid KRA ETR receipt number and the supplier PIN is correctly recorded during invoice verification.
                    </p>
                </div>
            </div>
        </ProtectedRoute>
    );
}
