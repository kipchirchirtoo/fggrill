import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { IOSButton } from '@/components/ui/ios-button';
import { Plus, FileText, Users, DollarSign } from 'lucide-react';

interface BillingTabProps {
    invoices?: any[];
}

export const BillingTab = ({ invoices = [] }: BillingTabProps) => {
    const [view, setView] = useState<'invoices' | 'credit'>('invoices');

    // Mock credit data for now
    const creditCustomers = [
        { id: 1, name: 'John Doe', type: 'Customer', limit: 50000, used: 12500, status: 'Active' },
        { id: 2, name: 'Jane Smith', type: 'Employee', limit: 20000, used: 5000, status: 'Active' },
        { id: 3, name: 'Corporate Events Ltd', type: 'Corporate', limit: 500000, used: 125000, status: 'Warning' },
    ];

    return (
        <div className="space-y-6">
            {/* Sub-navigation */}
            <div className="flex gap-2">
                <Button
                    variant={view === 'invoices' ? 'default' : 'outline'}
                    onClick={() => setView('invoices')}
                    className={view === 'invoices' ? 'bg-stone-900 text-white' : ''}
                >
                    <FileText className="mr-2 h-4 w-4" />
                    Invoices
                </Button>
                <Button
                    variant={view === 'credit' ? 'default' : 'outline'}
                    onClick={() => setView('credit')}
                    className={view === 'credit' ? 'bg-stone-900 text-white' : ''}
                >
                    <Users className="mr-2 h-4 w-4" />
                    Credit Management
                </Button>
            </div>

            {view === 'invoices' ? (
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold">Invoices & Credit Bills</CardTitle>
                            <CardDescription>Manage outstanding payments and customer credit</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton size="sm" className="bg-stone-900 text-white" leftIcon={<Plus />}>Create Invoice</IOSButton>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-stone-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Invoice #</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Customer</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Amount</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Date</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {invoices.length > 0 ? (
                                        invoices.map((inv) => (
                                            <tr key={inv.id} className="hover:bg-stone-50 transition-colors">
                                                <td className="px-4 py-4 text-sm font-mono text-stone-600">{inv.invoice_number}</td>
                                                <td className="px-4 py-4 text-sm font-bold text-stone-900">{inv.customer_name || 'Guest'}</td>
                                                <td className="px-4 py-4 text-sm font-bold text-stone-900 text-emerald-600">KES {Number(inv.amount).toLocaleString()}</td>
                                                <td className="px-4 py-4">
                                                    <IOSBadge className={inv.status === 'PAID' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                                                        {inv.status}
                                                    </IOSBadge>
                                                </td>
                                                <td className="px-4 py-4 text-xs text-stone-500">{new Date(inv.created_at).toLocaleDateString()}</td>
                                                <td className="px-4 py-4 text-right">
                                                    <Button variant="ghost" size="sm">View</Button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                                                No invoices found. Create one to get started.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border-none shadow-sm">
                            <CardContent className="p-5">
                                <p className="text-stone-500 text-sm font-medium">Total Credit Extended</p>
                                <p className="text-2xl font-bold mt-1 text-stone-900">KES 142,500</p>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-sm">
                            <CardContent className="p-5">
                                <p className="text-stone-500 text-sm font-medium">Active Credit Accounts</p>
                                <p className="text-2xl font-bold mt-1 text-stone-900">12</p>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-sm">
                            <CardContent className="p-5">
                                <p className="text-stone-500 text-sm font-medium">Overdue Payments</p>
                                <p className="text-2xl font-bold mt-1 text-rose-600">3</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-none shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold">Credit Accounts</CardTitle>
                            <CardDescription>Monitor credit limits and usage</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-stone-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Name</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Type</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Credit Limit</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Used</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Status</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {creditCustomers.map((customer) => (
                                            <tr key={customer.id} className="hover:bg-stone-50 transition-colors">
                                                <td className="px-4 py-4 text-sm font-medium text-stone-900">{customer.name}</td>
                                                <td className="px-4 py-4 text-sm text-stone-500">{customer.type}</td>
                                                <td className="px-4 py-4 text-sm text-stone-900">KES {customer.limit.toLocaleString()}</td>
                                                <td className="px-4 py-4 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-stone-900">KES {customer.used.toLocaleString()}</span>
                                                        <div className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${customer.used / customer.limit > 0.8 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                                                style={{ width: `${(customer.used / customer.limit) * 100}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <IOSBadge className={customer.status === 'Active' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                                                        {customer.status}
                                                    </IOSBadge>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <Button variant="ghost" size="sm">Manage</Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};
