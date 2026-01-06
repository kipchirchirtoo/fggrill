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
    Receipt, Plus, Search, Calendar,
    TrendingDown, PieChart, Wallet, Loader2
} from 'lucide-react';
import { accountingAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function ExpensesPage() {
    const { activeBranch } = useBranch();
    const [bills, setBills] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        vendor_id: '',
        bill_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        subtotal: '',
        notes: ''
    });

    const fetchBills = async () => {
        try {
            setLoading(true);
            const res = await accountingAPI.getBills();
            if (res.success && res.data) {
                setBills(res.data);
            }
        } catch (error) {
            console.error('Failed to fetch bills:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBills();
    }, []);

    const handleCreate = async () => {
        try {
            if (!formData.vendor_id || !formData.subtotal) {
                toast.error('Please fill required fields');
                return;
            }
            setLoading(true);

            const res = await accountingAPI.createBill({
                ...formData,
                subtotal: parseFloat(formData.subtotal),
                tax_amount: 0 // Assuming tax included or 0 for expenses for now
            });

            if (res.success) {
                toast.success('Expense recorded successfully');
                setIsModalOpen(false);
                fetchBills();
                setFormData({
                    vendor_id: '',
                    bill_date: new Date().toISOString().split('T')[0],
                    due_date: new Date().toISOString().split('T')[0],
                    subtotal: '',
                    notes: ''
                });
            }
        } catch (error) {
            console.error('Failed to record expense:', error);
            toast.error('Failed to record expense');
        } finally {
            setLoading(false);
        }
    };

    // Mock vendors
    const mockVendors = [
        { id: '1', name: 'General Supplies Ltd' },
        { id: '2', name: 'Local Market Vendor' },
        { id: '3', name: 'Utility Company' }
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Expenses</h1>
                            <p className="text-stone-500 text-sm mt-0.5">Track petty cash and operational expenses for <span className="font-semibold">{activeBranch?.name}</span></p>
                        </div>
                        <Button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Record Expense
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Chart Placeholder - could be real chart later */}
                        <IOSCard className="p-6 h-64 flex flex-col items-center justify-center text-center bg-white border-stone-200">
                            <PieChart className="h-10 w-10 text-stone-300 mb-3" />
                            <p className="text-sm font-medium text-stone-500">Expense breakdown chart</p>
                            <p className="text-xs text-stone-400 mt-1">Data visualization coming soon</p>
                        </IOSCard>

                        {/* Petty Cash Summary - could fetch from bank account type 'cash' */}
                        <IOSCard className="p-6 bg-stone-900 text-white">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-stone-400 text-xs font-bold uppercase tracking-wider">Total Expenses (Month)</p>
                                    <h2 className="text-3xl font-bold mt-2">KES {bills.reduce((acc, curr) => acc + (curr.total_amount || 0), 0).toLocaleString()}</h2>
                                </div>
                                <div className="h-10 w-10 rounded-full bg-stone-800 flex items-center justify-center">
                                    <Wallet className="h-5 w-5 text-stone-300" />
                                </div>
                            </div>
                        </IOSCard>
                    </div>

                    {/* List */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-stone-900">Recent Expenses</h3>

                        {loading && bills.length === 0 ? (
                            <div className="flex justify-center p-12">
                                <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
                            </div>
                        ) : bills.length > 0 ? (
                            <div className="grid gap-3">
                                {bills.map((bill) => (
                                    <IOSCard key={bill.id} className="p-4 flex items-center justify-between border-stone-200">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                                                <Receipt className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-stone-900">{bill.bill_number}</h4>
                                                <p className="text-xs text-stone-500">{new Date(bill.bill_date).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-stone-900">- KES {bill.total_amount.toLocaleString()}</p>
                                        </div>
                                    </IOSCard>
                                ))}
                            </div>
                        ) : (
                            <IOSCard className="overflow-hidden border-stone-200 shadow-sm">
                                <div className="text-center py-12">
                                    <Receipt className="h-12 w-12 text-stone-300 mx-auto mb-3" />
                                    <p className="text-stone-500 text-sm">No expenses recorded recently.</p>
                                </div>
                            </IOSCard>
                        )}
                    </div>

                    {/* Modal */}
                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Record Operating Expense</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-stone-700">Vendor / Payee</label>
                                    <select
                                        className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-white text-sm"
                                        value={formData.vendor_id}
                                        onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                                    >
                                        <option value="">Select Vendor...</option>
                                        {mockVendors.map(v => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-stone-700">Date</label>
                                    <input type="date" className="w-full h-10 px-3 rounded-lg border border-stone-200"
                                        value={formData.bill_date}
                                        onChange={(e) => setFormData({ ...formData, bill_date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-stone-700">Amount (KES)</label>
                                    <input type="number" className="w-full h-10 px-3 rounded-lg border border-stone-200" placeholder="0.00"
                                        value={formData.subtotal}
                                        onChange={(e) => setFormData({ ...formData, subtotal: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-stone-700">Description / Notes</label>
                                    <textarea className="w-full h-20 px-3 py-2 rounded-lg border border-stone-200 resize-none"
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                                <Button className="btn-primary" onClick={handleCreate} disabled={loading}>
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Save Expense
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
