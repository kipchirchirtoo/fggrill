'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { procurementAPI, storeAPI } from '@/lib/api';
import { Wallet, CreditCard, Search, RefreshCw, Eye, History, Landmark, ArrowUpRight, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Supplier {
    id: string;
    name: string;
}

interface Invoice {
    id: string;
    invoice_number: string;
    po_number: string;
    balance_due: number;
}

interface Payment {
    id: string;
    payment_number: string;
    supplier_id: string;
    supplier?: {
        name: string;
    };
    payment_date: string;
    payment_amount: number;
    payment_method: string;
    reference_number: string;
    status: 'pending' | 'draft' | 'processed' | 'cancelled';
}

interface LedgerEntry {
    id: string;
    transaction_date: string;
    transaction_type: 'invoice' | 'payment' | 'credit_note' | 'opening_balance';
    reference_number: string;
    debit_amount: number;
    credit_amount: number;
    running_balance: number;
}

// Helper for safe formatting
const formatCurrency = (val: any) => {
    try {
        const num = Number(val);
        return isNaN(num) ? "0" : num.toLocaleString();
    } catch (e) {
        return "0";
    }
};

export default function PaymentsPage() {
    console.log("PAYMENTS_PAGE_VERSION_BUGFIX_V1");


    const { user } = useAuth();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
    const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
    const [isLedgerOpen, setIsLedgerOpen] = useState(false);
    const [agingPayables, setAgingPayables] = useState(0);

    // Record Payment Modal State
    const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [supplierInvoices, setSupplierInvoices] = useState<Invoice[]>([]);
    const [newPayment, setNewPayment] = useState({
        supplier_id: '',
        invoice_id: 'none',
        payment_method: 'bank_transfer',
        amount: '',
        reference_number: '',
        notes: ''
    });

    const fetchSuppliers = useCallback(async () => {
        try {
            const res = await storeAPI.getSuppliers();
            if (res.success) setSuppliers(res.data || []);
        } catch (e) {}
    }, []);

    const fetchSupplierInvoices = async (supplierId: string) => {
        try {
            const res = await procurementAPI.getInvoices({ supplier_id: supplierId, status: 'approved' });
            if (res.success) {
                setSupplierInvoices((res.data || []).filter((i: any) => i.balance_due > 0));
            }
        } catch (e) {}
    };

    useEffect(() => {
        if (newPayment.supplier_id) {
            fetchSupplierInvoices(newPayment.supplier_id);
            // Reset invoice selection if supplier changes
            setNewPayment(prev => ({ ...prev, invoice_id: 'none', amount: '' }));
        } else {
            setSupplierInvoices([]);
        }
    }, [newPayment.supplier_id]);

    const handleRecordPayment = async () => {
        if (!newPayment.supplier_id || !newPayment.amount || !newPayment.payment_method) {
            toast.error("Please fill in required fields");
            return;
        }

        setIsSubmitting(true);
        try {
            const reqData: any = {
                supplier_id: newPayment.supplier_id,
                payment_method: newPayment.payment_method,
                payment_amount: Number(newPayment.amount),
                reference_number: newPayment.reference_number,
                notes: newPayment.notes
            };

            if (newPayment.invoice_id && newPayment.invoice_id !== 'none') {
                reqData.allocations = [{
                    invoice_id: newPayment.invoice_id,
                    amount: Number(newPayment.amount)
                }];
            }

            const res = await procurementAPI.createPayment(reqData);
            if (res.success) {
                toast.success('Payment recorded successfully');
                setIsRecordModalOpen(false);
                setNewPayment({
                    supplier_id: '',
                    invoice_id: 'none',
                    payment_method: 'bank_transfer',
                    amount: '',
                    reference_number: '',
                    notes: ''
                });
                fetchPayments();
            } else {
                toast.error(res.message || 'Failed to record payment');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to record payment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const fetchPayments = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await procurementAPI.getPayments();
            if (response.success) setPayments(response.data || []);
        } catch (error) { console.error('Error fetching payments:', error); }
        finally { setIsLoading(false); }
    }, []);

    const fetchAgingPayables = useCallback(async () => {
        try {
            const res = await procurementAPI.getInvoices();
            if (res.success) {
                const total = (res.data || [])
                    .filter((i: any) => i.status === 'approved' && Number(i.balance_due || 0) > 0)
                    .reduce((sum: number, i: any) => sum + (Number(i.balance_due) || 0), 0);
                setAgingPayables(total);
            }
        } catch (e) { console.error('Error fetching aging payables:', e); }
    }, []);

    useEffect(() => { 
        fetchPayments(); 
        fetchSuppliers();
        fetchAgingPayables();
    }, [fetchPayments, fetchSuppliers, fetchAgingPayables]);

    const fetchLedger = async (supplierId: string) => {
        try {
            setSelectedSupplierId(supplierId);
            const res = await procurementAPI.getSupplierLedger(supplierId);
            if (res.success) {
                setLedgerEntries(res.data || []);
                setIsLedgerOpen(true);
            }
        } catch (e) { toast.error('Failed to load ledger'); }
    };

    const handleExportStatement = async () => {
        if (!selectedSupplierId) return;

        toast.promise(procurementAPI.exportSupplierStatement({
            supplier_id: selectedSupplierId,
            from_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
            to_date: new Date().toISOString().split('T')[0]
        }), {
            loading: 'Generating Supplier Statement...',
            success: 'Statement downloaded successfully',
            error: 'Failed to generate statement'
        });
    };

    const filteredPayments = payments.filter(p =>
        String(p?.payment_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(p?.supplier?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(p?.reference_number || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const pendingTotal = (payments || [])
        .filter(p => p && (p.status === 'pending' || p.status === 'draft'))
        .reduce((sum, p) => sum + (Number(p.payment_amount) || 0), 0);

    const paid30DTotal = (payments || [])
        .filter(p => p && p.status === 'processed' && p.payment_date && new Date(p.payment_date).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000)
        .reduce((sum, p) => sum + (Number(p.payment_amount) || 0), 0);

    return (
        <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Supplier Payments</h1>
                            <p className="text-gray-500">Process settlements and view financial history</p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={fetchPayments} leftIcon={<RefreshCw size={16} />}>Refresh</IOSButton>
                            {(user?.role === UserRole.CENTRAL_STOREKEEPER || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.BRANCH_STOREKEEPER) && (
                                <IOSButton onClick={() => setIsRecordModalOpen(true)} className="bg-[#007AFF] text-white">Record Payment</IOSButton>
                            )}
                            {(user?.role === UserRole.AUDITOR || user?.role === UserRole.SUPER_ADMIN) && (
                                <IOSButton onClick={() => toast.info('Redirecting to Payment Processing...')} leftIcon={<Landmark size={16} />}>Process Payment</IOSButton>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 py-2 border-b border-stone-100">
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers'}>Suppliers</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/purchase-orders'}>POs</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/grn'}>GRN</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/invoices'}>Invoices</IOSButton>
                        <IOSButton variant="secondary" className="bg-stone-50 border-none h-8 text-xs px-3" onClick={() => window.location.href = '/dashboard/central-store/suppliers/payments'}>Payments</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/reports'}>Reports</IOSButton>
                    </div>

                    <div className="grid md:grid-cols-4 gap-4">
                        <IOSCard className="p-4 flex flex-col items-center justify-center text-center bg-stone-50">
                            <Scale size={20} className="text-stone-400 mb-2" />
                            <p className="text-[10px] uppercase font-bold text-stone-400">Aging Payables</p>
                            <p className="text-lg font-black text-stone-800">KES {(Number(agingPayables) || 0) > 1000000 ? ((Number(agingPayables) || 0)/1000000).toFixed(1) + 'M' : (Number(agingPayables) || 0) > 1000 ? ((Number(agingPayables) || 0)/1000).toFixed(1) + 'k' : formatCurrency(agingPayables)}</p>
                        </IOSCard>
                        <IOSCard className="p-4 flex flex-col items-center justify-center text-center">
                            <Wallet size={20} className="text-emerald-500 mb-2" />
                            <p className="text-[10px] uppercase font-bold text-stone-400">Paid (30D)</p>
                            <p className="text-lg font-black text-emerald-600">KES {(Number(paid30DTotal) || 0) > 1000000 ? ((Number(paid30DTotal) || 0)/1000000).toFixed(1) + 'M' : (Number(paid30DTotal) || 0) > 1000 ? ((Number(paid30DTotal) || 0)/1000).toFixed(1) + 'k' : formatCurrency(paid30DTotal)}</p>
                        </IOSCard>
                        <IOSCard className="p-4 flex flex-col items-center justify-center text-center">
                            <CreditCard size={20} className="text-[#007AFF] mb-2" />
                            <p className="text-[10px] uppercase font-bold text-stone-400">Pending</p>
                            <p className="text-lg font-black text-[#007AFF]">KES {(Number(pendingTotal) || 0) > 1000000 ? ((Number(pendingTotal) || 0)/1000000).toFixed(1) + 'M' : (Number(pendingTotal) || 0) > 1000 ? ((Number(pendingTotal) || 0)/1000).toFixed(1) + 'k' : formatCurrency(pendingTotal)}</p>
                        </IOSCard>

                        <IOSCard className="p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-stone-50 transition-colors" onClick={() => window.location.href = '/dashboard/central-store/suppliers/reports'}>
                            <History size={20} className="text-stone-400 mb-2" />
                            <p className="text-[10px] uppercase font-bold text-stone-400">Audit Logs</p>
                            <p className="text-sm font-medium text-stone-600 underline">View History</p>
                        </IOSCard>
                    </div>

                    <IOSCard className="p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search payments by #, supplier, or ref..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 text-sm"
                            />
                        </div>
                    </IOSCard>

                    {isLoading ? (
                        <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-stone-300" /></div>
                    ) : filteredPayments.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-ios-xl border border-stone-100 italic text-stone-400">No payment records found</div>
                    ) : (
                        <div className="overflow-x-auto rounded-ios-xl border border-stone-100">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-stone-50 text-stone-500 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Payment #</th>
                                        <th className="px-4 py-3">Supplier</th>
                                        <th className="px-4 py-3">Method / Ref</th>
                                        <th className="px-4 py-3 text-right">Amount</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-center">Ledger</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(filteredPayments || []).map(p => (
                                        <tr key={p?.id || Math.random()} className="hover:bg-stone-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-stone-700">{p?.payment_number || 'N/A'}</td>
                                            <td className="px-4 py-3 font-semibold">{p?.supplier?.name || 'Unknown'}</td>
                                            <td className="px-4 py-3 text-xs">
                                                <p className="capitalize font-medium text-stone-600">{(p?.payment_method || 'unknown').replace('_', ' ')}</p>
                                                <p className="text-[10px] text-stone-400 font-mono italic">{p?.reference_number || 'No Ref'}</p>
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-[#007AFF]">KES {formatCurrency(p?.payment_amount)}</td>
                                            <td className="px-4 py-3">

                                                <IOSBadge variant="light" color={p?.status === 'processed' ? 'success' : 'warning'} className="capitalize text-[10px] py-0 px-2 min-w-[80px] text-center border-none">
                                                    {p?.status || 'pending'}
                                                </IOSBadge>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button className="p-1 text-stone-400 hover:text-emerald-600" onClick={() => p?.supplier_id && fetchLedger(p.supplier_id)} title="View Supplier Ledger">
                                                    <History size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <Dialog open={isLedgerOpen} onOpenChange={setIsLedgerOpen}>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-xl flex items-center gap-2 font-black"><ArrowUpRight className="text-emerald-500" /> Supplier Account Ledger</DialogTitle>
                            <DialogDescription>Detailed transaction history and running balance.</DialogDescription>
                        </DialogHeader>

                        <div className="mt-4 overflow-hidden rounded-ios-xl border border-stone-100">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-stone-50 text-stone-500 font-bold uppercase tracking-tighter">
                                    <tr>
                                        <th className="px-3 py-2">Date</th>
                                        <th className="px-3 py-2">Type / Ref</th>
                                        <th className="px-3 py-2 text-right">Debit (-)</th>
                                        <th className="px-3 py-2 text-right">Credit (+)</th>
                                        <th className="px-3 py-2 text-right bg-emerald-50 text-emerald-800">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {(ledgerEntries || []).map((entry: any, idx) => (
                                        <tr key={idx} className="hover:bg-stone-25">
                                            <td className="px-3 py-2 text-stone-400">{entry?.transaction_date ? new Date(entry.transaction_date).toLocaleDateString() : '-'}</td>
                                            <td className="px-3 py-2">
                                                <IOSBadge variant="light" className="text-[9px] h-4 mb-1 border-none bg-stone-100 text-stone-600 uppercase font-black">{entry?.transaction_type || 'TXN'}</IOSBadge>
                                                <p className="font-mono text-[9px] text-stone-400">{entry?.reference_number || '-'}</p>
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-emerald-600">{(Number(entry?.debit_amount) || 0) > 0 ? formatCurrency(entry?.debit_amount) : '-'}</td>
                                            <td className="px-3 py-2 text-right font-mono text-stone-600">{(Number(entry?.credit_amount) || 0) > 0 ? formatCurrency(entry?.credit_amount) : '-'}</td>
                                            <td className="px-3 py-2 text-right font-mono font-bold bg-stone-25">{formatCurrency(entry?.running_balance)}</td>
                                        </tr>

                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                            <IOSButton variant="secondary" onClick={() => setIsLedgerOpen(false)} className="h-8 text-[10px] px-4 font-bold uppercase tracking-wider">Close Ledger</IOSButton>
                            <IOSButton className="h-8 text-[10px] px-4 font-bold uppercase tracking-wider" onClick={handleExportStatement}>Export Statement</IOSButton>
                        </div>
                    </DialogContent>
                </Dialog>
            <Dialog open={isRecordModalOpen} onOpenChange={setIsRecordModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Record Supplier Payment</DialogTitle>
                        <DialogDescription>Record a new payment to a supplier. By default, it will be saved as a draft for auditor verification.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Supplier *</Label>
                            <Select value={newPayment.supplier_id} onValueChange={(val) => setNewPayment(prev => ({...prev, supplier_id: val}))}>
                                <SelectTrigger><SelectValue placeholder="Select Supplier" /></SelectTrigger>
                                <SelectContent>
                                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {newPayment.supplier_id && (
                            <div className="space-y-2">
                                <Label>Allocate to Invoice (Optional)</Label>
                                <Select value={newPayment.invoice_id} onValueChange={(val) => setNewPayment(prev => ({
                                    ...prev, 
                                    invoice_id: val,
                                    amount: val !== 'none' ? String(supplierInvoices.find(i => i.id === val)?.balance_due || '') : prev.amount
                                }))}>
                                    <SelectTrigger><SelectValue placeholder="Select Invoice" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No specific invoice (Advance/General payment)</SelectItem>
                                        {(supplierInvoices || []).map(i => (
                                            <SelectItem key={i?.id} value={i?.id}>
                                                {i?.invoice_number || 'Unnamed'} (PO: {i?.po_number || 'N/A'}) - Due: KES {formatCurrency(i?.balance_due)}
                                            </SelectItem>
                                        ))}

                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Amount (KES) *</Label>
                                <Input type="number" value={newPayment.amount} onChange={e => setNewPayment(prev => ({...prev, amount: e.target.value}))} placeholder="0.00" />
                            </div>
                            <div className="space-y-2">
                                <Label>Payment Method *</Label>
                                <Select value={newPayment.payment_method} onValueChange={(val) => setNewPayment(prev => ({...prev, payment_method: val}))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                        <SelectItem value="cash">Cash</SelectItem>
                                        <SelectItem value="mpesa">M-Pesa</SelectItem>
                                        <SelectItem value="cheque">Cheque</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Reference Number</Label>
                            <Input value={newPayment.reference_number} onChange={e => setNewPayment(prev => ({...prev, reference_number: e.target.value}))} placeholder="e.g. TXN12345" />
                        </div>
                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Input value={newPayment.notes} onChange={e => setNewPayment(prev => ({...prev, notes: e.target.value}))} placeholder="Optional notes..." />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <IOSButton variant="secondary" onClick={() => setIsRecordModalOpen(false)} disabled={isSubmitting}>Cancel</IOSButton>
                        <IOSButton onClick={handleRecordPayment} disabled={isSubmitting} className="bg-[#007AFF] text-white">
                            {isSubmitting ? 'Recording...' : 'Record Payment'}
                        </IOSButton>
                    </div>
                </DialogContent>
            </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
