import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Receipt, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { financeAPI } from '@/lib/api';
import { toast } from 'sonner';

export const ExpensesTab = () => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        category: 'Utilities',
        amount: '',
        description: ''
    });

    useEffect(() => {
        fetchExpenses();
    }, []);

    const fetchExpenses = async () => {
        try {
            const response = await financeAPI.getExpenses();
            if (response.success) {
                setExpenses(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching expenses:', error);
            toast.error('Failed to load expenses');
        }
    };

    const handleSubmit = async () => {
        if (!formData.amount || !formData.description) {
            toast.error('Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            const response = await financeAPI.createExpense({
                category: formData.category,
                amount: parseFloat(formData.amount),
                description: formData.description,
                date: new Date().toISOString().split('T')[0]
            });

            if (response.success) {
                toast.success('Expense submitted for approval');
                setFormData({ category: 'Utilities', amount: '', description: '' });
                setIsFormOpen(false);
                fetchExpenses();
            }
        } catch (error) {
            console.error('Error creating expense:', error);
            toast.error('Failed to submit expense');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card className="border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-bold">Expense Management</CardTitle>
                        <CardDescription>Record and track operational expenses</CardDescription>
                    </div>
                    <IOSButton size="sm" className="bg-stone-900 text-white" leftIcon={<Plus />} onClick={() => setIsFormOpen(!isFormOpen)}>
                        {isFormOpen ? 'Cancel' : 'Record Expense'}
                    </IOSButton>
                </CardHeader>
                <CardContent>
                    {isFormOpen && (
                        <div className="mb-8 p-6 bg-stone-50 rounded-xl border border-stone-100">
                            <h3 className="font-bold text-stone-900 mb-4">New Expense Record</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-stone-700">Category</label>
                                    <select
                                        className="w-full p-2 rounded-md border border-stone-200 bg-white text-sm"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        <option>Utilities</option>
                                        <option>Maintenance</option>
                                        <option>Supplies</option>
                                        <option>Transport</option>
                                        <option>Other</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-stone-700">Amount (KES)</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 rounded-md border border-stone-200 text-sm"
                                        placeholder="0.00"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm font-medium text-stone-700">Description</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 rounded-md border border-stone-200 text-sm"
                                        placeholder="Brief description of the expense"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm font-medium text-stone-700">Receipt Attachment</label>
                                    <div className="border-2 border-dashed border-stone-200 rounded-lg p-4 text-center cursor-pointer hover:bg-stone-100 transition-colors">
                                        <Receipt className="h-6 w-6 mx-auto text-stone-400 mb-2" />
                                        <span className="text-xs text-stone-500">Click to upload receipt image</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                                <IOSButton
                                    className="bg-stone-900 text-white"
                                    onClick={handleSubmit}
                                    disabled={loading}
                                >
                                    {loading ? 'Submitting...' : 'Submit for Approval'}
                                </IOSButton>
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-stone-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Category</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Description</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {expenses.map((expense) => (
                                    <tr key={expense.id} className="hover:bg-stone-50 transition-colors">
                                        <td className="px-4 py-4 text-sm text-stone-500">{expense.date}</td>
                                        <td className="px-4 py-4 text-sm font-medium text-stone-900">{expense.category}</td>
                                        <td className="px-4 py-4 text-sm text-stone-500">{expense.description}</td>
                                        <td className="px-4 py-4 text-sm font-bold text-stone-900">KES {expense.amount.toLocaleString()}</td>
                                        <td className="px-4 py-4">
                                            <IOSBadge className={
                                                expense.status === 'Approved' ? "bg-emerald-100 text-emerald-700" :
                                                    expense.status === 'Rejected' ? "bg-rose-100 text-rose-700" :
                                                        "bg-amber-100 text-amber-700"
                                            }>
                                                {expense.status === 'Approved' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                                {expense.status === 'Rejected' && <XCircle className="h-3 w-3 mr-1" />}
                                                {expense.status === 'Pending' && <Clock className="h-3 w-3 mr-1" />}
                                                {expense.status}
                                            </IOSBadge>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <Button variant="ghost" size="sm">View</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
