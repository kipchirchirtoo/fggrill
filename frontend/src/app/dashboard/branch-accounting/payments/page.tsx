'use client';

import { useState, useEffect } from 'react';
import { useBranch } from '@/lib/branch-context';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/minimal/button';
import { IOSCard } from '@/components/ui/ios-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    CreditCard, Search, ArrowDownLeft,
    ArrowUpRight, Download, Filter, Loader2, DollarSign
} from 'lucide-react';
import { accountingAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function PaymentsPage() {
    const { activeBranch } = useBranch();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        bank_account_id: '1', // Default mock account
        transaction_date: new Date().toISOString().split('T')[0],
        amount: '',
        transaction_type: 'credit', // credit (in) or debit (out)
        reference: '',
        description: ''
    });

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const res = await accountingAPI.getTransactions();
            if (res.success && res.data) {
                setTransactions(res.data);
            }
        } catch (error) {
            console.error('Failed to fetch transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    const handleCreate = async () => {
        try {
            if (!formData.amount || !formData.reference) {
                toast.error('Please fill required fields');
                return;
            }
            setLoading(true);

            const res = await accountingAPI.createTransaction({
                ...formData,
                amount: parseFloat(formData.amount)
            });

            if (res.success) {
                toast.success('Transaction recorded successfully');
                setIsModalOpen(false);
                fetchTransactions();
                setFormData({
                    bank_account_id: '1',
                    transaction_date: new Date().toISOString().split('T')[0],
                    amount: '',
                    transaction_type: 'credit',
                    reference: '',
                    description: ''
                });
            }
        } catch (error) {
            console.error('Failed to record transaction:', error);
            toast.error('Failed to record transaction');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Payments & Banking</h1>
                            <p className="text-stone-500 text-sm mt-0.5">Record M-Pesa, Bank, and Cash transactions for <span className="font-semibold">{activeBranch?.name}</span></p>
                        </div>
                        <Button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                            <DollarSign className="h-4 w-4 mr-2" />
                            Record Transaction
                        </Button>
                    </div>

                    {/* List */}
                    {loading && transactions.length === 0 ? (
                        <div className="flex justify-center p-12">
                            <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
                        </div>
                    ) : transactions.length > 0 ? (
                        <IOSCard className="overflow-hidden border-stone-200 shadow-sm">
                            <div className="divide-y divide-stone-100">
                                {transactions.map(tx => (
                                    <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-stone-50">
                                        <div className="flex items-center gap-4">
                                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${tx.transaction_type === 'credit' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                                                }`}>
                                                {tx.transaction_type === 'credit' ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                                            </div>
                                            <div>
                                                <p className="font-medium text-stone-900">{tx.description || 'Transaction'}</p>
                                                <p className="text-xs text-stone-500">{new Date(tx.transaction_date).toLocaleDateString()} • Ref: {tx.reference}</p>
                                            </div>
                                        </div>
                                        <div className={`font-bold ${tx.transaction_type === 'credit' ? 'text-emerald-600' : 'text-stone-900'}`}>
                                            {tx.transaction_type === 'credit' ? '+' : '-'} KES {tx.amount.toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </IOSCard>
                    ) : (
                        <IOSCard className="overflow-hidden border-stone-200 shadow-sm">
                            <div className="text-center py-16">
                                <CreditCard className="h-12 w-12 text-stone-300 mx-auto mb-3" />
                                <h3 className="text-stone-900 font-semibold">No transactions found</h3>
                                <p className="text-stone-500 text-sm mt-1">Payment history will appear here.</p>
                            </div>
                        </IOSCard>
                    )}

                    {/* Modal */}
                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Record Payment / Transaction</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-stone-700">Account</label>
                                    <select
                                        className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-white text-sm"
                                        value={formData.bank_account_id}
                                        onChange={(e) => setFormData({ ...formData, bank_account_id: e.target.value })}
                                    >
                                        <option value="1">Main Operating Account (Bank)</option>
                                        <option value="2">M-Pesa Till (202020)</option>
                                        <option value="3">Petty Cash</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-stone-700">Type</label>
                                        <select
                                            className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-white text-sm"
                                            value={formData.transaction_type}
                                            onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                                        >
                                            <option value="credit">Money In (Deposit)</option>
                                            <option value="debit">Money Out (Payment)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-stone-700">Date</label>
                                        <input type="date" className="w-full h-10 px-3 rounded-lg border border-stone-200"
                                            value={formData.transaction_date}
                                            onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-stone-700">Amount (KES)</label>
                                    <input type="number" className="w-full h-10 px-3 rounded-lg border border-stone-200" placeholder="0.00"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-stone-700">Reference (e.g. M-Pesa Code)</label>
                                    <input type="text" className="w-full h-10 px-3 rounded-lg border border-stone-200"
                                        value={formData.reference}
                                        onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-stone-700">Description</label>
                                    <textarea className="w-full h-16 px-3 py-2 rounded-lg border border-stone-200 resize-none"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                                <Button className="btn-primary" onClick={handleCreate} disabled={loading}>
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Record Transaction
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
