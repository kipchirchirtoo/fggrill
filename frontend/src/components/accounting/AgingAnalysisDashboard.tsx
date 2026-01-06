'use client';

import { useState } from 'react';
import { Calendar, User, Clock, AlertTriangle, ChevronRight, FileSpreadsheet, Send, Search } from 'lucide-react';
import { format } from 'date-fns';

interface Invoice {
    id: string;
    invoiceNumber: string;
    customerName: string;
    date: Date;
    dueDate: Date;
    amount: number;
    paidAmount: number;
    balance: number;
    agingDays: number;
}

export default function AgingAnalysisDashboard() {
    const [searchTerm, setSearchTerm] = useState('');

    // Mock data
    const invoices: Invoice[] = [
        { id: '1', invoiceNumber: 'INV-2024-001', customerName: 'John Doe Ltd', date: new Date('2023-11-15'), dueDate: new Date('2023-12-15'), amount: 150000, paidAmount: 50000, balance: 100000, agingDays: 23 },
        { id: '2', invoiceNumber: 'INV-2024-002', customerName: 'Smart Hotel Group', date: new Date('2023-10-10'), dueDate: new Date('2023-11-10'), amount: 250000, paidAmount: 0, balance: 250000, agingDays: 58 },
        { id: '3', invoiceNumber: 'INV-2024-003', customerName: 'Apex Tours', date: new Date('2023-09-05'), dueDate: new Date('2023-10-05'), amount: 80000, paidAmount: 20000, balance: 60000, agingDays: 94 },
        { id: '4', invoiceNumber: 'INV-2024-004', customerName: 'Individual Guest', date: new Date('2023-12-28'), dueDate: new Date('2024-01-05'), amount: 12500, paidAmount: 0, balance: 12500, agingDays: 2 },
    ];

    const agingBuckets = [
        { label: 'Current', days: '0 days', amount: 12500, count: 1, color: 'bg-emerald-500' },
        { label: '1 - 30 Days', days: '1-30 days', amount: 100000, count: 1, color: 'bg-amber-400' },
        { label: '31 - 60 Days', days: '31-60 days', amount: 250000, count: 1, color: 'bg-orange-500' },
        { label: '61 - 90 Days', days: '61-90 days', amount: 0, count: 0, color: 'bg-rose-500' },
        { label: 'Over 90 Days', days: '90+ days', amount: 60000, count: 1, color: 'bg-rose-700' },
    ];

    const totalOutstanding = agingBuckets.reduce((acc, b) => acc + b.amount, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-[18px] font-bold text-stone-900">Customer Aging Analysis</h2>
                    <p className="text-[12px] text-stone-500">Breakdown of outstanding receivables by time period</p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="btn-secondary">
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>Export Excel</span>
                    </button>
                    <button className="btn-primary bg-stone-900 text-white">
                        <Search className="h-4 w-4" />
                        <span>Filter</span>
                    </button>
                </div>
            </div>

            {/* Aging Buckets Visualization */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {agingBuckets.map((bucket) => (
                    <div key={bucket.label} className="card-elevated p-4 border-b-2 border-b-stone-200 hover:border-b-stone-900 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">{bucket.label}</span>
                            <div className={`h-2 w-2 rounded-full ${bucket.color}`} />
                        </div>
                        <p className="text-[18px] font-bold text-stone-900">KES {bucket.amount.toLocaleString()}</p>
                        <p className="text-[11px] text-stone-500 mt-1">{bucket.count} Invoices</p>
                        <div className="mt-3 w-full bg-stone-100 h-1 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${bucket.color}`}
                                style={{ width: `${(bucket.amount / totalOutstanding) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Invoice Listing */}
            <div className="card-elevated p-0 overflow-hidden">
                <div className="p-4 border-b border-stone-100 flex items-center justify-between">
                    <h3 className="text-[14px] font-bold text-stone-900">Detail View</h3>
                    <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Search customer or invoice..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-stone-200 w-64"
                        />
                    </div>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-stone-50">
                        <tr>
                            <th className="px-5 py-3 text-[11px] font-bold text-stone-500 uppercase">Customer</th>
                            <th className="px-5 py-3 text-[11px] font-bold text-stone-500 uppercase">Invoice</th>
                            <th className="px-5 py-3 text-[11px] font-bold text-stone-500 uppercase">Due Date</th>
                            <th className="px-5 py-3 text-[11px] font-bold text-stone-500 uppercase text-center">Days</th>
                            <th className="px-5 py-3 text-[11px] font-bold text-stone-500 uppercase text-right">Balance</th>
                            <th className="px-5 py-3 text-[11px] font-bold text-stone-500 uppercase w-20">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {invoices.map((invoice) => (
                            <tr key={invoice.id} className="hover:bg-stone-50/50">
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-stone-100 flex items-center justify-center">
                                            <User className="h-4 w-4 text-stone-500" />
                                        </div>
                                        <span className="text-[13px] font-bold text-stone-900">{invoice.customerName}</span>
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    <p className="text-[12px] font-medium text-stone-600">{invoice.invoiceNumber}</p>
                                    <p className="text-[10px] text-stone-400">{format(invoice.date, 'MMM dd, yyyy')}</p>
                                </td>
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-1.5 text-[12px] text-stone-600 font-medium">
                                        <Calendar className="h-3.5 w-3.5 text-stone-400" />
                                        {format(invoice.dueDate, 'MMM dd, yyyy')}
                                    </div>
                                </td>
                                <td className="px-5 py-4 text-center">
                                    <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${invoice.agingDays < 30 ? 'bg-emerald-50 text-emerald-600' :
                                            invoice.agingDays < 60 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                                        }`}>
                                        {invoice.agingDays} d
                                    </span>
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <p className="text-[14px] font-bold text-stone-900">KES {invoice.balance.toLocaleString()}</p>
                                    <p className="text-[10px] text-stone-400">Total: KES {invoice.amount.toLocaleString()}</p>
                                </td>
                                <td className="px-5 py-4">
                                    <button className="p-2 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-900 transition-colors" title="Send Reminder">
                                        <Send className="h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Aging Summary Legend */}
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-4 text-[11px] text-stone-600">
                <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Current: On time</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-amber-400" />
                    <span>1-30: Attention needed</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-rose-500" />
                    <span>60+: Critical / Follow up</span>
                </div>
            </div>
        </div>
    );
}
