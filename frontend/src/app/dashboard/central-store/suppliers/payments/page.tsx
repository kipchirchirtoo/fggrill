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
import { procurementAPI } from '@/lib/api';
import { Wallet, CreditCard, Search, RefreshCw, Eye, History, Landmark, ArrowUpRight, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Payment {
    id: string;
    payment_number: string;
    supplier_id: string;
    supplier_name: string;
    payment_date: string;
    amount: number;
    payment_method: string;
    reference_number: string;
    status: 'pending' | 'processed' | 'cancelled';
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

export default function PaymentsPage() {
    const { user } = useAuth();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
    const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
    const [isLedgerOpen, setIsLedgerOpen] = useState(false);

    const fetchPayments = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await procurementAPI.getPayments();
            if (response.success) setPayments(response.data || []);
        } catch (error) { console.error('Error fetching payments:', error); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchPayments(); }, [fetchPayments]);

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

        toast.promise(procurementAPI.exportVATReportPDF({
            from_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
            to_date: new Date().toISOString().split('T')[0]
        }), {
            loading: 'Generating Supplier Statement...',
            success: 'Statement downloaded successfully',
            error: 'Failed to generate statement'
        });
    };

    const filteredPayments = payments.filter(p =>
        p.payment_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.reference_number.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                            <p className="text-lg font-black text-stone-800">KES 1.2M</p>
                        </IOSCard>
                        <IOSCard className="p-4 flex flex-col items-center justify-center text-center">
                            <Wallet size={20} className="text-emerald-500 mb-2" />
                            <p className="text-[10px] uppercase font-bold text-stone-400">Paid (30D)</p>
                            <p className="text-lg font-black text-emerald-600">KES 850k</p>
                        </IOSCard>
                        <IOSCard className="p-4 flex flex-col items-center justify-center text-center">
                            <CreditCard size={20} className="text-[#007AFF] mb-2" />
                            <p className="text-[10px] uppercase font-bold text-stone-400">Pending</p>
                            <p className="text-lg font-black text-[#007AFF]">KES 340k</p>
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
                                <tbody className="divide-y divide-stone-50 bg-white">
                                    {filteredPayments.map(p => (
                                        <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-stone-700">{p.payment_number}</td>
                                            <td className="px-4 py-3 font-semibold">{p.supplier_name}</td>
                                            <td className="px-4 py-3 text-xs">
                                                <p className="capitalize font-medium text-stone-600">{p.payment_method.replace('_', ' ')}</p>
                                                <p className="text-[10px] text-stone-400 font-mono italic">{p.reference_number}</p>
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-[#007AFF]">KES {p.amount.toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <IOSBadge variant="light" color={p.status === 'processed' ? 'success' : 'warning'} className="capitalize text-[10px] py-0 px-2 min-w-[80px] text-center border-none">
                                                    {p.status}
                                                </IOSBadge>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button className="p-1 text-stone-400 hover:text-emerald-600" onClick={() => fetchLedger(p.supplier_id)} title="View Supplier Ledger">
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
                                    {ledgerEntries.map((entry, idx) => (
                                        <tr key={idx} className="hover:bg-stone-25">
                                            <td className="px-3 py-2 text-stone-400">{new Date(entry.transaction_date).toLocaleDateString()}</td>
                                            <td className="px-3 py-2">
                                                <IOSBadge variant="light" className="text-[9px] h-4 mb-1 border-none bg-stone-100 text-stone-600 uppercase font-black">{entry.transaction_type}</IOSBadge>
                                                <p className="font-mono text-[9px] text-stone-400">{entry.reference_number}</p>
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-emerald-600">{Number(entry.debit_amount) > 0 ? Number(entry.debit_amount).toLocaleString() : '-'}</td>
                                            <td className="px-3 py-2 text-right font-mono text-stone-600">{Number(entry.credit_amount) > 0 ? Number(entry.credit_amount).toLocaleString() : '-'}</td>
                                            <td className="px-3 py-2 text-right font-mono font-bold bg-stone-25">{entry.running_balance.toLocaleString()}</td>
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
            </DashboardLayout>
        </ProtectedRoute>
    );
}
