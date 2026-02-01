'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
    ShieldCheck, FileText, CheckCircle2, RefreshCw, Check, X,
    AlertCircle, Receipt, Search, Filter, Info, AlertTriangle, Scale,
    Building, UserCheck
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

interface SupplierInvoice {
    id: string;
    invoice_number: string;
    supplier_id: string;
    supplier?: { name: string; supplier_code: string; pin_number: string };
    status: string;
    amount_total: number;
    amount_tax: number;
    amount_net: number;
    invoice_date: string;
    due_date: string;
    is_verified: boolean;
    notes?: string;
    items: any[];
}

export default function AuditorInvoiceApprovalPage() {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        fetchPendingInvoices();
    }, []);

    const fetchPendingInvoices = async () => {
        setIsLoading(true);
        try {
            // Fetch invoices awaiting audit verification
            const response = await api.procurement.getInvoices('submitted');
            if (response.success) {
                setInvoices(response.data || []);
            }
        } catch (error) {
            toast.error('Failed to load pending invoices');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedInvoice) return;
        setIsProcessing(true);
        try {
            const response = await api.procurement.approveInvoice(selectedInvoice.id);
            if (response.success) {
                toast.success('Invoice verified and approved. GRNI cleared and vendor ledger updated.');
                setIsVerifyModalOpen(false);
                fetchPendingInvoices();
            }
        } catch (error) {
            toast.error('Failed to verify invoice');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async (reason: string) => {
        if (!selectedInvoice) return;
        try {
            const response = await api.procurement.rejectInvoice(selectedInvoice.id, reason);
            if (response.success) {
                toast.success('Invoice rejected');
                setIsVerifyModalOpen(false);
                fetchPendingInvoices();
            }
        } catch (error) {
            toast.error('Failed to reject invoice');
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <ShieldCheck className="h-7 w-7 text-emerald-600" />
                            Supplier Invoice Verification
                        </h1>
                        <p className="text-stone-500 text-sm">Review, verify and approve supplier invoices for payment processing</p>
                    </div>
                    <Button variant="outline" onClick={fetchPendingInvoices} disabled={isLoading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {/* Audit Checklist */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-stone-50 border-stone-200">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Scale className="h-4 w-4 text-emerald-600" /> VAT Verification
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3">
                            <p className="text-xs text-stone-500 italic">Match invoice VAT with KRA ETR rates (16%, 8%, 0%)</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-stone-50 border-stone-200">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 3-Way Match
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3">
                            <p className="text-xs text-stone-500 italic">Verify PO vs GRN vs Invoice quantities & pricing</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-stone-50 border-stone-200">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <UserCheck className="h-4 w-4 text-emerald-600" /> PIN Validation
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3">
                            <p className="text-xs text-stone-500 italic">Ensure Supplier PIN is valid for VAT Input claims</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Invoices List */}
                <Card className="bg-white border-stone-200 shadow-sm overflow-hidden">
                    <CardHeader className="bg-stone-50 border-b">
                        <h3 className="text-lg font-bold">Verification Queue</h3>
                    </CardHeader>
                    {isLoading ? (
                        <div className="p-12 text-center text-stone-500">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-stone-100" />
                            <p>Fetching pending invoices...</p>
                        </div>
                    ) : invoices.length === 0 ? (
                        <div className="p-12 text-center text-stone-500">
                            <Receipt className="h-12 w-12 mx-auto mb-3 text-stone-200" />
                            <p className="text-lg font-medium text-stone-800">No invoices pending verification</p>
                            <p className="text-sm">Great job! The queue is empty.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Date / Due</TableHead>
                                    <TableHead className="text-right">Net</TableHead>
                                    <TableHead className="text-right">VAT</TableHead>
                                    <TableHead className="text-right">Total (KES)</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.map((inv) => (
                                    <TableRow key={inv.id} className="hover:bg-stone-50/50">
                                        <td className="font-mono text-sm font-bold">{inv.invoice_number}</td>
                                        <td>
                                            <div className="font-medium text-stone-900">{inv.supplier?.name}</div>
                                            <div className="text-[10px] text-stone-500">PIN: {inv.supplier?.pin_number || 'N/A'}</div>
                                        </td>
                                        <td>
                                            <div className="text-xs text-stone-700">{formatDate(inv.invoice_date)}</div>
                                            <div className="text-[10px] text-rose-500">Due: {formatDate(inv.due_date)}</div>
                                        </td>
                                        <td className="text-right text-xs text-stone-600">{inv.amount_net.toLocaleString()}</td>
                                        <td className="text-right text-xs text-emerald-600 font-medium">{inv.amount_tax.toLocaleString()}</td>
                                        <td className="text-right text-sm font-bold">{inv.amount_total.toLocaleString()}</td>
                                        <td className="text-right">
                                            <Button size="sm" onClick={() => { setSelectedInvoice(inv); setIsVerifyModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
                                                Review & Audit
                                            </Button>
                                        </td>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </Card>

                {/* Verification Modal */}
                <Dialog open={isVerifyModalOpen} onOpenChange={setIsVerifyModalOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <div className="flex justify-between items-center">
                                <DialogTitle className="flex items-center gap-2">
                                    <Receipt className="h-5 w-5 text-emerald-600" />
                                    Invoice Verification: {selectedInvoice?.invoice_number}
                                </DialogTitle>
                                <Badge className="bg-emerald-100 text-emerald-700">AWAITING AUDIT</Badge>
                            </div>
                        </DialogHeader>

                        {selectedInvoice && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-4 border-y">
                                    <div className="space-y-1 col-span-2">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase">Supplier Account</p>
                                        <p className="text-sm font-bold">{selectedInvoice.supplier?.name}</p>
                                        <div className="flex gap-4 mt-1">
                                            <p className="text-[10px] text-stone-500 uppercase"><span className="font-bold">PIN:</span> {selectedInvoice.supplier?.pin_number || 'REQUIRED'}</p>
                                            <p className="text-[10px] text-stone-500 uppercase"><span className="font-bold">CODE:</span> {selectedInvoice.supplier?.supplier_code || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase">Invoice Date</p>
                                        <p className="text-sm font-semibold">{formatDate(selectedInvoice.invoice_date)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase">Due Date</p>
                                        <p className="text-sm font-semibold text-rose-600">{formatDate(selectedInvoice.due_date)}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold flex items-center gap-2 italic">
                                            <FileText className="h-4 w-4" /> Billed Items & VAT Breakdown
                                        </h3>
                                    </div>
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-stone-50">
                                                <TableRow>
                                                    <TableHead>Item / Description</TableHead>
                                                    <TableHead className="text-right">Qty</TableHead>
                                                    <TableHead className="text-right">Rate</TableHead>
                                                    <TableHead className="text-right">VAT Rate</TableHead>
                                                    <TableHead className="text-right">VAT Amt</TableHead>
                                                    <TableHead className="text-right font-bold">Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedInvoice.items?.map((item, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell>
                                                            <div className="text-xs font-medium">{item.item_name}</div>
                                                            {item.grn_number && <div className="text-[10px] text-stone-400 font-mono">Matched to: {item.grn_number}</div>}
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs">{item.quantity}</TableCell>
                                                        <TableCell className="text-right text-xs">{item.unit_price?.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right text-xs text-blue-600 font-medium">{item.vat_rate}%</TableCell>
                                                        <TableCell className="text-right text-xs text-emerald-600 font-medium">{item.vat_amount?.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right text-xs font-bold">{item.total_amount?.toLocaleString()}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100 italic">
                                            <p className="text-[10px] font-bold text-emerald-800 uppercase mb-2 flex items-center gap-1">
                                                <ShieldCheck className="h-3 w-3" /> Statutory Verification Notes
                                            </p>
                                            <p className="text-xs text-emerald-800 leading-relaxed">
                                                "I certify that the prices on this invoice match those on the Approved Purchase Order and that all items were physically received as per GRN records. VAT calculations have been verified against KRA tax brackets."
                                            </p>
                                        </div>
                                        {selectedInvoice.notes && (
                                            <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                                                <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">Clerk Submission Notes</p>
                                                <p className="text-xs text-stone-700 italic">"{selectedInvoice.notes}"</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-end h-fit">
                                        <div className="w-full space-y-2 border-l pl-6">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-stone-500 font-bold uppercase tracking-wider">Net Amount:</span>
                                                <span className="font-semibold">KES {selectedInvoice.amount_net.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-emerald-600 font-bold uppercase tracking-wider">VAT Total:</span>
                                                <span className="font-semibold text-emerald-600">KES {selectedInvoice.amount_tax.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-xl pt-3 border-t font-black text-stone-900 font-serif">
                                                <span className="italic">GRAND TOTAL</span>
                                                <span>KES {selectedInvoice.amount_total.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <DialogFooter className="flex justify-between sm:justify-between items-center pt-4 border-t">
                                    <Button variant="ghost" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => handleReject('Data mismatch')}>
                                        <X className="h-4 w-4 mr-2" /> Reject for Correction
                                    </Button>
                                    <div className="flex gap-3">
                                        <Button variant="outline" onClick={() => setIsVerifyModalOpen(false)}>Close</Button>
                                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleApprove} disabled={isProcessing}>
                                            {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                                            Final Audit Approval
                                        </Button>
                                    </div>
                                </DialogFooter>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </ProtectedRoute>
    );
}
